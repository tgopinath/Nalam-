import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { api, img } from '../../lib/api';
import { Badge, C, Card, Chip, ErrorText, H2, Loading, Muted, Row, Screen, useApi } from '../../lib/ui';

const CATS = ['all', 'strength', 'cardio', 'hiit', 'yoga', 'stretching'];

export default function Workouts() {
  const [cat, setCat] = useState('all');
  const list = useApi(() => api(`/workouts${cat !== 'all' ? `?category=${cat}` : ''}`), [cat]);
  return (
    <Screen onRefresh={list.reload}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {CATS.map((c) => <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} />)}
      </ScrollView>
      <ErrorText error={list.error} />
      {!list.data ? <Loading /> : list.data.map((w) => (
        <Pressable key={w.id} onPress={() => router.push(`/workout/${w.id}`)}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <View>
              <Image source={{ uri: img(w.image_url) }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" transition={200} />
              {w.locked ? <View style={{ position: 'absolute', top: 10, right: 10 }}><Badge label="🔒 Premium" color="#fff" bg="#0f172acc" /></View>
                : !w.is_premium ? <View style={{ position: 'absolute', top: 10, right: 10 }}><Badge label="Free" color="#fff" bg={C.brand} /></View> : null}
            </View>
            <View style={{ padding: 14, gap: 6 }}>
              <H2>{w.title}</H2>
              <Row style={{ flexWrap: 'wrap', gap: 6 }}>
                <Badge label={w.difficulty} /><Badge label={`⏱ ${w.duration_min} min`} /><Badge label={`🔥 ${w.calories_est} kcal`} /><Badge label={`${w.exercise_count} exercises`} />
              </Row>
            </View>
          </Card>
        </Pressable>
      ))}
      {list.data && !list.data.length ? <Muted>No workouts here yet.</Muted> : null}
    </Screen>
  );
}
