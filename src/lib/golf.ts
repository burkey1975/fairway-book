// Pure scoring engine: no React, no Supabase. Holes are 0-based here; the DB stores 1-based.

export type Format = 'stroke' | 'stableford' | 'match' | 'skins';
export type Scoring = 'net' | 'gross';
export type Fairway = 'L' | 'H' | 'R';

export interface Tee {
  name: string;
  gender?: 'M' | 'F';
  rating: number;
  slope: number;
  par: number[];
  si: number[];
  yards: number[];
}

export interface HoleScore {
  strokes?: number | null;
  putts?: number | null;
  fairway?: Fairway | null;
}

export interface CardPlayer {
  id: string;
  name: string;
  handicapIndex: number;
  userId?: string | null;
}

export interface Card {
  tee: Tee;
  format: Format;
  scoring: Scoring;
  allowance: number; // percent
  players: CardPlayer[];
  scores: Record<string, (HoleScore | undefined)[]>; // playerId -> holes
}

export const FORMATS: Record<Format, string> = {
  stroke: 'Stroke play',
  stableford: 'Stableford',
  match: 'Match play',
  skins: 'Skins',
};

export const DEFAULT_ALLOWANCE: Record<Format, number> = { stroke: 95, stableford: 95, match: 100, skins: 100 };

