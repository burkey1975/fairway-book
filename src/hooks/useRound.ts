import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchRound, toCard, upsertScore, type PlayerRow, type RoundRow, type ScoreRow, type VoteRow } from '../lib/api';
import { supabase } from '../lib/supabase';

const key = (playerId: string, hole: number) => `${playerId}:${hole}`;

/** Loads a round and keeps it live via Supabase Realtime. Score edits are optimistic and debounced. */
export function useRound(id: string | undefined) {
  const [round, setRound] = useState<RoundRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreRow>>({});
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const unsaved = useRef(new Map<string, ScoreRow>());
  const latest = useRef(scores);
  latest.current = scores;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetchRound(id);
      const { round_players, scores: sc, votes: v, ...rest } = r;
      setRound(rest);
      setPlayers(round_players);
      setScores(prev => {
        const next: Record<string, ScoreRow> = {};
        for (const s of sc) next[key(s.player_id, s.hole)] = s;
        for (const k of pending.current.keys()) if (prev[k]) next[k] = prev[k]; // keep unsaved local edits
        return next;
      });
      setVotes(v);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    load();
    const filter = `round_id=eq.${id}`;
    const channel = supabase
      .channel(`round:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter }, payload => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as ScoreRow;
        const k = key(row.player_id, row.hole);
        if (pending.current.has(k)) return; // our own unsaved edit wins locally
        setScores(prev => {
          const next = { ...prev };
          if (payload.eventType === 'DELETE') delete next[k]; else next[k] = row;
          return next;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_players', filter }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `id=eq.${id}` },
        payload => setRound(r => (r ? { ...r, ...(payload.new as RoundRow) } : r)))
      .subscribe();
    // Catch up on anything missed while the phone was locked.
    const sub = AppState.addEventListener('change', s => { if (s === 'active') load(); });
    return () => { supabase.removeChannel(channel); sub.remove(); };
  }, [id, load]);

  const setScore = useCallback((playerId: string, hole: number, patch: Partial<ScoreRow>) => {
    if (!round) return;
    const k = key(playerId, hole);
    const prev: ScoreRow | undefined = latest.current[k];
    const row: ScoreRow = { ...(prev ?? { round_id: round.id, player_id: playerId, hole, strokes: null, putts: null, fairway: null }), ...patch };
    latest.current = { ...latest.current, [k]: row };
    setScores(prev => ({ ...prev, [k]: row }));
    clearTimeout(pending.current.get(k));
    unsaved.current.set(k, row);
    pending.current.set(k, setTimeout(() => { write(k); }, 500));
  }, [round]);

  async function write(k: string) {
    const row = unsaved.current.get(k);
    clearTimeout(pending.current.get(k));
    if (!row) return;
    try { await upsertScore(row); setError(null); }
    catch (e) { setError(`Score not saved: ${e instanceof Error ? e.message : e}`); }
    finally {
      if (unsaved.current.get(k) === row) { unsaved.current.delete(k); pending.current.delete(k); }
    }
  }

  /** Write any debounced score edits now (e.g. before finishing the round). */
  const flush = useCallback(() => Promise.all([...unsaved.current.keys()].map(write)), []);

  const card = useMemo(() => (round ? toCard(round, players, Object.values(scores)) : null), [round, players, scores]);

  return { round, players, votes, card, loading, error, setScore, flush, reload: load };
}
