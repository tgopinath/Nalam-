import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { api, fmtDate, rupees } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Button, C, Card, ErrorText, Field, H1, H2, Muted, Row, Screen, Success, useApi } from '../lib/ui';

export default function Premium() {
  const { config, access, refresh, user } = useAuth();
  const plans = config?.plans || [];
  const [chosen, setPlanId] = useState(null);
  const planId = chosen ?? plans.find((p) => p.interval === 'year')?.id ?? plans[0]?.id; // default once config has loaded
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const history = useApi(() => (user ? api('/subscription/history') : null), [user?.id]);
  const plan = plans.find((p) => p.id === planId);
  const monthly = plans.find((p) => p.interval === 'month');

  const apply = async () => {
    setMsg(null);
    try { setApplied(await api('/subscription/coupon', { method: 'POST', body: { planId, code: coupon } })); } catch (e) { setApplied(null); setMsg({ err: e }); }
  };

  // Payment opens Nalam's secure hosted Razorpay checkout in a browser tab (UPI apps, cards, net banking)
  // and returns to the app through a deep link. The server confirms the payment before access is granted.
  const pay = async () => {
    setBusy(true); setMsg(null);
    try {
      const order = await api('/subscription/checkout', { method: 'POST', body: { planId, coupon: applied?.code } });
      const returnUrl = Linking.createURL('payment');
      const res = await WebBrowser.openAuthSessionAsync(`${order.hostedUrl}&return=${encodeURIComponent(returnUrl)}`, returnUrl);
      const status = res.type === 'success' ? Linking.parse(res.url).queryParams?.status : null;
      await refresh();
      history.reload();
      if (status === 'success') setMsg({ ok: 'Payment successful! Welcome to Nalam Premium 🎉' });
      else if (status === 'failed') setMsg({ err: new Error('Payment could not be verified. If money was deducted it will be refunded automatically.') });
    } catch (e) { setMsg({ err: e }); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Card style={{ backgroundColor: C.brandDark }}>
        <H1 style={{ color: '#fff' }}>Nalam Premium ⭐</H1>
        <Text style={{ color: '#dcfce7' }}>
          {access?.status === 'premium' ? `Active until ${fmtDate(access.premiumUntil)}. Renewing adds days on top.`
            : access?.status === 'trial' ? `Free trial: ${access.daysLeft} day${access.daysLeft === 1 ? '' : 's'} left. Subscribe to keep everything.`
            : 'Your free trial has ended. Choose a plan to unlock every feature.'}
        </Text>
      </Card>
      {plans.map((p) => {
        const save = p.interval === 'year' && monthly ? Math.round((1 - p.price_paise / (monthly.price_paise * 12)) * 100) : 0;
        const on = planId === p.id;
        return (
          <Pressable key={p.id} onPress={() => { setPlanId(p.id); setApplied(null); }}>
            <Card style={{ borderWidth: 2, borderColor: on ? C.brand : C.line, backgroundColor: on ? C.brand50 : '#fff' }}>
              <Row style={{ justifyContent: 'space-between' }}><H2>{p.name}</H2>{save > 0 ? <Badge label={`SAVE ${save}%`} color="#fff" bg={C.accent} /> : null}</Row>
              <Row><Text style={{ fontSize: 28, fontWeight: '800' }}>{rupees(p.price_paise)}</Text>{p.mrp_paise ? <Text style={{ textDecorationLine: 'line-through', color: C.muted }}>{rupees(p.mrp_paise)}</Text> : null}</Row>
              <Muted>{p.interval === 'year' ? `Just ${rupees(Math.round(p.price_paise / 12))}/month · billed yearly` : `${p.duration_days} days access`}</Muted>
              {p.highlights?.map((h) => <Text key={h}>✓ {h}</Text>)}
            </Card>
          </Pressable>
        );
      })}
      {plan ? (
        <Card>
          <Row><View style={{ flex: 1 }}><Field placeholder="Coupon code" value={coupon} onChangeText={(v) => setCoupon(v.toUpperCase())} autoCapitalize="characters" /></View><Button title="Apply" variant="ghost" onPress={apply} disabled={!coupon} /></Row>
          {applied ? <Success>{applied.code} applied · you pay {rupees(applied.amount)}</Success> : null}
          <Success>{msg?.ok}</Success>
          <ErrorText error={msg?.err} />
          <Button title={`Pay ${rupees(applied?.amount ?? plan.price_paise)} · ${plan.name}`} onPress={pay} loading={busy} />
          <Muted style={{ textAlign: 'center' }}>🔒 Secure payments by Razorpay · UPI, cards, net banking</Muted>
        </Card>
      ) : null}
      <Card><H2>What you get</H2>{Object.values(config?.features || {}).map((f) => <Text key={f}>✓ {f}</Text>)}</Card>
      {history.data?.length ? (
        <Card><H2>Billing history</H2>{history.data.map((h) => (
          <Row key={h.id} style={{ justifyContent: 'space-between' }}><Muted>{fmtDate(h.created_at)} · {h.plan_name || 'Complimentary'}</Muted><Text style={{ fontWeight: '700' }}>{rupees(h.amount_paise)} · {h.status}</Text></Row>
        ))}</Card>
      ) : null}
    </Screen>
  );
}
