import { Alert, Platform } from 'react-native';

// React Native's Alert ignores buttons in the web build, so use the browser's dialogs there.
const browser = globalThis as unknown as { confirm(m: string): boolean; alert(m: string): void };

export function confirmAction(title: string, message: string, okLabel: string, onOk: () => void, destructive = false) {
  if (Platform.OS === 'web') {
    if (browser.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: okLabel, style: destructive ? 'destructive' : 'default', onPress: onOk },
  ]);
}

export function showError(title: string, e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  if (Platform.OS === 'web') browser.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}
