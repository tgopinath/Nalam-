import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Card, Chip, ErrorText, Field, H2, Muted, Row, Screen, Success } from '../lib/ui';

export default function Profile() {
  const { user, setUser, setSession, signOut } = useAuth();
  const [f, setF] = useState({
    name: user.name || '', height_cm: String(user.height_cm ?? ''), target_weight_kg: String(user.target_weight_kg ?? ''), goal: user.goal || 'maintain',
    activity_level: user.activity_level || 'light', calorie_target: String(user.calorie_target ?? ''), water_target_ml: String(user.water_target_ml ?? 2500), step_target: String(user.step_target ?? 8000),
  });
  const [msg, setMsg] = useState(null);
  const [phone, setPhone] = useState({ number: '', code: '', sent: false });
  const set = (k) => (v) => setF({ ...f, [k]: v });

  const save = async () => {
    try {
      const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
      const r = await api('/me/profile', { method: 'PATCH', body });
      setUser(r.user);
      setF((x) => ({ ...x, calorie_target: String(r.user.calorie_target ?? ''), water_target_ml: String(r.user.water_target_ml) }));
      setMsg({ ok: 'Saved' });
    } catch (e) { setMsg({ err: e }); }
  };
  const linkPhone = async () => {
    try {
      const r = await api('/auth/phone/link', { method: 'POST', body: { phone: phone.number, code: phone.sent ? phone.code : undefined } });
      if (!phone.sent) setPhone({ ...phone, sent: true }); else { setSession(r); setMsg({ ok: 'Phone linked' }); }
    } catch (e) { setMsg({ err: e }); }
  };
  const del = () => Alert.alert('Delete account?', 'This permanently deletes your Nalam account and data.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api('/me', { method: 'DELETE' }); signOut(); } },
  ]);

  return (
    <Screen>
      <Card>
        <H2>Goals & body</H2>
        <Field label="Name" value={f.name} onChangeText={set('name')} />
        <Field label="Height (cm)" value={f.height_cm} onChangeText={set('height_cm')} keyboardType="decimal-pad" />
        <Field label="Target weight (kg)" value={f.target_weight_kg} onChangeText={set('target_weight_kg')} keyboardType="decimal-pad" />
        <Muted>Goal</Muted>
        <Row>{[['lose', 'Lose'], ['maintain', 'Maintain'], ['gain', 'Gain']].map(([v, l]) => <Chip key={v} label={l} active={f.goal === v} onPress={() => set('goal')(v)} />)}</Row>
        <Muted>Activity</Muted>
        <Row style={{ flexWrap: 'wrap' }}>{[['sedentary', 'Sedentary'], ['light', 'Light'], ['moderate', 'Moderate'], ['active', 'Active'], ['very_active', 'Athlete']].map(([v, l]) => <Chip key={v} label={l} active={f.activity_level === v} onPress={() => set('activity_level')(v)} />)}</Row>
        <Field label="Daily calories" value={f.calorie_target} onChangeText={set('calorie_target')} keyboardType="number-pad" />
        <Field label="Water goal (ml)" value={f.water_target_ml} onChangeText={set('water_target_ml')} keyboardType="number-pad" />
        <Field label="Step goal" value={f.step_target} onChangeText={set('step_target')} keyboardType="number-pad" />
        <Success>{msg?.ok}</Success>
        <ErrorText error={msg?.err} />
        <Button title="Save changes" onPress={save} />
      </Card>
      {!user.phone ? (
        <Card>
          <H2>Add mobile number</H2>
          <Field placeholder="Mobile number" value={phone.number} onChangeText={(v) => setPhone({ ...phone, number: v })} keyboardType="phone-pad" editable={!phone.sent} />
          {phone.sent ? <Field placeholder="OTP" value={phone.code} onChangeText={(v) => setPhone({ ...phone, code: v })} keyboardType="number-pad" maxLength={6} /> : null}
          <Button title={phone.sent ? 'Verify' : 'Send OTP'} variant="ghost" onPress={linkPhone} />
        </Card>
      ) : null}
      <Card>
        <H2>Account</H2>
        <Text>{[user.email, user.phone].filter(Boolean).join(' · ')}</Text>
        <Button title="Log out of all devices" variant="ghost" onPress={async () => { await api('/auth/logout-all', { method: 'POST' }); signOut(); }} />
        <Button title="Delete account" variant="danger" onPress={del} />
      </Card>
    </Screen>
  );
}
