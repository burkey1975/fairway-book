import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { C } from '../../src/ui/kit';

type Icon = ComponentProps<typeof Ionicons>['name'];
const tab = (title: string, icon: Icon) => ({
  title,
  tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name={icon} color={color} size={size} />,
});

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text, headerShadowVisible: false,
      tabBarStyle: { backgroundColor: '#0b140f', borderTopColor: C.line },
      tabBarActiveTintColor: C.acc, tabBarInactiveTintColor: C.mute,
      sceneStyle: { backgroundColor: C.bg },
    }}>
      <Tabs.Screen name="index" options={tab('Play', 'golf-outline')} />
      <Tabs.Screen name="rounds" options={tab('Rounds', 'time-outline')} />
      <Tabs.Screen name="stats" options={tab('Stats', 'stats-chart-outline')} />
      <Tabs.Screen name="votes" options={tab('Votes', 'star-outline')} />
      <Tabs.Screen name="profile" options={tab('Profile', 'person-outline')} />
    </Tabs>
  );
}
