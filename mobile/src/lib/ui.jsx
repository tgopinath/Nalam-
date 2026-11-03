import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, RefreshControl } from 'react-native';
import { router } from 'expo-router';

export const C = {
  brand: '#16a34a', brandDark: '#15803d', brand50: '#f0fdf4', brand100: '#dcfce7', accent: '#f97316', blue: '#0ea5e9', violet: '#8b5cf6',
  amber: '#f59e0b', red: '#ef4444', text: '#0f172a', muted: '#64748b', line: '#e2e8f0', bg: '#f6f8f7', card: '#fff',
};

export function useApi(fn, deps = []) {
  const [s, setS] = useState({ data: null, error: null, loading: true });
  const load = useCallback(async () => {
    setS((x) => ({ ...x, loading: true }));
    try { setS({ data: await fn(), error: null, loading: false }); } catch (error) { setS({ data: null, error, loading: false }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...s, reload: load, setData: (data) => setS((x) => ({ ...x, data })) };
}

export function Screen({ children, onRefresh, refreshing = false, padded = true }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={padded ? { padding: 16, gap: 14, paddingBottom: 40 } : undefined}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.brand]} /> : undefined} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;
export const H1 = ({ children, style }) => <Text style={[s.h1, style]}>{children}</Text>;
export const H2 = ({ children, style }) => <Text style={[s.h2, style]}>{children}</Text>;
export const Muted = ({ children, style }) => <Text style={[s.muted, style]}>{children}</Text>;
export const Row = ({ children, style }) => <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>{children}</View>;

export function Button({ title, onPress, variant = 'primary', disabled, loading, style, small }) {
  const v = { primary: [C.brand, '#fff'], ghost: ['#fff', C.text], soft: [C.brand50, C.brandDark], danger: ['#fee2e2', '#b91c1c'], blue: [C.blue, '#fff'], orange: [C.accent, '#fff'] }[variant];
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
      style={({ pressed }) => [s.btn, small && s.btnSm, { backgroundColor: v[0], opacity: disabled ? 0.5 : pressed ? 0.85 : 1, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: C.line }, style]}>
      {loading ? <ActivityIndicator color={v[1]} /> : <Text style={[s.btnText, small && { fontSize: 13 }, { color: v[1] }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, style, ...props }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput placeholderTextColor="#94a3b8" style={[s.input, style]} {...props} />
    </View>
  );
}

export const Chip = ({ label, active, onPress }) => (
  <Pressable onPress={onPress} style={[s.chip, active && { backgroundColor: C.text, borderColor: C.text }]}>
    <Text style={{ fontWeight: '600', fontSize: 13, color: active ? '#fff' : '#334155', textTransform: 'capitalize' }}>{label}</Text>
  </Pressable>
);

export const Badge = ({ label, color = '#334155', bg = '#f1f5f9' }) => (
  <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' }}><Text style={{ color, fontSize: 12, fontWeight: '700' }}>{label}</Text></View>
);

export const Bar = ({ value, max, color = C.brand }) => (
  <View style={s.bar}><View style={{ height: '100%', borderRadius: 99, backgroundColor: color, width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} /></View>
);

export const Loading = () => <View style={{ padding: 40 }}><ActivityIndicator color={C.brand} size="large" /></View>;
export const ErrorText = ({ error }) => (error ? <Text style={s.error}>{error.message || String(error)}</Text> : null);
export const Success = ({ children }) => (children ? <Text style={s.success}>{children}</Text> : null);

export function Locked({ label }) {
  return (
    <Card style={{ alignItems: 'center', gap: 10, padding: 28 }}>
      <Text style={{ fontSize: 44 }}>🔒</Text>
      <H2 style={{ textAlign: 'center' }}>{label || 'This feature'} is part of Nalam Premium</H2>
      <Muted style={{ textAlign: 'center' }}>Your free trial has ended. Subscribe monthly or yearly to continue.</Muted>
      <Button title="See plans" onPress={() => router.push('/premium')} />
    </Card>
  );
}

/** Simple bar chart built from Views (no native chart dependency). */
export function MiniBars({ points, color = C.brand, height = 110, format = (v) => v }) {
  if (!points?.length) return <Muted>No data yet</Muted>;
  const max = Math.max(...points.map((p) => p.y)) || 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: height + 34 }}>
      {points.map((p, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 9, color: C.muted }}>{format(p.y)}</Text>
          <View style={{ width: '70%', height: Math.max(2, (p.y / max) * height), backgroundColor: color, borderRadius: 6 }} />
          <Text style={{ fontSize: 10, color: C.muted }}>{p.label}</Text>
        </View>
      ))}
    </View>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#eef2f0', gap: 10, shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  h1: { fontSize: 24, fontWeight: '800', color: C.text },
  h2: { fontSize: 17, fontWeight: '700', color: C.text },
  muted: { color: C.muted, fontSize: 13, lineHeight: 19 },
  btn: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnSm: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  btnText: { fontWeight: '700', fontSize: 15 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, backgroundColor: '#fff', color: C.text },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  bar: { height: 8, borderRadius: 99, backgroundColor: '#eef2f0', overflow: 'hidden' },
  error: { color: '#b91c1c', backgroundColor: '#fef2f2', borderRadius: 10, padding: 10, fontSize: 14 },
  success: { color: '#166534', backgroundColor: C.brand50, borderRadius: 10, padding: 10, fontSize: 14 },
});
