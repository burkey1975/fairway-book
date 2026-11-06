import { View } from 'react-native';
import { holeCount, matchHoles, matchStatus, range, type Card } from '../lib/golf';
import { C, Row, Txt } from './kit';

const A_COLOR = C.acc;   // players[0]
const B_COLOR = C.blue;  // players[1]

/** Singles match: status line, then one dot per hole showing who won it (grey = halved). */
export function MatchStrip({ card, current }: { card: Card; current?: number }) {
  const [a, b] = card.players;
  if (!a || !b) return <Txt muted small style={{ textAlign: 'center' }}>Waiting for an opponent to join.</Txt>;
  const n = holeCount(card.tee);
  const holes = matchHoles(card);
  const status = matchStatus(card);
  const leadColor = status.leaderId === a.id ? A_COLOR : status.leaderId === b.id ? B_COLOR : C.text;
  const halves = n === 18 ? [range(0, 9), range(9, 18)] : [range(0, n)];

  return (
    <View style={{ gap: 10 }}>
      <Txt bold size={20} color={leadColor} style={{ textAlign: 'center' }}>{status.text}</Txt>
      <Row style={{ justifyContent: 'center', gap: 16 }}>
        <Row style={{ gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: A_COLOR }} /><Txt small>{a.name}</Txt></Row>
        <Row style={{ gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: B_COLOR }} /><Txt small>{b.name}</Txt></Row>
        <Row style={{ gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.mute }} /><Txt small>Halved</Txt></Row>
      </Row>
      {halves.map((hs, i) => (
        <Row key={i} style={{ justifyContent: 'space-between', gap: 0 }}>
          {hs.map(h => {
            const r = holes[h];
            const bg = !r ? 'transparent' : r.winnerId === a.id ? A_COLOR : r.winnerId === b.id ? B_COLOR : C.mute;
            return (
              <View key={h} style={{ alignItems: 'center', gap: 3, width: 32 }}>
                <View style={{
                  width: 28, height: 28, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
                  borderWidth: h === current ? 2 : 1, borderColor: h === current ? C.text : r ? bg : C.line,
                }}>
                  <Txt small bold color={r ? '#05220f' : C.mute}>{h + 1}</Txt>
                </View>
                <Txt small muted>{r ? (r.diff === 0 ? 'AS' : `${Math.abs(r.diff)}`) : ''}</Txt>
              </View>
            );
          })}
        </Row>
      ))}
      <Txt small muted style={{ textAlign: 'center' }}>Number under each hole = holes up after it · AS = all square</Txt>
    </View>
  );
}
