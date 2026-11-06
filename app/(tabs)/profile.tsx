import { useEffect, useState } from 'react';
import { updateProfile } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/hooks/useAuth';
import { Btn, Card, ErrorText, Field, Screen, Txt } from '../../src/ui/kit';

export default function Profile() {
  const { session, profile, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [hi, setHi] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (profile) { setName(profile.display_name); setHi(String(profile.handicap_index)); }
  }, [profile]);

  async function save() {
    const index = parseFloat(hi);
    if (!name.trim()) return setMsg('Enter a name.');
    if (isNaN(index) || index < -10 || index > 54) return setMsg('Handicap index must be between -10 and 54 (use a minus for plus handicaps).');
    setBusy(true); setMsg('');
    try { await updateProfile(session!.user.id, { display_name: name.trim(), handicap_index: index }); await refreshProfile(); setMsg('Saved.'); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  return (
    <Screen>
      <Card title="Your profile">
        <Field label="Display name" value={name} onChangeText={setName} />
        <Field label="Handicap index" value={hi} onChangeText={setHi} keyboardType="numbers-and-punctuation" />
        <Txt small muted style={{ marginBottom: 10 }}>Used for your strokes in new rounds. Rounds already started keep the index they started with.</Txt>
        <ErrorText>{msg !== 'Saved.' ? msg : ''}</ErrorText>
        {msg === 'Saved.' && <Txt small muted>Saved.</Txt>}
        <Btn kind="primary" label="Save" onPress={save} busy={busy} style={{ marginTop: 6 }} />
      </Card>
      <Txt small muted style={{ marginBottom: 10 }}>Signed in as {session?.user.email}</Txt>
      <Btn label="Sign out" kind="danger" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
