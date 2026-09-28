import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ConnectionProvider } from '../state/connection';
import { useTheme } from '../theme';

export default function RootLayout() {
  const c = useTheme();
  return (
    <ConnectionProvider>
      <StatusBar style={c.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
    </ConnectionProvider>
  );
}
