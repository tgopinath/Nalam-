import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { fmtDate } from '../../lib/api';
import { Badge, Button, C, Card, H2, Muted, Screen } from '../../lib/ui';

export default function More() {
  const { user, access, can, signOut, config } = useAuth();
  const items = [
    ['⭐', 'Nalam Premium', '/premium'],
    ['🥗', 'Healthy recipes', '/recipes', 'recipes'],
    ['📚', 'Learn', '/articles', 'articles'],
    ['💬', 'Chat with a coach', '/coach', 'coach'],
    ['🔔', 'Notifications', '/notifications'],
    ['👤', 'Profile & goals', '/profile'],
  ];
  return (
    <Screen>
      <Card>
        <H2>{user?.name || 'Nalam user'}</H2>
        <Muted>{[user?.email, user?.phone].filter(Boolean).join(' · ')}</Muted>
        <Badge label={access?.status === 'premium' ? `⭐ Premium until ${fmtDate(access.premiumUntil)}` : access?.status === 'trial' ? `Free trial · ${access.daysLeft} days left` : access?.status === 'admin' ? 'Admin' : 'Trial ended'}
          color={access?.status === 'premium' ? C.brandDark : '#c2410c'} bg={access?.status === 'premium' ? C.brand100 : '#ffedd5'} />
      </Card>
      <Card style={{ padding: 0 }}>
        {items.map(([ico, label, href, f], i) => (
          <Pressable key={href} onPress={() => router.push(href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: i ? 1 : 0, borderColor: '#f1f5f9' }}>
            <Text style={{ fontSize: 20 }}>{ico}</Text><Text style={{ flex: 1, fontWeight: '600', fontSize: 15 }}>{label}</Text>
            {f && !can(f) ? <Text>🔒</Text> : <Text style={{ color: C.muted }}>›</Text>}
          </Pressable>
        ))}
      </Card>
      {user?.role === 'admin' ? <Muted>Admin tools are in the Nalam web admin panel.</Muted> : null}
      <Muted>Support: {config?.supportEmail}</Muted>
      <View><Button title="Log out" variant="ghost" onPress={signOut} /></View>
    </Screen>
  );
}
