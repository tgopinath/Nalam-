import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { api, img, today } from '../../lib/api';
import { Badge, Bar, Button, C, Card, ErrorText, H1, H2, Loading, Locked, Muted, Row, Screen, useApi } from '../../lib/ui';

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams();
  const w = useApi(() => api(`/workouts/${id}`, { silentPaywall: true }), [id]);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(null);

  if (w.loading) return <Loading />;
  if (w.error?.status === 402) return <Screen><Locked label="This workout" /></Screen>;
  if (w.error) return <Screen><ErrorText error={w.error} /></Screen>;
  const d = w.data;

  if (done) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center', padding: 28 }}>
          <Text style={{ fontSize: 64 }}>🏆</Text><H1>Workout complete!</H1>
          <Muted>{d.title} · {done.duration_min} min · {done.calories_burned} kcal burned</Muted>
          <Button title="Back to home" onPress={() => router.replace('/(tabs)')} />
        </Card>
      </Screen>
    );
  }
  if (playing) return <Player workout={d} onExit={() => setPlaying(false)} onDone={setDone} />;

  return (
    <Screen>
      <Stack.Screen options={{ title: d.title }} />
      <Image source={{ uri: img(d.image_url) }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16 }} contentFit="cover" />
      <Row style={{ flexWrap: 'wrap', gap: 6 }}><Badge label={d.category} /><Badge label={d.difficulty} /><Badge label={`⏱ ${d.duration_min} min`} /><Badge label={`🔥 ~${d.calories_est} kcal`} /></Row>
      {d.description ? <Muted>{d.description}</Muted> : null}
      <Button title="▶  Start workout" onPress={() => setPlaying(true)} disabled={!d.exercises.length} />
      <Card>
        <H2>{d.exercises.length} exercises</H2>
        {d.exercises.map((e, i) => (
          <Row key={e.id} style={{ alignItems: 'center' }}>
            <Image source={{ uri: img(e.image_url) }} style={{ width: 72, height: 72, borderRadius: 12 }} contentFit="cover" />
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{i + 1}. {e.name}</Text><Muted>{e.muscle_group}</Muted></View>
            <Badge label={`${e.sets > 1 ? `${e.sets}×` : ''}${e.reps ? `${e.reps}` : `${e.duration_sec}s`}`} color={C.brandDark} bg={C.brand100} />
          </Row>
        ))}
      </Card>
    </Screen>
  );
}

function Player({ workout, onExit, onDone }) {
  const steps = [];
  workout.exercises.forEach((e) => {
    for (let s = 1; s <= e.sets; s++) { steps.push({ type: 'work', ex: e, set: s }); if (e.rest_sec) steps.push({ type: 'rest', ex: e, seconds: e.rest_sec }); }
  });
  if (steps.at(-1)?.type === 'rest') steps.pop();
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(null);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const started = useRef(Date.now());
  const step = steps[idx];
  const timed = step.type === 'rest' || !!step.ex.duration_sec;

  useEffect(() => { setLeft(step.type === 'rest' ? step.seconds : step.ex.duration_sec || null); }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!timed || paused || left == null) return;
    if (left <= 0) { next(); return; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, paused, timed]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = async () => {
    if (idx < steps.length - 1) return setIdx(idx + 1);
    setBusy(true);
    const minutes = Math.max(1, Math.round((Date.now() - started.current) / 60000));
    try { onDone(await api(`/workouts/${workout.id}/complete`, { method: 'POST', body: { duration_min: minutes, date: today() } })); } finally { setBusy(false); }
  };
  const upcoming = steps.slice(idx + 1).find((s) => s.type === 'work');

  return (
    <Screen>
      <Stack.Screen options={{ title: `${idx + 1} / ${steps.length}` }} />
      <Bar value={idx + 1} max={steps.length} />
      <Image source={{ uri: img(step.ex.image_url) }} style={{ width: '100%', aspectRatio: 1, borderRadius: 20, opacity: step.type === 'rest' ? 0.4 : 1 }} contentFit="cover" />
      <View style={{ alignItems: 'center', gap: 8 }}>
        {step.type === 'rest' ? (
          <><Badge label="Rest" color="#0369a1" bg="#e0f2fe" /><Text style={{ fontSize: 56, fontWeight: '800' }}>{left ?? 0}s</Text>{upcoming ? <Muted>Next: {upcoming.ex.name}</Muted> : null}</>
        ) : (
          <>
            <Badge label={`Set ${step.set} of ${step.ex.sets}`} color={C.brandDark} bg={C.brand100} />
            <H1 style={{ textAlign: 'center' }}>{step.ex.name}</H1>
            <Text style={{ fontSize: 56, fontWeight: '800' }}>{step.ex.duration_sec ? `${left ?? step.ex.duration_sec}s` : `× ${step.ex.reps}`}</Text>
            {step.ex.instructions ? <Muted style={{ textAlign: 'center' }}>{step.ex.instructions}</Muted> : null}
          </>
        )}
      </View>
      <Row>
        {idx > 0 ? <Button title="⏮" variant="ghost" onPress={() => setIdx(idx - 1)} /> : null}
        {timed ? <Button title={paused ? '▶' : '⏸'} variant="ghost" onPress={() => setPaused(!paused)} /> : null}
        <Button style={{ flex: 1 }} loading={busy} title={idx === steps.length - 1 ? 'Finish 🎉' : step.type === 'rest' ? 'Skip rest' : timed ? 'Next ⏭' : 'Done ✓'} onPress={next} />
      </Row>
      <Button title="Exit workout" variant="ghost" onPress={onExit} />
    </Screen>
  );
}
