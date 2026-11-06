import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';

export const C = {
  bg: '#0f1a14', card: '#17261d', card2: '#1e3226', input: '#0e1812', line: '#2a4334',
  text: '#eef5ef', mute: '#9db5a5', acc: '#4ade80', acc2: '#22c55e', warn: '#f59e0b', bad: '#f87171', blue: '#60a5fa',
};

export function scoreColor(strokes: number | null | undefined, par: number) {
  if (!strokes) return C.mute;
  const d = strokes - par;
  return d <= -2 ? C.blue : d === -1 ? '#93c5fd' : d === 0 ? C.text : d === 1 ? C.warn : C.bad;
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  if (!scroll) return <View style={[s.screen, s.pad]}>{children}</View>;
  return <ScrollView style={s.screen} contentContainerStyle={[s.pad, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}

export function Card({ title, right, children, style }: { title?: string; right?: ReactNode; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.card, style]}>
      {(title || right) && <Row style={{ marginBottom: 10 }}><Txt bold style={{ flex: 1, fontSize: 16 }}>{title}</Txt>{right}</Row>}
      {children}
    </View>
  );
}

export function Txt({ children, muted, small, bold, size, color, style }: {
  children?: ReactNode; muted?: boolean; small?: boolean; bold?: boolean; size?: number; color?: string; style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[{ color: color ?? (muted ? C.mute : C.text), fontSize: size ?? (small ? 12 : 15) }, bold && { fontWeight: '700' }, style]}>
      {children}
    </Text>
  );
}

export const Row = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) =>
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;

export function Btn({ label, onPress, kind = 'default', disabled, small, busy, style }: {
  label: string; onPress?: () => void; kind?: 'default' | 'primary' | 'danger'; disabled?: boolean; small?: boolean; busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const primary = kind === 'primary';
  return (
    <Pressable onPress={onPress} disabled={disabled || busy}
      style={({ pressed }) => [s.btn, primary && s.btnPri, small && s.btnSm, (disabled || busy) && { opacity: 0.4 }, pressed && { opacity: 0.7 }, style]}>
      {busy ? <ActivityIndicator color={primary ? '#05220f' : C.text} />
        : <Text style={{ color: primary ? '#05220f' : kind === 'danger' ? C.bad : C.text, fontWeight: primary ? '700' : '500', fontSize: small ? 13 : 15 }}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, grow, style, ...props }: TextInputProps & { label?: string; grow?: boolean }) {
  return (
    <View style={[{ marginBottom: 8, flexShrink: 1 }, grow && { flex: 1 }]}>
      {label && <Txt small muted style={{ marginBottom: 4 }}>{label}</Txt>}
      <TextInput placeholderTextColor="#5f7a68" style={[s.input, style]} {...props} />
    </View>
  );
}

export function Seg<T extends string | number>({ options, value, onChange }: {
  options: [T, string][]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={s.seg}>
      {options.map(([v, label]) => (
        <Pressable key={String(v)} onPress={() => onChange(v)} style={[s.segBtn, v === value && { backgroundColor: C.card2 }]}>
          <Text style={{ color: v === value ? C.text : C.mute, fontSize: 13 }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Chip({ label, on, onPress, disabled }: { label: string; on?: boolean; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={[s.chip, on && { borderColor: C.acc2, backgroundColor: C.card2 }, disabled && { opacity: 0.3 }]}>
      <Text style={{ color: on ? C.text : C.mute, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Stepper({ value, unset, color, onMinus, onPlus, onPressValue }: {
  value: string | number; unset?: boolean; color?: string; onMinus: () => void; onPlus: () => void; onPressValue?: () => void;
}) {
  return (
    <Row style={{ gap: 6 }}>
      <Pressable style={s.step} onPress={onMinus}><Text style={s.stepTxt}>−</Text></Pressable>
      <Pressable onPress={onPressValue} style={{ minWidth: 42, alignItems: 'center' }}>
        <Text style={{ fontSize: 26, fontWeight: unset ? '400' : '700', color: unset ? C.mute : color ?? C.text }}>{value}</Text>
      </Pressable>
      <Pressable style={s.step} onPress={onPlus}><Text style={s.stepTxt}>+</Text></Pressable>
    </Row>
  );
}

export function Empty({ text, children }: { text: string; children?: ReactNode }) {
  return <View style={{ alignItems: 'center', padding: 32, gap: 14 }}><Txt muted style={{ textAlign: 'center' }}>{text}</Txt>{children}</View>;
}

export const Loading = () => <View style={[s.screen, { justifyContent: 'center' }]}><ActivityIndicator color={C.acc} /></View>;

export function ErrorText({ children }: { children?: ReactNode }) {
  return children ? <Txt small color={C.bad} style={{ marginVertical: 6 }}>{children}</Txt> : null;
}

export function Stat({ value, label }: { value: string | number | null; label: string }) {
  return (
    <View style={s.stat}>
      <Txt bold size={20}>{value ?? '–'}</Txt>
      <Txt small muted style={{ textAlign: 'center' }}>{label}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 14 },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  btn: { backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btnPri: { backgroundColor: C.acc2, borderColor: C.acc2 },
  btnSm: { paddingVertical: 7, paddingHorizontal: 10 },
  input: { backgroundColor: C.input, color: C.text, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 15 },
  seg: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.input, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 3, gap: 3 },
  segBtn: { flexGrow: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8 },
  chip: { borderColor: C.line, borderWidth: 1, backgroundColor: C.input, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10 },
  step: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: C.text, fontSize: 22 },
  stat: { flexBasis: '31%', flexGrow: 1, backgroundColor: C.input, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
});
