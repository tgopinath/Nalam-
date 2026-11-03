import { useEffect } from 'react';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { C } from '../lib/ui';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGuard />
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerTintColor: C.text, headerTitleStyle: { fontWeight: '700' }, contentStyle: { backgroundColor: C.bg }, headerShadowVisible: false, headerStyle: { backgroundColor: C.bg } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ title: 'Set up your plan', headerBackVisible: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
          <Stack.Screen name="recipes/index" options={{ title: 'Recipes' }} />
          <Stack.Screen name="recipes/[id]" options={{ title: 'Recipe' }} />
          <Stack.Screen name="articles/index" options={{ title: 'Learn' }} />
          <Stack.Screen name="articles/[id]" options={{ title: 'Article' }} />
          <Stack.Screen name="coach" options={{ title: 'Coach chat' }} />
          <Stack.Screen name="premium" options={{ title: 'Nalam Premium' }} />
          <Stack.Screen name="profile" options={{ title: 'Profile' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/** Sends signed-out users to the login screen, whichever screen they opened (e.g. from a deep link). */
function AuthGuard() {
  const { loading, user } = useAuth();
  const segments = useSegments();
  useEffect(() => {
    if (loading) return;
    const atLogin = segments[0] === 'login';
    if (!user && !atLogin && segments.length) router.replace('/login');
  }, [loading, user, segments]);
  return null;
}
