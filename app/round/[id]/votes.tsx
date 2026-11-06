import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { saveVotes } from '../../../src/lib/api';
import { voteSlots, voteTotals } from '../../../src/lib/golf';
import { useAuth } from '../../../src/hooks/useAuth';
import { useRound } from '../../../src/hooks/useRound';
import { Btn, C, Card, Chip, Empty, ErrorText, Loading, Row, Screen, Txt } from '../../../src/ui/kit';

export default function Votes() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { round, players, votes, loading, error: loadError, reload } = useRound(id);
  const me = session?.user.id;
  const isOwner = round?.created_by === me;
  // You vote as yourself; the organiser also votes on behalf of guests without the app.
  const actors = players.filter(p => p.user_id === me || (p.user_id === null && isOwner)).sort((a, b) => a.position - b.position);
  const [voterId, setVoterId] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!voterId && actors[0]) setVoterId(actors[0].id); }, [actors, voterId]);
  useEffect(() => {
    if (!voterId) return;
    setPicks(Object.fromEntries(votes.filter(v => v.voter_id === voterId).map(v => [v.points, v.nominee_id])));
    // Only reset picks when switching voter, not when someone else's votes arrive live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voterId]);

  if (loading) return <Loading />;
  if (!round) return <Empty text={loadError ?? 'Round not found.'} />;
  if (players.length < 2) return <Empty text="Voting needs at least two players." />;
  if (!actors.length) return <Empty text="You're not playing in this round, so you can't vote." />;

  const others = players.filter(p => p.id !== voterId).sort((a, b) => a.position - b.position);
  const slots = voteSlots(players.length);
  const voted = new Set(votes.map(v => v.voter_id));
  const totals = voteTotals(votes);
  const voter = players.find(p => p.id === voterId);

  async function submit() {
    if (!voterId) return;
    setBusy(true); setError('');
    try {
      await saveVotes(round!.id, voterId, picks);
      await reload();
      const next = actors.find(a => a.id !== voterId && !voted.has(a.id));
      if (next) setVoterId(next.id);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  return (
    <Screen>
      {actors.length > 1 && (
        <Card title="Voting as">
          <Row style={{ flexWrap: 'wrap' }}>
            {actors.map(a => <Chip key={a.id} label={`${a.name}${voted.has(a.id) ? ' ✓' : ''}`} on={a.id === voterId} onPress={() => setVoterId(a.id)} />)}
          </Row>
        </Card>
      )}
      <Card title={`${voter?.name}'s votes`}>
        <Txt small muted style={{ marginBottom: 6 }}>Give {slots.join('-')} votes to the best players of the round.</Txt>
        {slots.map(pts => (
          <View key={pts}>
            <Txt small muted style={{ marginTop: 10, marginBottom: 6 }}>{pts} vote{pts > 1 ? 's' : ''}</Txt>
            <Row style={{ flexWrap: 'wrap' }}>
              {others.map(o => {
                const takenElsewhere = Object.entries(picks).some(([k, v]) => v === o.id && +k !== pts);
                return <Chip key={o.id} label={o.name} on={picks[pts] === o.id} disabled={takenElsewhere}
                  onPress={() => setPicks(p => {
                    const next = { ...p };
                    if (next[pts] === o.id) delete next[pts]; else next[pts] = o.id;
                    return next;
                  })} />;
              })}
            </Row>
          </View>
        ))}
        <ErrorText>{error}</ErrorText>
        <Btn kind="primary" label={voted.has(voterId ?? '') ? 'Update votes' : 'Submit votes'} onPress={submit} busy={busy}
          disabled={!Object.keys(picks).length} style={{ marginTop: 14 }} />
      </Card>

      <Card title="Who has voted">
        {[...players].sort((a, b) => a.position - b.position).map(p => (
          <Row key={p.id} style={{ paddingVertical: 4 }}>
            <Txt style={{ flex: 1 }}>{p.name}</Txt>
            <Txt small color={voted.has(p.id) ? C.acc : C.mute}>{voted.has(p.id) ? 'Voted' : 'Waiting'}</Txt>
            <Txt bold style={{ width: 40, textAlign: 'right' }}>{totals[p.id] ?? 0}</Txt>
          </Row>
        ))}
      </Card>
      <Btn label="Done" onPress={() => router.replace(`/round/${id}/card`)} />
    </Screen>
  );
}
