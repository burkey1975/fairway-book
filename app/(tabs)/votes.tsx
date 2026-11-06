import { useState } from 'react';
import { View } from 'react-native';
import { useMyRounds } from '../../src/hooks/useMyRounds';
import { C, Card, Chip, Empty, ErrorText, Loading, Row, Screen, Txt } from '../../src/ui/kit';

interface Tally { name: string; votes: number; threes: number; rounds: number }
const MEDALS = ['#facc15', '#cbd5e1', '#d97706'];

export default function SeasonVotes() {
  const { rounds, loading, error } = useMyRounds();
  const [year, setYear] = useState(new Date().getFullYear());
  if (loading) return <Loading />;

  const years = [...new Set([new Date().getFullYear(), ...rounds.map(r => new Date(r.round.started_at).getFullYear())])].sort((a, b) => b - a);
  // Players with the app are grouped by account; guests by name.
  const tally: Record<string, Tally> = {};
  for (const { round } of rounds) {
    if (new Date(round.started_at).getFullYear() !== year) continue;
    const keyOf = new Map(round.round_players.map(p => [p.id, p.user_id ?? `guest:${p.name.trim().toLowerCase()}`]));
    for (const p of round.round_players) {
      const k = keyOf.get(p.id)!;
      (tally[k] ??= { name: p.name, votes: 0, threes: 0, rounds: 0 }).rounds++;
    }
    for (const v of round.votes) {
      const t = tally[keyOf.get(v.nominee_id)!];
      if (!t) continue;
      t.votes += v.points;
      if (v.points === 3) t.threes++;
    }
  }
  const rows = Object.values(tally).sort((a, b) => b.votes - a.votes || b.threes - a.threes);

  return (
    <Screen>
      <ErrorText>{error}</ErrorText>
      <Row style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        {years.map(y => <Chip key={y} label={String(y)} on={y === year} onPress={() => setYear(y)} />)}
      </Row>
      <Card title="Player of the Year">
        <Txt small muted style={{ marginBottom: 8 }}>After each round, every player gives 3, 2 and 1 votes to the best players. Counts all rounds you played in.</Txt>
        {!rows.some(r => r.votes) ? <Empty text="No votes this season yet." /> : (
          <>
            <Row style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Txt small muted style={{ width: 30 }}> </Txt>
              <Txt small muted style={{ flex: 1 }}>Player</Txt>
              <Txt small muted style={{ width: 50, textAlign: 'center' }}>Rounds</Txt>
              <Txt small muted style={{ width: 50, textAlign: 'center' }}>3-vote</Txt>
              <Txt small muted style={{ width: 50, textAlign: 'center' }}>Votes</Txt>
            </Row>
            {rows.map((r, i) => (
              <Row key={r.name + i} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <View style={{ width: 30 }}>
                  {i < 3 && r.votes ? (
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: MEDALS[i], alignItems: 'center', justifyContent: 'center' }}>
                      <Txt small bold color="#111">{i + 1}</Txt>
                    </View>
                  ) : <Txt muted>{i + 1}</Txt>}
                </View>
                <Txt style={{ flex: 1 }}>{r.name}</Txt>
                <Txt style={{ width: 50, textAlign: 'center' }}>{r.rounds}</Txt>
                <Txt style={{ width: 50, textAlign: 'center' }}>{r.threes}</Txt>
                <Txt bold size={18} style={{ width: 50, textAlign: 'center' }}>{r.votes}</Txt>
              </Row>
            ))}
          </>
        )}
      </Card>
    </Screen>
  );
}
