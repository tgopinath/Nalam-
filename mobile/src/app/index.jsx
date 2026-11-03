import { Redirect } from 'expo-router';
import { View, Text } from 'react-native';
import { useAuth } from '../lib/auth';
import { C, Loading } from '../lib/ui';

export default function Index() {
  const { loading, user } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: C.bg }}><Text style={{ textAlign: 'center', fontSize: 32, fontWeight: '800', color: C.brand }}>Nalam</Text><Loading /></View>;
  if (!user) return <Redirect href="/login" />;
  if (!user.onboarded && user.role !== 'admin') return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
