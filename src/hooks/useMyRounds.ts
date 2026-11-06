import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { myRounds, toCard, type FullRound } from '../lib/api';
import type { Card } from '../lib/golf';

export interface MyRound { round: FullRound; card: Card }

/** Finished rounds the signed-in user played in (RLS limits rows to their rounds). Reloads on screen focus. */
export function useMyRounds() {
  const [rounds, setRounds] = useState<MyRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const rows = await myRounds('done');
      setRounds(rows.map(r => ({ round: r, card: toCard(r, r.round_players, r.scores) })));
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  return { rounds, loading, error, reload: load };
}
