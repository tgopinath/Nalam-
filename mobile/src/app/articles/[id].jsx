import { Text } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { api, fmtDate, img } from '../../lib/api';
import { ErrorText, H1, Loading, Muted, Screen, useApi } from '../../lib/ui';

export default function Article() {
  const { id } = useLocalSearchParams();
  const a = useApi(() => api(`/articles/${id}`), [id]);
  if (a.loading) return <Loading />;
  if (a.error) return <Screen><ErrorText error={a.error} /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: a.data.category }} />
      <Image source={{ uri: img(a.data.image_url) }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16 }} contentFit="cover" />
      <H1>{a.data.title}</H1>
      <Muted>{fmtDate(a.data.created_at)}</Muted>
      <Text style={{ fontSize: 16, lineHeight: 26 }}>{a.data.body}</Text>
    </Screen>
  );
}
