import { useState } from 'react';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button, C, Card, Chip, H2, Loading, MiniBars, Muted, Row, Screen, useApi } from '../../lib/ui';
import { Text, View } from 'react-native';

const day = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'narrow' });

export default function Progress() {
  const { user, can, loading } = useAuth();
  const [days, setDays] = useState(30);
  const w = useApi(() => api(`/weight?days=${days}`), [days]);
  const ins = useApi(() => (can('insights') ? api('/me/insights', { silentPaywall: true }) : null), [can('insights')]);
  const latest = w.data?.at(-1)?.weight_kg ?? user.weight_kg;
  const first = w.data?.[0]?.weight_kg;
  const pts = (rows) => rows?.map((r) => ({ y: Number(r.value), label: day(r.date) }));
  const sample = (rows) => (rows.length > 10 ? rows.filter((_, i) => i % Math.ceil(rows.length / 10) === 0 || i === rows.length - 1) : rows);

  return (
    <Screen onRefresh={() => { w.reload(); ins.reload(); }}>
      <Row style={{ flexWrap: 'wrap', gap: 12 }}>
        {[['Current', latest != null ? `${latest} kg` : '—'], ['Target', user.target_weight_kg ? `${user.target_weight_kg} kg` : '—'], ['Change', first != null && latest != null ? `${(latest - first).toFixed(1)} kg` : '—'], ['BMI', user.bmi ? `${user.bmi.value} (${user.bmi.category})` : '—']].map(([l, v]) => (
          <Card key={l} style={{ width: '47.8%' }}><Muted>{l}</Muted><Text style={{ fontSize: 18, fontWeight: '800' }}>{v}</Text></Card>
        ))}
      </Row>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}><H2>Weight</H2><Row>{[30, 90, 365].map((d) => <Chip key={d} label={d === 365 ? '1y' : `${d}d`} active={days === d} onPress={() => setDays(d)} />)}</Row></Row>
        {!w.data ? <Loading /> : <MiniBars points={sample(w.data).map((r) => ({ y: r.weight_kg, label: new Date(r.date).getDate() }))} color={C.brand} />}
      </Card>
      {!can('insights') ? (
        <Card style={{ alignItems: 'center' }}><H2>📊 Weekly insights are Premium</H2><Button title="Upgrade" onPress={() => router.push('/premium')} /></Card>
      ) : !ins.data ? <Loading /> : (
        <>
          <Card><H2>💡 This week's tips</H2>{ins.data.tips.map((t) => <Text key={t}>✓ {t}</Text>)}</Card>
          {[['Calories', 'calories', C.brand, `avg ${ins.data.averages.calories} kcal`], ['Water (ml)', 'water', C.blue, `avg ${ins.data.averages.water_ml} ml`], ['Steps', 'steps', C.accent, `avg ${ins.data.averages.steps}`], ['Sleep (h)', 'sleep', C.violet, `avg ${ins.data.averages.sleep_hours} h`]].map(([t, k, c, sub]) => (
            <Card key={k}><Row style={{ justifyContent: 'space-between' }}><H2>{t}</H2><Muted>{sub}</Muted></Row><View><MiniBars points={pts(ins.data.series[k])} color={c} format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v))} /></View></Card>
          ))}
        </>
      )}
    </Screen>
  );
}
