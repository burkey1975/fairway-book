import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView } from 'react-native';
import { joinRound, myRounds, peekRound, type FullRound, type PeekResult } from '../../src/lib/api';
import { FORMATS, holeCount } from '../../src/lib/golf';
import { useAuth } from '../../src/hooks/useAuth';
import { Btn, C, Card, Chip, ErrorText, Field, Row, Txt } from '../../src/ui/kit';

export default function Play() {
  const { profile } = useAuth();
  const [live, setLive] = useState<FullRound[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [code, setCode] = useState('');
  const [peek, setPeek] = useState<PeekResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setLive(await myRounds('live')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function lookUp() {
    setBusy(true); setError('');
    try {
      const p = await peekRound(code);
      if (!p) setError('No live round with that code.');
      else if (p.guests.length) setPeek(p);
      else await join();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }
  async function join(claim?: string) {
    setBusy(true); setError('');
    try {
      const id = await joinRound(code, claim);
      setPeek(null); setCode('');
      router.push(`/round/${id}`);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.acc}
        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Txt bold size={22} style={{ marginBottom: 12 }}>G'day{profile ? `, ${profile.display_name}` : ''}</Txt>

      {live.length > 0 && (
        <Card title="Rounds in progress">
          {live.map(r => {
            const done = Math.max(0, ...r.round_players.map(p => r.scores.filter(s => s.player_id === p.id && s.strokes).length));
            return (
              <Pressable key={r.id} onPress={() => router.push(`/round/${r.id}`)}
                style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Row>
                  <Txt bold style={{ flex: 1 }}>{r.course_name}</Txt>
                  <Txt small color={C.acc}>LIVE</Txt>
                </Row>
                <Txt small muted>{FORMATS[r.format]} · {r.round_players.length} players · thru {done}/{holeCount(r.tee)} · code {r.join_code}</Txt>
              </Pressable>
            );
          })}
        </Card>
      )}

      <Btn kind="primary" label="Start a new round" onPress={() => router.push('/round/new')} style={{ marginBottom: 12 }} />

      <Card title="Join a friend's round">
        {!peek ? (
          <Row style={{ alignItems: 'flex-end' }}>
            <Field grow value={code} onChangeText={t => setCode(t.toUpperCase())} placeholder="6-letter code" autoCapitalize="characters"
              maxLength={6} style={{ letterSpacing: 3, fontSize: 18, minWidth: 150 }} />
            <Btn label="Join" onPress={lookUp} busy={busy} disabled={code.length < 6} style={{ marginBottom: 8 }} />
          </Row>
        ) : (
          <>
            <Txt>{peek.course_name} · {FORMATS[peek.format]}</Txt>
            <Txt small muted style={{ marginVertical: 8 }}>Were you added as a guest? Pick your name so your scores count to your stats.</Txt>
            <Row style={{ flexWrap: 'wrap', marginBottom: 10 }}>
              {peek.guests.map(g => <Chip key={g.id} label={`I'm ${g.name}`} onPress={() => join(g.id)} disabled={busy} />)}
            </Row>
            <Row>
              <Btn label="Cancel" onPress={() => setPeek(null)} style={{ flex: 1 }} />
              <Btn kind="primary" label={`Join as ${profile?.display_name ?? 'me'}`} onPress={() => join()} busy={busy} style={{ flex: 1 }} />
            </Row>
          </>
        )}
        <ErrorText>{error}</ErrorText>
      </Card>
    </ScrollView>
  );
}
