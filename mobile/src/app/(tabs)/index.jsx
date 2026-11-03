import { useCallback, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { api, img, today } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Badge, Bar, Button, C, Card, ErrorText, Field, H1, H2, Loading, Muted, Row, Screen, useApi } from '../../lib/ui';

const MOODS = ['😞', '😕', '😐', '🙂', '😄'];

export default function Home() {
  const { user, access, can, config } = useAuth();
  const dash = useApi(() => api(`/me/dashboard?date=${today()}`), []);
  const workouts = useApi(() => api('/workouts'), []);
  const [modal, setModal] = useState(null);
  useFocusEffect(useCallback(() => { dash.reload(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const d = dash.data;
  const addWater = async (ml) => { const r = await api('/water', { method: 'POST', body: { amount_ml: ml, date: today() } }); dash.setData({ ...d, water_ml: r.total_ml }); };
  const gated = (f, k) => () => (can(f) ? setModal(k) : router.push('/premium'));
  const LEVEL = { beginner: 0, intermediate: 1, advanced: 2 };
  const suggestion = workouts.data?.filter((w) => !w.locked).sort((a, b) => LEVEL[a.difficulty] - LEVEL[b.difficulty])[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <Screen onRefresh={dash.reload} refreshing={dash.loading && !!d}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <H1>Vanakkam, {user?.name?.split(' ')[0] || 'friend'} 👋</H1>
            <Muted>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Muted>
          </View>
          <Pressable onPress={() => router.push('/notifications')} style={{ padding: 8 }}><Text style={{ fontSize: 22 }}>🔔</Text></Pressable>
        </Row>
        {config?.announcement ? <Card style={{ backgroundColor: '#eff6ff' }}><Text>📣 {config.announcement}</Text></Card> : null}
        <AccessBanner access={access} />
        {!d ? (dash.error ? <ErrorText error={dash.error} /> : <Loading />) : (
          <>
            <Card>
              <Row style={{ justifyContent: 'space-between' }}><H2>Calories</H2><Badge label={`🔥 ${d.streak}-day streak`} color="#c2410c" bg="#ffedd5" /></Row>
              {d.food ? (
                <>
                  <Row style={{ justifyContent: 'space-around' }}>
                    <Stat label="Eaten" v={Math.round(d.food.calories)} /><Stat label="Left" v={Math.max(0, (d.targets.calories || 0) - Math.round(d.food.calories) + d.burned)} big /><Stat label="Burned" v={d.burned} />
                  </Row>
                  <Bar value={d.food.calories} max={(d.targets.calories || 2000) + d.burned} />
                  {[['Protein', d.food.protein, d.targets.protein, C.violet], ['Carbs', d.food.carbs, d.targets.carbs, C.amber], ['Fat', d.food.fat, d.targets.fat, C.blue]].map(([l, v, m, c]) => (
                    <View key={l} style={{ gap: 4 }}><Row style={{ justifyContent: 'space-between' }}><Muted>{l}</Muted><Muted>{Math.round(v)} / {m || '—'} g</Muted></Row><Bar value={v} max={m} color={c} /></View>
                  ))}
                  <Button title="+ Log food" variant="soft" onPress={() => router.push('/food')} />
                </>
              ) : <Button title="🔒 Unlock calorie tracking" onPress={() => router.push('/premium')} />}
            </Card>

            <Card>
              <Row style={{ justifyContent: 'space-between' }}><H2>💧 Water</H2><Muted>{(d.water_ml / 1000).toFixed(2)} / {(d.targets.water_ml / 1000).toFixed(1)} L</Muted></Row>
              <Bar value={d.water_ml} max={d.targets.water_ml} color={C.blue} />
              <Row>
                <Button title="−" variant="soft" onPress={() => addWater(-250)} disabled={!d.water_ml} />
                <Button title="+ 1 glass" variant="blue" onPress={() => addWater(250)} style={{ flex: 1 }} />
                <Button title="+500" variant="soft" onPress={() => addWater(500)} />
              </Row>
            </Card>

            <Row style={{ flexWrap: 'wrap', gap: 12 }}>
              <Tile ico="👟" label="Steps" value={d.steps == null ? '🔒' : d.steps.toLocaleString('en-IN')} sub={`Goal ${d.targets.steps}`} onPress={gated('steps', 'steps')} />
              <Tile ico="😴" label="Sleep" value={d.sleep ? `${d.sleep.hours} h` : can('sleep') ? '—' : '🔒'} sub="Tap to log" onPress={gated('sleep', 'sleep')} />
              <Tile ico={d.mood ? MOODS[d.mood.mood - 1] : '🙂'} label="Mood" value={d.mood ? ['Low', 'Meh', 'Okay', 'Good', 'Great'][d.mood.mood - 1] : can('sleep') ? '—' : '🔒'} sub="How do you feel?" onPress={gated('sleep', 'mood')} />
              <Tile ico="⚖️" label="Weight" value={d.weights.length ? `${d.weights.at(-1).weight_kg} kg` : '—'} sub="Tap to update" onPress={() => setModal('weight')} />
            </Row>

            {d.workouts?.length ? (
              <Card><H2>Today's activity</H2>{d.workouts.map((w, i) => <Row key={i} style={{ justifyContent: 'space-between' }}><Text>✅ {w.title}</Text><Muted>{w.duration_min} min · {w.calories_burned} kcal</Muted></Row>)}</Card>
            ) : suggestion ? (
              <Pressable onPress={() => router.push(`/workout/${suggestion.id}`)}>
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  <Image source={{ uri: img(suggestion.image_url) }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" transition={200} />
                  <View style={{ padding: 14 }}><H2>Suggested: {suggestion.title}</H2><Muted>{suggestion.duration_min} min · {suggestion.difficulty}</Muted></View>
                </Card>
              </Pressable>
            ) : null}
          </>
        )}
      </Screen>
      {modal ? <QuickLog kind={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); dash.reload(); }} /> : null}
    </SafeAreaView>
  );
}

const Stat = ({ label, v, big }) => (
  <View style={{ alignItems: 'center' }}><Text style={{ fontSize: big ? 30 : 20, fontWeight: '800', color: big ? C.brandDark : C.text }}>{v}</Text><Muted>{big ? 'kcal left' : label}</Muted></View>
);

const Tile = ({ ico, label, value, sub, onPress }) => (
  <Pressable onPress={onPress} style={{ width: '47.8%' }}>
    <Card><Text style={{ fontSize: 24 }}>{ico}</Text><Muted>{label}</Muted><Text style={{ fontSize: 20, fontWeight: '800' }}>{value}</Text><Muted style={{ fontSize: 12 }}>{sub}</Muted></Card>
  </Pressable>
);

function AccessBanner({ access }) {
  if (!access || access.status === 'premium' || access.status === 'admin') return null;
  if (access.status === 'trial' && access.daysLeft > 3) return <Badge label={`🎁 Free trial · ${access.daysLeft} days left`} color="#c2410c" bg="#ffedd5" />;
  return (
    <Card style={{ backgroundColor: access.status === 'trial' ? '#fff7ed' : '#fef2f2' }}>
      <H2>{access.status === 'trial' ? `Your trial ends in ${access.daysLeft} day${access.daysLeft === 1 ? '' : 's'}` : 'Your free trial has ended'}</H2>
      <Muted>Subscribe monthly or yearly to keep every feature.</Muted>
      <Button title="See plans" variant="orange" onPress={() => router.push('/premium')} />
    </Card>
  );
}

function QuickLog({ kind, onClose, onSaved }) {
  const [v, setV] = useState({ steps: '', hours: '', quality: 3, mood: 4, weight_kg: '' });
  const [error, setError] = useState(null);
  const save = async () => {
    try {
      const body = { steps: { steps: v.steps }, sleep: { hours: v.hours, quality: v.quality }, mood: { mood: v.mood }, weight: { weight_kg: v.weight_kg } }[kind];
      await api(`/${kind}`, { method: 'PUT', body: { ...body, date: today() } });
      onSaved();
    } catch (e) { setError(e); }
  };
  const Scale = ({ items, k }) => <Row>{items.map((m, i) => <Pressable key={m} onPress={() => setV({ ...v, [k]: i + 1 })} style={{ padding: 8, borderRadius: 12, borderWidth: 2, borderColor: v[k] === i + 1 ? C.brand : 'transparent', backgroundColor: '#f8fafc' }}><Text style={{ fontSize: 26 }}>{m}</Text></Pressable>)}</Row>;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0f172a66' }} onPress={onClose} />
      <View style={{ backgroundColor: '#fff', padding: 20, gap: 14, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
        <H2>{{ steps: '👟 Log steps', sleep: '😴 Log sleep', mood: '🙂 How are you feeling?', weight: '⚖️ Log weight' }[kind]}</H2>
        {kind === 'steps' ? <Field label="Steps today" value={v.steps} onChangeText={(t) => setV({ ...v, steps: t })} keyboardType="number-pad" autoFocus /> : null}
        {kind === 'weight' ? <Field label="Weight (kg)" value={v.weight_kg} onChangeText={(t) => setV({ ...v, weight_kg: t })} keyboardType="decimal-pad" autoFocus /> : null}
        {kind === 'sleep' ? <><Field label="Hours slept" value={v.hours} onChangeText={(t) => setV({ ...v, hours: t })} keyboardType="decimal-pad" autoFocus /><Muted>Quality</Muted><Scale items={['😫', '😪', '😐', '😌', '🤩']} k="quality" /></> : null}
        {kind === 'mood' ? <Scale items={MOODS} k="mood" /> : null}
        <ErrorText error={error} />
        <Button title="Save" onPress={save} />
      </View>
    </Modal>
  );
}
