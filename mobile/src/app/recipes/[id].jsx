import { Text } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { api, img } from '../../lib/api';
import { Card, ErrorText, H1, H2, Loading, Muted, Row, Screen, useApi } from '../../lib/ui';

export default function Recipe() {
  const { id } = useLocalSearchParams();
  const r = useApi(() => api(`/recipes/${id}`), [id]);
  if (r.loading) return <Loading />;
  if (r.error) return <Screen><ErrorText error={r.error} /></Screen>;
  const d = r.data;
  return (
    <Screen>
      <Stack.Screen options={{ title: d.title }} />
      <Image source={{ uri: img(d.image_url) }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16 }} contentFit="cover" />
      <H1>{d.title}</H1>
      <Muted>{d.description}</Muted>
      <Card><Row style={{ justifyContent: 'space-around' }}>{[['kcal', d.calories], ['Protein', `${d.protein_g}g`], ['Carbs', `${d.carbs_g}g`], ['Fat', `${d.fat_g}g`]].map(([l, v]) => <Text key={l} style={{ textAlign: 'center', fontWeight: '800' }}>{v}{'\n'}<Text style={{ fontWeight: '400', color: '#64748b' }}>{l}</Text></Text>)}</Row></Card>
      <Card><H2>Ingredients</H2>{d.ingredients.map((i) => <Text key={i}>• {i}</Text>)}</Card>
      <Card><H2>Method</H2>{d.steps.map((s, i) => <Text key={s} style={{ lineHeight: 22 }}>{i + 1}. {s}</Text>)}</Card>
    </Screen>
  );
}
