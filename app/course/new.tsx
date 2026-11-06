import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { createCourse } from '../../src/lib/api';
import { range, type Tee } from '../../src/lib/golf';
import { Btn, C, Card, ErrorText, Field, Row, Screen, Seg, Txt } from '../../src/ui/kit';

const blank = (n: number) => ({ par: Array(n).fill('4'), si: range(1, n + 1).map(String), yards: Array(n).fill('') });

/** For courses GolfCourseAPI doesn't have. One tee; add more by entering the course again with another tee name. */
export default function NewCourse() {
  const [club, setClub] = useState('');
  const [location, setLocation] = useState('');
  const [teeName, setTeeName] = useState('White');
  const [rating, setRating] = useState('');
  const [slope, setSlope] = useState('113');
  const [holes, setHoles] = useState<9 | 18>(18);
  const [grid, setGrid] = useState(blank(18));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setCell = (k: 'par' | 'si' | 'yards', i: number, v: string) =>
    setGrid(g => ({ ...g, [k]: g[k].map((x, j) => (j === i ? v.replace(/[^0-9]/g, '') : x)) }));

  async function save() {
    const par = grid.par.map(Number), si = grid.si.map(Number), yards = grid.yards.map(y => Number(y) || 0);
    if (!club.trim()) return setError('Enter the course name.');
    if (par.some(p => p < 3 || p > 6)) return setError('Each par must be 3–6.');
    if ([...si].sort((a, b) => a - b).join() !== range(1, holes + 1).join()) return setError(`Stroke indexes must use 1–${holes} once each.`);
    const parTotal = par.reduce((a, b) => a + b, 0);
    const tee: Tee = { name: teeName.trim() || 'Tee', rating: parseFloat(rating) || parTotal, slope: parseInt(slope) || 113, par, si, yards };
    setBusy(true); setError('');
    try {
      await createCourse({ club_name: club.trim(), course_name: null, location: location.trim() || null, tees: [tee] });
      router.back();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }

  const input = { backgroundColor: C.input, color: C.text, borderColor: C.line, borderWidth: 1, borderRadius: 8, padding: 6, textAlign: 'center' as const };
  return (
    <Screen>
      <Card>
        <Field label="Course name" value={club} onChangeText={setClub} placeholder="e.g. Moore Park Golf" />
        <Field label="Location (optional)" value={location} onChangeText={setLocation} />
        <Row>
          <Field grow label="Tee" value={teeName} onChangeText={setTeeName} />
          <Field label="Rating" value={rating} onChangeText={setRating} keyboardType="decimal-pad" placeholder="e.g. 71.2" style={{ width: 80 }} />
          <Field label="Slope" value={slope} onChangeText={setSlope} keyboardType="number-pad" style={{ width: 70 }} />
        </Row>
        <Txt small muted style={{ marginBottom: 4 }}>Holes</Txt>
        <Seg options={[[9, '9 holes'], [18, '18 holes']]} value={holes} onChange={n => { setHoles(n); setGrid(blank(n)); }} />
      </Card>
      <Card title="Holes">
        <Row style={{ marginBottom: 4 }}>
          {['Hole', 'Par', 'SI', 'Length'].map(h => <Txt key={h} small muted style={{ flex: 1, textAlign: 'center' }}>{h}</Txt>)}
        </Row>
        {range(0, holes).map(i => (
          <Row key={i} style={{ marginBottom: 6 }}>
            <Txt style={{ flex: 1, textAlign: 'center' }}>{i + 1}</Txt>
            {(['par', 'si', 'yards'] as const).map(k => (
              <View key={k} style={{ flex: 1 }}>
                <TextInput value={grid[k][i]} onChangeText={v => setCell(k, i, v)} keyboardType="number-pad" style={input} />
              </View>
            ))}
          </Row>
        ))}
      </Card>
      <ErrorText>{error}</ErrorText>
      <Btn kind="primary" label="Save course" onPress={save} busy={busy} />
    </Screen>
  );
}
