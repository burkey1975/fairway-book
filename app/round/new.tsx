import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { courseLabel, createRound, recentCourses, searchCourses, type CourseRow } from '../../src/lib/api';
import { DEFAULT_ALLOWANCE, FORMATS, sum, type Format, type Scoring } from '../../src/lib/golf';
import { useAuth } from '../../src/hooks/useAuth';
import { Btn, C, Card, Chip, ErrorText, Field, Row, Screen, Seg, Txt } from '../../src/ui/kit';

export default function NewRound() {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CourseRow[] | null>(null);
  const [recent, setRecent] = useState<CourseRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [course, setCourse] = useState<CourseRow | null>(null);
  const [teeIdx, setTeeIdx] = useState(0);
  const [format, setFormat] = useState<Format>('stableford');
  const [scoring, setScoring] = useState<Scoring>('net');
  const [allowance, setAllowance] = useState(String(DEFAULT_ALLOWANCE.stableford));
  const [guests, setGuests] = useState<{ name: string; hi: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => { recentCourses().then(setRecent).catch(() => {}); }, []));

  // Debounced course search via the course-search edge function
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setResults(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchCourses(q)); setError(''); }
      catch (e) { setError(`Course search failed: ${e instanceof Error ? e.message : e}`); }
      setSearching(false);
    }, 500);
    return () => clearTimeout(t);
  }, [query]);

  const pick = (c: CourseRow) => { setCourse(c); setTeeIdx(0); setQuery(''); setResults(null); };
  const pickFormat = (f: Format) => { setFormat(f); setAllowance(String(DEFAULT_ALLOWANCE[f])); };

  async function start() {
    if (!course || !profile) return;
    const named = guests.filter(g => g.name.trim());
    if (format === 'match' && named.length > 1) return setError('Match play is singles: you plus one opponent.');
    setBusy(true); setError('');
    try {
      const id = await createRound({
        course, tee: course.tees[teeIdx], format, scoring, allowance: Math.min(100, Math.max(0, parseInt(allowance) || 100)),
        me: profile, guests: named.map(g => ({ name: g.name.trim(), handicap_index: parseFloat(g.hi) || 0 })),
      });
      router.replace(`/round/${id}`);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }

  const list = results ?? recent;
  return (
    <Screen>
      <Card title="Course" right={<Btn small label="+ Manual" onPress={() => router.push('/course/new')} />}>
        {course ? (
          <>
            <Row style={{ marginBottom: 10 }}>
              <Txt bold style={{ flex: 1 }}>{courseLabel(course)}</Txt>
              <Btn small label="Change" onPress={() => setCourse(null)} />
            </Row>
            <Txt small muted style={{ marginBottom: 6 }}>Tee</Txt>
            <Row style={{ flexWrap: 'wrap' }}>
              {course.tees.map((t, i) => (
                <Chip key={i} on={i === teeIdx} onPress={() => setTeeIdx(i)}
                  label={`${t.name}${t.gender === 'F' ? ' (W)' : ''} · ${sum(t.par)} · ${t.rating}/${t.slope}`} />
              ))}
            </Row>
          </>
        ) : (
          <>
            <Field value={query} onChangeText={setQuery} placeholder="Search courses (e.g. Royal Sydney)" autoCorrect={false} />
            {searching && <ActivityIndicator color={C.acc} style={{ marginVertical: 8 }} />}
            {!searching && results?.length === 0 && <Txt small muted>No matches. Try another name or add it manually.</Txt>}
            {!results && recent.length > 0 && <Txt small muted style={{ marginVertical: 4 }}>Recent</Txt>}
            {list.map(c => (
              <Pressable key={c.id} onPress={() => pick(c)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Txt>{courseLabel(c)}</Txt>
                <Txt small muted>{[c.location, `${c.tees.length} tee${c.tees.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</Txt>
              </Pressable>
            ))}
          </>
        )}
      </Card>

      <Card title="Game">
        <Seg options={Object.entries(FORMATS) as [Format, string][]} value={format} onChange={pickFormat} />
        {format === 'stroke' && <><Txt small muted style={{ marginTop: 10, marginBottom: 4 }}>Scoring</Txt>
          <Seg options={[['net', 'Net'], ['gross', 'Gross']]} value={scoring} onChange={setScoring} /></>}
        <Field label="Handicap allowance %" value={allowance} onChangeText={setAllowance} keyboardType="number-pad"
          style={{ width: 90 }} />
        {format === 'match' && <Txt small muted>Singles match play. Your opponent can be a guest or join with the code.</Txt>}
      </Card>

      <Card title="Players">
        <Txt style={{ marginBottom: 8 }}>{profile?.display_name} (you) · HCP {profile?.handicap_index}</Txt>
        {guests.map((g, i) => (
          <Row key={i}>
            <Field grow value={g.name} placeholder="Guest name"
              onChangeText={t => setGuests(gs => gs.map((x, j) => (j === i ? { ...x, name: t } : x)))} />
            <Field value={g.hi} placeholder="HCP" keyboardType="decimal-pad" style={{ width: 70 }}
              onChangeText={t => setGuests(gs => gs.map((x, j) => (j === i ? { ...x, hi: t } : x)))} />
            <Btn small kind="danger" label="✕" onPress={() => setGuests(gs => gs.filter((_, j) => j !== i))} style={{ marginBottom: 8 }} />
          </Row>
        ))}
        {guests.length < 7 && <Btn small label="+ Add guest" onPress={() => setGuests(g => [...g, { name: '', hi: '' }])} />}
        <Txt small muted style={{ marginTop: 10 }}>
          Friends with the app can join with the round code after you tee off. If you added them as a guest, they can claim that spot.
        </Txt>
      </Card>

      <ErrorText>{error}</ErrorText>
      <Btn kind="primary" label="Tee off" onPress={start} busy={busy} disabled={!course || !profile} />
    </Screen>
  );
}
