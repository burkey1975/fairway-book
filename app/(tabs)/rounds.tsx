import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl } from 'react-native';
import { FORMATS, leaderboard, matchStatus, skins, toPar, type Card } from '../../src/lib/golf';
import { useMyRounds } from '../../src/hooks/useMyRounds';
import { C, Empty, ErrorText, Loading, Row, Txt } from '../../src/ui/kit';

function result(card: Card): string {
  if (card.format === 'match') return matchStatus(card).text;
  if (card.format === 'skins') {
    const won = skins(card).won;
    const best = [...card.players].sort((a, b) => won[b.id] - won[a.id])[0];
    return best ? `${best.name} ${won[best.id]} skins` : '';
  }
  const w = leaderboard(card)[0];
  if (!w) return '';
  if (card.format === 'stableford') return `${w.name} ${w.points} pts`;
  return card.scoring === 'gross' ? `${w.name} ${w.gross}` : `${w.name} ${toPar(w.toParNet)} net`;
}

export default function Rounds() {
  const { rounds, loading, error, reload } = useMyRounds();
  if (loading) return <Loading />;
  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 14 }}
      data={rounds}
      keyExtractor={r => r.round.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={C.acc} />}
      ListHeaderComponent={<ErrorText>{error}</ErrorText>}
      ListEmptyComponent={<Empty text="No finished rounds yet." />}
      renderItem={({ item: { round, card } }) => (
        <Pressable onPress={() => router.push(`/round/${round.id}/card`)}
          style={{ backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <Row>
            <Txt bold style={{ flex: 1 }}>{round.course_name}</Txt>
            <Txt small>{result(card)}</Txt>
          </Row>
          <Txt small muted>
            {new Date(round.started_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · {FORMATS[round.format]} · {card.players.length} players
          </Txt>
        </Pressable>
      )}
    />
  );
}
