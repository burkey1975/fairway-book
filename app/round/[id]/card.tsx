import { router, useLocalSearchParams } from 'expo-router';
import { deleteRound } from '../../../src/lib/api';
import { confirmAction, showError } from '../../../src/lib/dialogs';
import { FORMATS, voteTotals } from '../../../src/lib/golf';
import { useAuth } from '../../../src/hooks/useAuth';
import { useRound } from '../../../src/hooks/useRound';
import { Btn, Card, Empty, Loading, Row, Screen, Txt } from '../../../src/ui/kit';
import { Leaderboard } from '../../../src/ui/Leaderboard';
import { Scorecard } from '../../../src/ui/Scorecard';

export default function RoundCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { round, card, votes, loading, error } = useRound(id);
  if (loading) return <Loading />;
  if (!round || !card) return <Empty text={error ?? 'Round not found.'} />;

  const totals = voteTotals(votes);
  const isOwner = round.created_by === session?.user.id;
  const date = new Date(round.started_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  const remove = () => confirmAction('Delete round?', 'This removes the round, scores and votes for everyone.', 'Delete', async () => {
    try { await deleteRound(round.id); router.back(); }
    catch (e) { showError('Could not delete', e); }
  }, true);

  return (
    <Screen>
      <Card title={round.course_name}>
        <Txt small muted style={{ marginBottom: 8 }}>{date} · {round.tee.name} · {FORMATS[round.format]}</Txt>
        <Leaderboard card={card} />
      </Card>
      <Card title="Scorecard"><Scorecard card={card} /></Card>
      {round.status === 'done' && (
        <Card title="Player votes" right={<Btn small label="Vote" onPress={() => router.push(`/round/${id}/votes`)} />}>
          {votes.length === 0 ? <Txt muted small>No votes yet.</Txt> :
            [...card.players].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0)).map(p => (
              <Row key={p.id} style={{ paddingVertical: 4 }}>
                <Txt style={{ flex: 1 }}>{p.name}</Txt><Txt bold>{totals[p.id] ?? 0}</Txt>
              </Row>
            ))}
        </Card>
      )}
      {isOwner && <Btn small kind="danger" label="Delete round" onPress={remove} />}
    </Screen>
  );
}
