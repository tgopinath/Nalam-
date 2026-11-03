import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, today } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Bar, Button, C, Card, Chip, ErrorText, Field, H2, Loading, Locked, Muted, Row, Screen, useApi } from '../../lib/ui';

const MEALS = [['breakfast', '🌅 Breakfast'], ['lunch', '☀️ Lunch'], ['snacks', '🍪 Snacks'], ['dinner', '🌙 Dinner']];
const shift = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

export default function Food() {
  const { can, user, loading } = useAuth();
  const [date, setDate] = useState(today());
  const logs = useApi(() => (can('food_log') ? api(`/food-logs?date=${date}`, { silentPaywall: true }) : null), [date, can('food_log')]);
  const [adding, setAdding] = useState(null);
  if (loading) return <Loading />;
  if (!can('food_log')) return <Screen><Locked label="Food & calorie tracking" /></Screen>;
  const del = async (id) => { await api(`/food-logs/${id}`, { method: 'DELETE' }); logs.reload(); };
  const t = logs.data?.total;

  return (
    <View style={{ flex: 1 }}>
      <Screen onRefresh={logs.reload}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Button title="‹" variant="ghost" small onPress={() => setDate(shift(date, -1))} />
          <H2>{date === today() ? 'Today' : new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</H2>
          <Button title="›" variant="ghost" small onPress={() => setDate(shift(date, 1))} disabled={date >= today()} />
        </Row>
        {!logs.data ? <Loading /> : (
          <>
            <Card>
              <Row style={{ justifyContent: 'space-between' }}><H2>{Math.round(t.calories)} / {user.calorie_target || '—'} kcal</H2></Row>
              <Bar value={t.calories} max={user.calorie_target} />
              <Muted>Protein {Math.round(t.protein)}g · Carbs {Math.round(t.carbs)}g · Fat {Math.round(t.fat)}g</Muted>
            </Card>
            {MEALS.map(([k, label]) => (
              <Card key={k}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View><H2>{label}</H2><Muted>{Math.round(logs.data.meals[k].reduce((s, i) => s + i.calories, 0))} kcal</Muted></View>
                  <Button title="+ Add" variant="soft" small onPress={() => setAdding(k)} />
                </Row>
                {logs.data.meals[k].map((i) => (
                  <Row key={i.id} style={{ justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#f1f5f9', paddingTop: 8 }}>
                    <View style={{ flex: 1 }}><Text style={{ fontWeight: '600' }}>{i.food_name}</Text><Muted>{i.servings} serving · P {i.protein_g} · C {i.carbs_g} · F {i.fat_g}</Muted></View>
                    <Text style={{ fontWeight: '700' }}>{Math.round(i.calories)}</Text>
                    <Pressable onPress={() => del(i.id)} hitSlop={10}><Text>🗑</Text></Pressable>
                  </Row>
                ))}
              </Card>
            ))}
          </>
        )}
      </Screen>
      {adding ? <AddFood meal={adding} date={date} onClose={() => setAdding(null)} onAdded={() => { setAdding(null); logs.reload(); }} /> : null}
    </View>
  );
}

function AddFood({ meal, date, onClose, onAdded }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [servings, setServings] = useState('1');
  const [error, setError] = useState(null);
  useEffect(() => { const t = setTimeout(() => api(`/foods?q=${encodeURIComponent(q)}`).then(setResults).catch(() => {}), 250); return () => clearTimeout(t); }, [q]);
  const n = Number(servings) || 0;
  const add = async () => {
    try { await api('/food-logs', { method: 'POST', body: { food_id: picked.id, meal, servings: n, date } }); onAdded(); } catch (e) { setError(e); }
  };
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 16, gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}><H2>Add to {meal}</H2><Button title="Close" variant="ghost" small onPress={onClose} /></Row>
        {picked ? (
          <View style={{ gap: 12 }}>
            <Card><H2>{picked.name}</H2><Muted>{picked.local_name ? `${picked.local_name} · ` : ''}{picked.serving_desc} = {picked.calories} kcal</Muted></Card>
            <Muted>Servings</Muted>
            <Row style={{ flexWrap: 'wrap' }}>{['0.5', '1', '1.5', '2', '3'].map((s) => <Chip key={s} label={s} active={servings === s} onPress={() => setServings(s)} />)}</Row>
            <Field value={servings} onChangeText={setServings} keyboardType="decimal-pad" />
            <Card><Row style={{ justifyContent: 'space-around' }}>
              {[['kcal', picked.calories], ['P', picked.protein_g], ['C', picked.carbs_g], ['F', picked.fat_g]].map(([l, v]) => <View key={l} style={{ alignItems: 'center' }}><Text style={{ fontWeight: '800', fontSize: 18 }}>{Math.round(v * n * 10) / 10}</Text><Muted>{l}</Muted></View>)}
            </Row></Card>
            <ErrorText error={error} />
            <Row><Button title="Back" variant="ghost" onPress={() => setPicked(null)} /><Button title="Add to diary" onPress={add} disabled={!(n > 0)} style={{ flex: 1 }} /></Row>
          </View>
        ) : (
          <>
            <Field placeholder="Search idli, dosa, chicken, apple…" value={q} onChangeText={setQ} autoFocus />
            <FlatList data={results} keyExtractor={(f) => String(f.id)} keyboardShouldPersistTaps="handled"
              renderItem={({ item: f }) => (
                <Pressable onPress={() => setPicked(f)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: C.line, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <View style={{ flex: 1 }}><Text style={{ fontWeight: '600' }}>{f.name} <Text style={{ color: f.is_veg ? C.brand : C.red }}>●</Text></Text><Muted>{f.local_name ? `${f.local_name} · ` : ''}{f.serving_desc}</Muted></View>
                  <Text style={{ fontWeight: '700' }}>{Math.round(f.calories)} kcal</Text>
                </Pressable>
              )} ListEmptyComponent={<Muted>No foods found.</Muted>} />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}
