import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Bar, Button, C, Card, Chip, ErrorText, Field, H1, H2, Muted, Row, Screen } from '../lib/ui';

const Option = ({ label, sub, active, onPress }) => (
  <Pressable onPress={onPress} style={{ borderWidth: 2, borderColor: active ? C.brand : C.line, backgroundColor: active ? C.brand50 : '#fff', borderRadius: 16, padding: 14 }}>
    <Text style={{ fontWeight: '700', fontSize: 15 }}>{label}</Text>{sub ? <Muted>{sub}</Muted> : null}
  </Pressable>
);

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: user?.name || '', gender: '', dob: '', height_cm: '', weight_kg: '', target_weight_kg: '', activity_level: 'light', goal: 'lose', diet_pref: 'veg' });
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const steps = [
    ["What's your goal?", !!f.goal, <View style={{ gap: 10 }}>{[['lose', '🔥 Lose weight'], ['maintain', '⚖️ Stay fit'], ['gain', '💪 Gain muscle']].map(([v, l]) => <Option key={v} label={l} active={f.goal === v} onPress={() => set('goal')(v)} />)}</View>],
    ['About you', f.name && f.gender && /^\d{4}-\d{2}-\d{2}$/.test(f.dob), (
      <View style={{ gap: 12 }}>
        <Field label="Name" value={f.name} onChangeText={set('name')} />
        <Text style={{ fontWeight: '600', color: '#334155' }}>Gender</Text>
        <Row>{['male', 'female', 'other'].map((g) => <Chip key={g} label={g} active={f.gender === g} onPress={() => set('gender')(g)} />)}</Row>
        <Field label="Date of birth (YYYY-MM-DD)" value={f.dob} onChangeText={set('dob')} placeholder="1994-03-14" keyboardType="numbers-and-punctuation" maxLength={10} />
      </View>
    )],
    ['Your body', f.height_cm && f.weight_kg && f.target_weight_kg, (
      <View style={{ gap: 12 }}>
        <Field label="Height (cm)" value={f.height_cm} onChangeText={set('height_cm')} keyboardType="decimal-pad" />
        <Field label="Current weight (kg)" value={f.weight_kg} onChangeText={set('weight_kg')} keyboardType="decimal-pad" />
        <Field label="Target weight (kg)" value={f.target_weight_kg} onChangeText={set('target_weight_kg')} keyboardType="decimal-pad" />
      </View>
    )],
    ['How active are you?', true, <View style={{ gap: 10 }}>{[['sedentary', 'Sedentary', 'Desk job, little exercise'], ['light', 'Lightly active', '1-3 days/week'], ['moderate', 'Moderately active', '3-5 days/week'], ['active', 'Very active', '6-7 days/week'], ['very_active', 'Athlete', 'Physical job / 2x training']].map(([v, l, d]) => <Option key={v} label={l} sub={d} active={f.activity_level === v} onPress={() => set('activity_level')(v)} />)}</View>],
    ['Food preference', true, <View style={{ gap: 10 }}>{[['veg', '🥦 Vegetarian'], ['non_veg', '🍗 Non-veg'], ['eggetarian', '🥚 Eggetarian'], ['vegan', '🌱 Vegan']].map(([v, l]) => <Option key={v} label={l} active={f.diet_pref === v} onPress={() => set('diet_pref')(v)} />)}</View>],
  ];

  const next = async () => {
    if (step < steps.length - 1) return setStep(step + 1);
    setBusy(true); setError(null);
    try { const r = await api('/me/profile', { method: 'PATCH', body: f }); setUser(r.user); setDone(r.user); } catch (e) { setError(e); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 48 }}>🎯</Text>
          <H1>Your daily plan</H1>
          {[['Calories', `${done.calorie_target} kcal`], ['Protein', `${done.protein_g} g`], ['Water', `${(done.water_target_ml / 1000).toFixed(1)} L`], ['BMI', `${done.bmi?.value} · ${done.bmi?.category}`]].map(([l, v]) => (
            <Row key={l} style={{ justifyContent: 'space-between', alignSelf: 'stretch' }}><Muted>{l}</Muted><H2>{v}</H2></Row>
          ))}
          <Button title="Let's go 🚀" onPress={() => router.replace('/(tabs)')} style={{ alignSelf: 'stretch' }} />
        </Card>
      </Screen>
    );
  }
  const [title, valid, body] = steps[step];
  return (
    <Screen>
      <Bar value={step + 1} max={steps.length} />
      <Muted>Step {step + 1} of {steps.length}</Muted>
      <H1>{title}</H1>
      {body}
      <ErrorText error={error} />
      <Row>
        {step > 0 ? <Button title="Back" variant="ghost" onPress={() => setStep(step - 1)} /> : null}
        <Button title={step === steps.length - 1 ? 'Finish' : 'Continue'} onPress={next} disabled={!valid} loading={busy} style={{ flex: 1 }} />
      </Row>
    </Screen>
  );
}
