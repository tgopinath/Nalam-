import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { api, img } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Card, H2, Loading, Locked, Muted, Screen, useApi } from '../../lib/ui';

export default function Articles() {
  const { can, loading } = useAuth();
  const list = useApi(() => (can('articles') ? api('/articles', { silentPaywall: true }) : null), [can('articles')]);
  if (loading) return <Loading />;
  if (!can('articles')) return <Screen><Locked label="Health articles" /></Screen>;
  return (
    <Screen>
      {!list.data ? <Loading /> : list.data.map((a) => (
        <Pressable key={a.id} onPress={() => router.push(`/articles/${a.id}`)}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <Image source={{ uri: img(a.image_url) }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" />
            <View style={{ padding: 14, gap: 4 }}><H2>{a.title}</H2><Muted>{a.summary}</Muted></View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
