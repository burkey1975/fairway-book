import { useLocalSearchParams } from 'expo-router';
import { FORMATS } from '../../../src/lib/golf';
import { useRound } from '../../../src/hooks/useRound';
import { C, Card, Empty, Loading, Screen, Txt } from '../../../src/ui/kit';
import { Leaderboard } from '../../../src/ui/Leaderboard';

export default function LeaderboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { round, card, loading, error } = useRound(id);
  if (loading) return <Loading />;
  if (!round || !card) return <Empty text={error ?? 'Round not found.'} />;
  return (
    <Screen>
      <Card title={round.course_name} right={round.status === 'live' ? <Txt small color={C.acc}>● LIVE</Txt> : undefined}>
        <Txt small muted style={{ marginBottom: 8 }}>
          {round.tee.name} tees · {FORMATS[round.format]}{round.format === 'stroke' ? ` (${round.scoring})` : ''} · {round.allowance}% allowance
        </Txt>
        <Leaderboard card={card} />
      </Card>
      <Txt small muted style={{ textAlign: 'center' }}>Updates live as anyone in the group enters scores.</Txt>
    </Screen>
  );
}
