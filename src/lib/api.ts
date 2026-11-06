import { supabase } from './supabase';
import type { Card, Fairway, Format, HoleScore, Scoring, Tee } from './golf';

export interface Profile { id: string; display_name: string; handicap_index: number }
export interface CourseRow {
  id: number; external_id: number | null; club_name: string; course_name: string | null;
  location: string | null; tees: Tee[]; source: 'manual' | 'golfcourseapi';
}
export interface RoundRow {
  id: string; created_by: string; course_id: number | null; course_name: string; tee: Tee;
  format: Format; scoring: Scoring; allowance: number; join_code: string;
  status: 'live' | 'done'; started_at: string; finished_at: string | null;
}
export interface PlayerRow {
  id: string; round_id: string; user_id: string | null; name: string; handicap_index: number; position: number;
}
export interface ScoreRow {
  round_id: string; player_id: string; hole: number;
  strokes: number | null; putts: number | null; fairway: Fairway | null;
}
export interface VoteRow { round_id: string; voter_id: string; nominee_id: string; points: number }
export type FullRound = RoundRow & { round_players: PlayerRow[]; scores: ScoreRow[]; votes: VoteRow[] };

const must = <T>({ data, error }: { data: T | null; error: { message: string } | null }): T => {
  if (error) throw new Error(error.message);
  return data as T;
};

export const courseLabel = (c: Pick<CourseRow, 'club_name' | 'course_name'>) =>
  c.course_name ? `${c.club_name} – ${c.course_name}` : c.club_name;

export function toCard(r: RoundRow, players: PlayerRow[], scores: ScoreRow[]): Card {
  const sorted = [...players].sort((a, b) => a.position - b.position);
  const byPlayer: Record<string, (HoleScore | undefined)[]> = {};
  for (const p of sorted) byPlayer[p.id] = [];
  for (const s of scores) (byPlayer[s.player_id] ??= [])[s.hole - 1] = s;
  return {
    tee: r.tee, format: r.format, scoring: r.scoring, allowance: r.allowance,
    players: sorted.map(p => ({ id: p.id, name: p.name, handicapIndex: Number(p.handicap_index), userId: p.user_id })),
    scores: byPlayer,
  };
}

// ---------- profile ----------
export const getProfile = async (id: string) =>
  must<Profile>(await supabase.from('profiles').select('*').eq('id', id).single());
export const updateProfile = async (id: string, patch: Partial<Omit<Profile, 'id'>>) =>
  must(await supabase.from('profiles').update(patch).eq('id', id));

// ---------- courses ----------
export async function searchCourses(q: string): Promise<CourseRow[]> {
  const { data, error } = await supabase.functions.invoke('course-search', { body: { q } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data?.courses ?? [];
}
export const recentCourses = async () =>
  must<CourseRow[]>(await supabase.from('courses').select('*').order('updated_at', { ascending: false }).limit(15));
export const createCourse = async (c: Pick<CourseRow, 'club_name' | 'course_name' | 'location' | 'tees'>) =>
  must<CourseRow>(await supabase.from('courses').insert({ ...c, source: 'manual' }).select().single());

// ---------- rounds ----------
export async function createRound(opts: {
  course: CourseRow; tee: Tee; format: Format; scoring: Scoring; allowance: number;
  me: Profile; guests: { name: string; handicap_index: number }[];
}): Promise<string> {
  const round = must<RoundRow>(await supabase.from('rounds').insert({
    course_id: opts.course.id, course_name: courseLabel(opts.course), tee: opts.tee,
    format: opts.format, scoring: opts.scoring, allowance: opts.allowance,
  }).select().single());
  const players = [
    { user_id: opts.me.id, name: opts.me.display_name, handicap_index: opts.me.handicap_index },
    ...opts.guests.map(g => ({ user_id: null, ...g })),
  ].map((p, position) => ({ ...p, position, round_id: round.id }));
  const { error } = await supabase.from('round_players').insert(players);
  if (error) {
    await supabase.from('rounds').delete().eq('id', round.id);
    throw new Error(error.message);
  }
  return round.id;
}

export const myRounds = async (status: 'live' | 'done') =>
  must<FullRound[]>(await supabase.from('rounds').select('*, round_players(*), scores(*), votes(*)')
    .eq('status', status).order('started_at', { ascending: false }).limit(200));

export const fetchRound = async (id: string) =>
  must<FullRound>(await supabase.from('rounds').select('*, round_players(*), scores(*), votes(*)').eq('id', id).single());

export const finishRound = async (id: string) =>
  must(await supabase.from('rounds').update({ status: 'done', finished_at: new Date().toISOString() }).eq('id', id));
export const deleteRound = async (id: string) => must(await supabase.from('rounds').delete().eq('id', id));

export const upsertScore = async (row: ScoreRow) =>
  must(await supabase.from('scores').upsert({ ...row, updated_at: new Date().toISOString() }));

export interface PeekResult { id: string; course_name: string; format: Format; guests: { id: string; name: string }[] }
export const peekRound = async (code: string) => must<PeekResult | null>(await supabase.rpc('peek_round', { p_code: code }));
export const joinRound = async (code: string, claim?: string) =>
  must<string>(await supabase.rpc('join_round', { p_code: code, p_claim: claim ?? null }));

/** Replace one voter's votes. picks: points -> nominee player id */
export async function saveVotes(roundId: string, voterId: string, picks: Record<number, string>) {
  must(await supabase.from('votes').delete().eq('voter_id', voterId));
  const rows = Object.entries(picks).map(([points, nominee_id]) => ({ round_id: roundId, voter_id: voterId, nominee_id, points: +points }));
  if (rows.length) must(await supabase.from('votes').insert(rows));
}
