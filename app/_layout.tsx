import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
import { C, Loading } from '../src/ui/kit';

function RootStack() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text, contentStyle: { backgroundColor: C.bg },
      headerShadowVisible: false,
    }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="round/new" options={{ title: 'New round' }} />
        <Stack.Screen name="course/new" options={{ title: 'Add course', presentation: 'modal' }} />
        <Stack.Screen name="round/[id]/index" options={{ title: 'Scorecard' }} />
        <Stack.Screen name="round/[id]/leaderboard" options={{ title: 'Leaderboard' }} />
        <Stack.Screen name="round/[id]/card" options={{ title: 'Round' }} />
        <Stack.Screen name="round/[id]/votes" options={{ title: 'Player votes' }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootStack />
    </AuthProvider>
  );
}
