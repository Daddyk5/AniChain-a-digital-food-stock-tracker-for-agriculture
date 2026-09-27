import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AlertBanner } from '@/components/AlertBanner';
import { LiveProvider } from '@/components/LiveProvider';
import { Colors } from '@/constants/theme';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.background,
    card: Colors.background,
    border: Colors.border,
    text: Colors.text,
    primary: Colors.accent,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
      <ThemeProvider value={theme}>
        <LiveProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerTintColor: Colors.text, headerShadowVisible: false }}>
            <Stack.Screen name="index" options={{ title: 'AniChain · Davao' }} />
            <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="commodity/[id]" options={{ title: '' }} />
            <Stack.Screen name="admin" options={{ title: 'Manual price entry', presentation: 'modal' }} />
          </Stack>
          <AlertBanner />
        </LiveProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
