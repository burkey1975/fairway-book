import { View } from 'react-native';
import { holeCount, leaderboard, skins, toPar, type Card } from '../lib/golf';
import { C, Row, Txt } from './kit';
import { MatchStrip } from './MatchStrip';

function Line({ cols, header }: { cols: (string | number)[]; header?: boolean }) {
  const widths = [28, undefined, 36, 40, 50, 56];
  return (
    <Row style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line, gap: 4 }}>
      {cols.map((c, i) => (
        <View key={i} style={widths[i] ? { width: widths[i] } : { flex: 1 }}>
          <Txt small={header} muted={header || i === 0} bold={!header && i === cols.length - 1}
            size={!header && i === cols.length - 1 ? 18 : undefined} style={{ textAlign: i === 1 ? 'left' : 'center' }}>{c}</Txt>
        </View>
      ))}
    </Row>
  );
}

export function Leaderboard({ card }: { card: Card }) {
  const n = holeCount(card.tee);
  const lb = leaderboard(card);
  const thru = (t: number) => (t === n ? 'F' : t);

  if (card.format === 'match') {
    return (
      <View>
        <View style={{ marginVertical: 10 }}><MatchStrip card={card} /></View>
        <Line header cols={['', 'Player', 'PH', 'Thru', 'Gross', '']} />
        {card.players.map(p => { const r = lb.find(x => x.playerId === p.id)!;
          return <Line key={p.id} cols={['', p.name, r.ph, thru(r.thru), r.gross || '–', '']} />; })}
      </View>
    );
  }

  if (card.format === 'skins') {
    const sk = skins(card);
    const order = [...lb].sort((a, b) => sk.won[b.playerId] - sk.won[a.playerId]);
    const won = sk.log.filter(l => l.playerId).map(l =>
      `H${l.hole + 1} ${card.players.find(p => p.id === l.playerId)?.name}${l.value > 1 ? ` ×${l.value}` : ''}`);
    return (
      <View>
        <Line header cols={['', 'Player', 'PH', 'Thru', 'Gross', 'Skins']} />
        {order.map((r, i) => <Line key={r.playerId} cols={[i + 1, r.name, r.ph, thru(r.thru), r.gross || '–', sk.won[r.playerId]]} />)}
        <Txt small muted style={{ marginTop: 8 }}>
          {sk.carry ? `${sk.carry} skin(s) carrying over. ` : ''}Won: {won.join(', ') || 'none yet'}
        </Txt>
      </View>
    );
  }

  const sf = card.format === 'stableford';
  const gross = card.format === 'stroke' && card.scoring === 'gross';
  return (
    <View>
      <Line header cols={['', 'Player', 'PH', 'Thru', 'Gross', sf ? 'Pts' : gross ? 'To par' : 'Net']} />
      {lb.map(r => (
        <Line key={r.playerId} cols={[r.thru ? r.pos : '–', r.name, r.ph, thru(r.thru), r.gross || '–',
          !r.thru ? '–' : sf ? r.points : toPar(gross ? r.toParGross : r.toParNet)]} />
      ))}
    </View>
  );
}
