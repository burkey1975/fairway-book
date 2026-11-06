import { View } from 'react-native';
import { playerStats } from '../../src/lib/golf';
import { useAuth } from '../../src/hooks/useAuth';
import { useMyRounds } from '../../src/hooks/useMyRounds';
import { C, Card, Empty, ErrorText, Loading, Row, Screen, Stat, Txt } from '../../src/ui/kit';

const MIX: [keyof ReturnType<typeof playerStats>['mix'], string, string][] = [
  ['eagle', 'Eagle+', C.blue], ['birdie', 'Birdie', '#93c5fd'], ['par', 'Par', C.acc], ['bogey', 'Bogey', C.warn], ['double', 'Double+', C.bad],
];
const pct = (v: number | null) => (v === null ? null : `${v}%`);

export default function Stats() {
  const { session } = useAuth();
  const { rounds, loading, error } = useMyRounds();
  if (loading) return <Loading />;

  const me = session?.user.id;
  const entries = rounds.flatMap(({ card }) => {
    const p = card.players.find(x => x.userId === me);
    return p ? [{ card, playerId: p.id }] : [];
  });
  if (!entries.length) return <Empty text="Finish a round to see your stats." />;

  const s = playerStats(entries);
  const recent = s.recent18.slice(0, 10).reverse();
  const lo = Math.min(...recent) - 3, hi = Math.max(...recent);

  return (
    <Screen>
      <ErrorText>{error}</ErrorText>
      <Row style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat value={s.handicap} label={s.handicap === null ? 'Est. handicap (3+ rounds)' : 'Est. handicap'} />
        <Stat value={s.rounds} label="Rounds" />
        <Stat value={s.avg18} label="Avg 18-hole score" />
        <Stat value={s.best18} label="Best round" />
        <Stat value={s.puttsPer18} label="Putts / 18" />
        <Stat value={pct(s.girPct)} label="Greens in reg" />
        <Stat value={pct(s.fairwayPct)} label="Fairways hit" />
        <Stat value={pct(s.missLeftPct)} label="Miss left" />
        <Stat value={pct(s.missRightPct)} label="Miss right" />
      </Row>

      <Card title={`Scoring mix (${s.holes} holes)`}>
        <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: C.input, marginBottom: 10 }}>
          {MIX.map(([k, , color]) => s.mix[k] ? <View key={k} style={{ flex: s.mix[k], backgroundColor: color }} /> : null)}
        </View>
        <Row style={{ flexWrap: 'wrap', gap: 12 }}>
          {MIX.map(([k, label, color]) => (
            <Txt key={k} small><Txt small color={color}>● </Txt>{label} {s.holes ? Math.round((s.mix[k] / s.holes) * 100) : 0}%</Txt>
          ))}
        </Row>
      </Card>

      {recent.length > 1 && (
        <Card title={`Last ${recent.length} scores`}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6 }}>
            {recent.map((v, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Txt small muted>{v}</Txt>
                <View style={{ width: '100%', height: ((v - lo) / Math.max(1, hi - lo)) * 90 + 6, backgroundColor: C.acc2, borderRadius: 4 }} />
              </View>
            ))}
          </View>
          <Txt small muted style={{ marginTop: 6 }}>Oldest → newest. Lower is better.</Txt>
        </Card>
      )}
      <Txt small muted>
        The handicap is an estimate using World Handicap System rules (best differentials of your last 20 rounds, net double bogey cap). It is not an official index.
      </Txt>
    </Screen>
  );
}
