import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors, type } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontSize: type.subtitle.fontSize, fontWeight: '700' },
          headerBackTitle: 'Back',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Sharing', headerLargeTitle: true }} />
        <Stack.Screen name="ride/now" options={{ title: 'Ride now' }} />
        <Stack.Screen name="ride/later" options={{ title: 'Book for later' }} />
        <Stack.Screen name="pass/index" options={{ title: 'Your pass' }} />
        <Stack.Screen
          name="pass/skip"
          options={{ title: 'Skip a ride', presentation: 'modal' }}
        />
        <Stack.Screen name="board" options={{ title: 'Board your rickshaw' }} />
        <Stack.Screen name="driver/index" options={{ title: 'Driver' }} />
        <Stack.Screen name="driver/fuel" options={{ title: 'Log fuel' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
