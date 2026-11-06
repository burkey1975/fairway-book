import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { supabase } from '../src/lib/supabase';
import { Btn, C, ErrorText, Field, Txt } from '../src/ui/kit';

// Email one-time code sign-in: no passwords, no deep-link setup.
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    setBusy(true); setError('');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  }
  async function verify() {
    setBusy(true); setError('');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(error.message); // on success the root layout switches to the app
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', padding: 24 }}>
      <Txt bold size={30}>Fairway Book</Txt>
      <Txt muted style={{ marginBottom: 28 }}>Score, compete and vote with your golf group.</Txt>
      {!sent ? (
        <View>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
            autoComplete="email" placeholder="you@example.com" />
          <ErrorText>{error}</ErrorText>
          <Btn kind="primary" label="Email me a code" onPress={send} busy={busy} disabled={!email.includes('@')} />
        </View>
      ) : (
        <View>
          <Txt muted small style={{ marginBottom: 10 }}>We sent a sign-in code to {email}.</Txt>
          <Field label="Code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code"
            maxLength={10} placeholder="123456" />
          <ErrorText>{error}</ErrorText>
          <Btn kind="primary" label="Sign in" onPress={verify} busy={busy} disabled={code.trim().length < 6} />
          <Btn label="Use a different email" onPress={() => { setSent(false); setCode(''); }} style={{ marginTop: 10 }} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
