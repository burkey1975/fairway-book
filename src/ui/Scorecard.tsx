import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { cell, holeCount, playingHandicaps, range, strokesOn, sum, type Card } from '../lib/golf';
import { C, scoreColor } from './kit';

const W = 30;
const Cell = ({ children, color, w = W, bold, first }: { children: ReactNode; color?: string; w?: number; bold?: boolean; first?: boolean }) => (
  <View style={{ width: w, paddingVertical: 6, alignItems: first ? 'flex-start' : 'center' }}>
    <Text style={{ color: color ?? C.text, fontSize: 13, fontWeight: bold ? '700' : '400' }} numberOfLines={1}>{children}</Text>
  </View>
);

export function Scorecard({ card }: { card: Card }) {
  const n = holeCount(card.tee);
  const ph = playingHandicaps(card);
  const halves: [number, number, string][] = n === 18 ? [[0, 9, 'Out'], [9, 18, 'In']] : [[0, n, 'Tot']];
  return (
    <View style={{ gap: 10 }}>
      {halves.map(([a, b, label]) => (
        <ScrollView horizontal key={label}>
          <View>
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Cell first w={70} color={C.mute}>Hole</Cell>
              {range(a, b).map(h => <Cell key={h} color={C.mute}>{h + 1}</Cell>)}
              <Cell w={40} color={C.mute}>{label}</Cell>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Cell first w={70} color={C.mute}>Par</Cell>
              {range(a, b).map(h => <Cell key={h} color={C.mute}>{card.tee.par[h]}</Cell>)}
              <Cell w={40} color={C.mute}>{sum(card.tee.par.slice(a, b))}</Cell>
            </View>
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Cell first w={70} color={C.mute}>SI</Cell>
              {range(a, b).map(h => <Cell key={h} color={C.mute}>{card.tee.si[h]}</Cell>)}
              <Cell w={40}>{''}</Cell>
            </View>
            {card.players.map((p, i) => {
              const strokes = range(a, b).map(h => cell(card, p.id, h).strokes);
              return (
                <View key={p.id} style={{ flexDirection: 'row' }}>
                  <Cell first w={70}>{p.name.split(' ')[0]}</Cell>
                  {range(a, b).map((h, k) => {
                    const rec = strokesOn(ph[i], card.tee.si[h], n);
                    return <Cell key={h} color={scoreColor(strokes[k], card.tee.par[h])}>
                      {strokes[k] ?? '·'}{rec > 0 ? '•'.repeat(rec) : ''}
                    </Cell>;
                  })}
                  <Cell w={40} bold>{sum(strokes) || ''}</Cell>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ))}
      <Text style={{ color: C.mute, fontSize: 11 }}>• = handicap stroke received</Text>
    </View>
  );
}
