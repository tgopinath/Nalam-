import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { api, img } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Badge, Card, Chip, H2, Loading, Locked, Row, Screen, useApi } from '../../lib/ui';

export default function Recipes() {
  const { can, loading } = useAuth();
  const [meal, setMeal] = useState('');
  const list = useApi(() => (can('recipes') ? api(`/recipes?meal=${meal}`, { silentPaywall: true }) : null), [meal, can('recipes')]);
  if (loading) return <Loading />;
  if (!can('recipes')) return <Screen><Locked label="Healthy recipes" /></Screen>;
  return (
    <Screen>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {['', 'breakfast', 'lunch', 'snacks', 'dinner'].map((m) => <Chip key={m} label={m || 'all'} active={meal === m} onPress={() => setMeal(m)} />)}
      </ScrollView>
      {!list.data ? <Loading /> : list.data.map((r) => (
        <Pressable key={r.id} onPress={() => router.push(`/recipes/${r.id}`)}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <Image source={{ uri: img(r.image_url) }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" />
            <View style={{ padding: 14, gap: 6 }}><H2>{r.title}</H2><Row><Badge label={`${r.calories} kcal`} /><Badge label={`⏱ ${r.prep_min} min`} /></Row></View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
