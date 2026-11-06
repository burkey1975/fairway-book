import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { finishRound } from '../../../src/lib/api';
import { confirmAction, showError } from '../../../src/lib/dialogs';
import { cell, FORMATS, holeCount, matchHoles, matchStatus, playingHandicaps, stablefordPoints, strokesOn, type Fairway } from '../../../src/lib/golf';
import { useAuth } from '../../../src/hooks/useAuth';
import { useRound } from '../../../src/hooks/useRound';
import { Btn, C, Card, Chip, Empty, ErrorText, Loading, Row, scoreColor, Stepper, Txt } from '../../../src/ui/kit';

export default function ScoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { round, card, loading, error, setScore, flush } = useRound(id);
  const [hole, setHole] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Open on the first hole someone still needs to score
  useEffect(() => {
    if (!card || hole !== null) return;
    const n = holeCount(card.tee);
    const first = Array.from({ length: n }, (_, h) => h).find(h => card.players.some(p => !cell(card, p.id, h).strokes));
    setHole(first ?? n - 1);
  }, [card, hole]);

  if (loading) return <Loading />;
  if (!round || !card || hole === null) return <Empty text={error ?? 'Round not found.'} />;
  if (round.status === 'done') {
    return (
      <Empty text="This round is finished.">
        <Btn kind="primary" label="Cast player votes" onPress={() => router.replace(`/round/${id}/votes`)} />
        <Btn label="View scorecard" onPress={() => router.replace(`/round/${id}/card`)} />
      </Empty>
    );
  }

  const n = holeCount(card.tee);
  const ph = playingHandicaps(card);
  const par = card.tee.par[hole];
  const isOwner = round.created_by === session?.user.id;
  const h1 = hole + 1; // DB hole number

  const fillPar = (h: number) => card.players.forEach(p => { if (!cell(card, p.id, h).strokes) setScore(p.id, h + 1, { strokes: card.tee.par[h] }); });

  function finish() {
    const missing = card!.players.some(p => Array.from({ length: n }, (_, h) => h).some(h => h !== hole && !cell(card!, p.id, h).strokes));
    confirmAction('Finish round?', missing ? 'Some holes have no score. Finish anyway?' : 'Scores will be locked in and voting opens.', 'Finish', async () => {
      setFinishing(true);
      fillPar(hole!);
      try { await flush(); await finishRound(round!.id); router.replace(`/round/${round!.id}/votes`); }
      catch (e) { showError('Could not finish', e); setFinishing(false); }
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{
        title: round.course_name,
        headerRight: () => <Btn small label="Leaderboard" onPress={() => router.push(`/round/${id}/leaderboard`)} />,
      }} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
        <Card>
          <Row>
            <Btn label="‹" onPress={() => setHole(hole - 1)} disabled={hole === 0} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Txt small muted>HOLE</Txt>
              <Txt bold size={36}>{h1}</Txt>
              <Txt small muted>Par {par} · SI {card.tee.si[hole]}{card.tee.yards[hole] ? ` · ${card.tee.yards[hole]} yds` : ''}</Txt>
            </View>
            <Btn label="›" onPress={() => setHole(hole + 1)} disabled={hole === n - 1} />
          </Row>
          {card.format === 'match' && (() => {
            const result = matchHoles(card).find(m => m.hole === hole);
            const getter = card.players.find((p, i) => strokesOn(ph[i], card.tee.si[hole], n) > 0);
            const holeText = !result ? (getter ? `${getter.name} gets a stroke here` : 'No strokes on this hole')
              : result.winnerId ? `${card.players.find(p => p.id === result.winnerId)?.name} won this hole` : 'Hole halved';
            return (
              <View style={{ alignItems: 'center', marginTop: 8, gap: 2 }}>
                <Txt bold color={C.acc}>{matchStatus(card).text}</Txt>
                <Txt small muted>{holeText}</Txt>
              </View>
            );
          })()}
          <Txt small muted style={{ textAlign: 'center', marginTop: 6 }}>{FORMATS[round.format]} · join code {round.join_code}</Txt>
        </Card>

        <Card>
          {card.players.map((p, i) => {
            const c = cell(card, p.id, hole);
            const rec = strokesOn(ph[i], card.tee.si[hole], n);
            const strokes = c.strokes ?? par;
            return (
              <View key={p.id} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                <Row style={{ marginBottom: 8 }}>
                  <Txt bold style={{ flex: 1 }}>{p.name}{p.userId === session?.user.id ? ' (you)' : ''}</Txt>
                  <Txt small muted>PH {ph[i]}{rec > 0 ? ` ${'●'.repeat(rec)}` : rec < 0 ? ' gives 1' : ''}</Txt>
                  {card.format === 'stableford' && c.strokes ? <Txt small color={C.acc}>{stablefordPoints(par, rec, c.strokes)} pts</Txt> : null}
                </Row>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View>
                    <Txt small muted>Strokes</Txt>
                    <Stepper value={strokes} unset={!c.strokes} color={scoreColor(c.strokes, par)}
                      onPressValue={() => setScore(p.id, h1, { strokes })}
                      onMinus={() => setScore(p.id, h1, { strokes: Math.max(1, strokes - 1) })}
                      onPlus={() => setScore(p.id, h1, { strokes: Math.min(20, strokes + 1) })} />
                  </View>
                  <View>
                    <Txt small muted>Putts</Txt>
                    <Stepper value={c.putts ?? '–'} unset={c.putts == null}
                      onMinus={() => setScore(p.id, h1, { putts: c.putts == null ? 1 : Math.max(0, c.putts - 1) })}
                      onPlus={() => setScore(p.id, h1, { putts: c.putts == null ? 2 : Math.min(c.strokes ?? 10, c.putts + 1) })} />
                  </View>
                </Row>
                {par > 3 && (
                  <Row style={{ marginTop: 10 }}>
                    <Txt small muted style={{ width: 60 }}>Fairway</Txt>
                    {([['L', '← Left'], ['H', 'Hit'], ['R', 'Right →']] as [Fairway, string][]).map(([v, label]) => (
                      <Chip key={v} label={label} on={c.fairway === v}
                        onPress={() => setScore(p.id, h1, { fairway: c.fairway === v ? null : v })} />
                    ))}
                  </Row>
                )}
              </View>
            );
          })}
        </Card>

        <ErrorText>{error}</ErrorText>
        <Row>
          <Btn label="Full card" onPress={() => router.push(`/round/${id}/card`)} style={{ flex: 1 }} />
          {hole < n - 1 ? (
            <Btn kind="primary" label="Next hole ›" style={{ flex: 1 }} onPress={() => { fillPar(hole); setHole(hole + 1); }} />
          ) : isOwner ? (
            <Btn kind="primary" label="Finish round" style={{ flex: 1 }} onPress={finish} busy={finishing} />
          ) : (
            <Btn label="Waiting for organiser to finish" style={{ flex: 1 }} disabled />
          )}
        </Row>
      </ScrollView>
    </View>
  );
}