export const sum = (a: (number | null | undefined)[]) => a.reduce<number>((x, y) => x + (y || 0), 0);
export const holeCount = (t: Tee) => t.par.length;
export const toPar = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`);
export const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);

/** WHS course handicap. 9-hole tees use half the index against the 9-hole rating/par. */
export function courseHandicap(index: number, tee: Tee): number {
  const hi = holeCount(tee) === 9 ? index / 2 : index;
  return Math.round(hi * tee.slope / 113 + (tee.rating - sum(tee.par)));
}

export function playingHandicaps(card: Card): number[] {
  const raw = card.players.map(p => Math.round(courseHandicap(p.handicapIndex, card.tee) * card.allowance / 100));
  if (card.format === 'match' && raw.length) {
    const low = Math.min(...raw);
    return raw.map(x => x - low);
  }
  return raw;
}

/** Strokes received (negative = given back by a plus player) on a hole with stroke index `si`. */
export function strokesOn(ph: number, si: number, n: number): number {
  if (ph >= 0) return Math.floor(ph / n) + (si <= ph % n ? 1 : 0);
  return n + 1 - si <= -ph ? -1 : 0;
}

export function stablefordPoints(par: number, received: number, strokes?: number | null): number {
  return strokes ? Math.max(0, 2 + par + received - strokes) : 0;
}

export const cell = (card: Card, playerId: string, h: number): HoleScore => card.scores[playerId]?.[h] ?? {};

export interface BoardRow {
  playerId: string;
  name: string;
  ph: number;
  thru: number;
  gross: number;
  net: number;
  points: number;
  toParGross: number;
  toParNet: number;
  pos: number;
}

export function leaderboard(card: Card): BoardRow[] {
  const n = holeCount(card.tee);
  const ph = playingHandicaps(card);
  const rows: BoardRow[] = card.players.map((p, i) => {
    let gross = 0, net = 0, points = 0, thru = 0, parThru = 0;
    for (let h = 0; h < n; h++) {
      const s = cell(card, p.id, h).strokes;
      if (!s) continue;
      const rec = strokesOn(ph[i], card.tee.si[h], n);
      thru++;
      gross += s;
      net += s - rec;
      parThru += card.tee.par[h];
      points += stablefordPoints(card.tee.par[h], rec, s);
    }
    return { playerId: p.id, name: p.name, ph: ph[i], thru, gross, net, points,
      toParGross: gross - parThru, toParNet: net - parThru, pos: 0 };
  });
  const key = (r: BoardRow) =>
    card.format === 'stableford' ? -r.points : card.format === 'stroke' && card.scoring === 'gross' ? r.toParGross : r.toParNet;
  rows.sort((a, b) => (b.thru > 0 ? 1 : 0) - (a.thru > 0 ? 1 : 0) || key(a) - key(b) || b.thru - a.thru);
  rows.forEach((r, i) => { r.pos = i > 0 && key(rows[i - 1]) === key(r) ? rows[i - 1].pos : i + 1; });
  return rows;
}

export interface MatchState {
  text: string;
  played: number;
  finished: boolean;
  leaderId: string | null;
  margin: number;
}

export interface MatchHole {
  hole: number;              // 0-based
  winnerId: string | null;   // null = halved
  diff: number;              // running score after this hole; + means players[0] is up
}

/** Hole-by-hole singles match play results, stopping at the first unfinished hole or when the match is decided. */
export function matchHoles(card: Card): MatchHole[] {
  const [a, b] = card.players;
  if (!a || !b) return [];
  const n = holeCount(card.tee);
  const ph = playingHandicaps(card);
  const out: MatchHole[] = [];
  let diff = 0;
  for (let h = 0; h < n; h++) {
    const sa = cell(card, a.id, h).strokes, sb = cell(card, b.id, h).strokes;
    if (!sa || !sb) break;
    const na = sa - strokesOn(ph[0], card.tee.si[h], n);
    const nb = sb - strokesOn(ph[1], card.tee.si[h], n);
    const winnerId = na < nb ? a.id : nb < na ? b.id : null;
    diff += na < nb ? 1 : nb < na ? -1 : 0;
    out.push({ hole: h, winnerId, diff });
    if (Math.abs(diff) > n - out.length) break;
  }
  return out;
}

/** Singles match play between players[0] and players[1]. */
export function matchStatus(card: Card): MatchState {
  const [a, b] = card.players;
  if (!a || !b) return { text: 'Waiting for opponent', played: 0, finished: false, leaderId: null, margin: 0 };
  const n = holeCount(card.tee);
  const holes = matchHoles(card);
  const played = holes.length;
  const diff = holes[played - 1]?.diff ?? 0;
  const left = n - played;
  const leader = diff > 0 ? a : diff < 0 ? b : null;
  const margin = Math.abs(diff);
  const base = { played, leaderId: leader?.id ?? null, margin };
  if (played === 0) return { ...base, text: 'All square', finished: false };
  if (!leader) return { ...base, text: left ? `All square thru ${played}` : 'Match halved', finished: left === 0 };
  if (margin > left) return { ...base, text: `${leader.name} wins ${left ? `${margin}&${left}` : `${margin} up`}`, finished: true };
  return { ...base, text: `${leader.name} ${margin} up thru ${played}${margin === left ? ' (dormie)' : ''}`, finished: false };
}

export interface SkinsResult {
  won: Record<string, number>;
  carry: number;
  log: { hole: number; playerId: string | null; value: number }[];
}

/** Net skins; ties carry over. Stops at the first hole not complete for everyone. */
export function skins(card: Card): SkinsResult {
  const n = holeCount(card.tee);
  const ph = playingHandicaps(card);
  const won: Record<string, number> = Object.fromEntries(card.players.map(p => [p.id, 0]));
  const log: SkinsResult['log'] = [];
  let carry = 0;
  for (let h = 0; h < n; h++) {
    const nets = card.players.map((p, i) => {
      const s = cell(card, p.id, h).strokes;
      return s ? s - strokesOn(ph[i], card.tee.si[h], n) : null;
    });
    if (nets.some(x => x === null)) break;
    const best = Math.min(...(nets as number[]));
    carry++;
    const winners = nets.filter(x => x === best).length;
    if (winners === 1) {
      const id = card.players[nets.indexOf(best)].id;
      won[id] += carry;
      log.push({ hole: h, playerId: id, value: carry });
      carry = 0;
    } else {
      log.push({ hole: h, playerId: null, value: 0 });
    }
  }
  return { won, carry, log };
}

/** WHS score differential for one 18-hole round (net double bogey cap; unplayed holes = net par). */
export function scoreDifferential(card: Card, playerId: string): number | null {
  if (holeCount(card.tee) !== 18) return null;
  const p = card.players.find(x => x.id === playerId);
  if (!p) return null;
  const ch = courseHandicap(p.handicapIndex, card.tee);
  let ags = 0, played = 0;
  for (let h = 0; h < 18; h++) {
    const par = card.tee.par[h];
    const rec = strokesOn(ch, card.tee.si[h], 18);
    const s = cell(card, playerId, h).strokes;
    if (s) { played++; ags += Math.min(s, par + 2 + rec); } else ags += par + rec;
  }
  if (played < 14) return null; // WHS needs 14+ holes for an 18-hole score
  return Math.round((113 / card.tee.slope) * (ags - card.tee.rating) * 10) / 10;
}

const WHS_TABLE: Record<number, [number, number]> = {
  3: [1, -2], 4: [1, -1], 5: [1, 0], 6: [2, -1], 7: [2, 0], 8: [2, 0], 9: [3, 0], 10: [3, 0], 11: [3, 0],
  12: [4, 0], 13: [4, 0], 14: [4, 0], 15: [5, 0], 16: [5, 0], 17: [6, 0], 18: [6, 0], 19: [7, 0], 20: [8, 0],
};

/** Estimated index from differentials, most recent first. Null with fewer than 3. */
export function handicapEstimate(differentials: number[]): number | null {
  const d = differentials.slice(0, 20);
  if (d.length < 3) return null;
  const [use, adj] = WHS_TABLE[d.length];
  const best = [...d].sort((a, b) => a - b).slice(0, use);
  return Math.min(54, Math.round((sum(best) / use + adj) * 10) / 10);
}

export interface PlayerStats {
  rounds: number;
  holes: number;
  avg18: number | null;
  best18: number | null;
  puttsPer18: number | null;
  girPct: number | null;
  fairwayPct: number | null;
  missLeftPct: number | null;
  missRightPct: number | null;
  mix: { eagle: number; birdie: number; par: number; bogey: number; double: number };
  recent18: number[]; // most recent first
  handicap: number | null;
}

/** Stats for one person across rounds. `entries` most recent first. */
export function playerStats(entries: { card: Card; playerId: string }[]): PlayerStats {
  let holes = 0, putts = 0, puttHoles = 0, gir = 0, fw = 0, fwHit = 0, fwL = 0, fwR = 0;
  const mix = { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0 };
  const recent18: number[] = [];
  const diffs: number[] = [];
  for (const { card, playerId } of entries) {
    const n = holeCount(card.tee);
    let complete = true, gross = 0;
    for (let h = 0; h < n; h++) {
      const c = cell(card, playerId, h), par = card.tee.par[h];
      if (!c.strokes) { complete = false; continue; }
      holes++;
      gross += c.strokes;
      const d = c.strokes - par;
      if (d <= -2) mix.eagle++; else if (d === -1) mix.birdie++; else if (d === 0) mix.par++; else if (d === 1) mix.bogey++; else mix.double++;
      if (c.putts != null) {
        putts += c.putts;
        puttHoles++;
        if (c.strokes - c.putts <= par - 2) gir++;
      }
      if (par > 3 && c.fairway) {
        fw++;
        if (c.fairway === 'H') fwHit++; else if (c.fairway === 'L') fwL++; else fwR++;
      }
    }
    if (n === 18 && complete) recent18.push(gross);
    const diff = scoreDifferential(card, playerId);
    if (diff !== null) diffs.push(diff);
  }
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
  return {
    rounds: entries.length,
    holes,
    avg18: recent18.length ? Math.round((sum(recent18) / recent18.length) * 10) / 10 : null,
    best18: recent18.length ? Math.min(...recent18) : null,
    puttsPer18: puttHoles ? Math.round((putts / puttHoles) * 18 * 10) / 10 : null,
    girPct: pct(gir, puttHoles),
    fairwayPct: pct(fwHit, fw),
    missLeftPct: pct(fwL, fw),
    missRightPct: pct(fwR, fw),
    mix,
    recent18,
    handicap: handicapEstimate(diffs),
  };
}

export interface Vote { voter_id: string; nominee_id: string; points: number }

export function voteTotals(votes: Vote[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const v of votes) t[v.nominee_id] = (t[v.nominee_id] ?? 0) + v.points;
  return t;
}

/** Vote slots a voter gets: 3-2-1, fewer when the group is small. */
export const voteSlots = (playerCount: number) => [3, 2, 1].slice(0, Math.max(0, playerCount - 1));
