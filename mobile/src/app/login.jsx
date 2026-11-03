import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { api, GOOGLE } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, C, Card, ErrorText, Field, H1, Muted, Row, Success } from '../lib/ui';

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const { config, signIn } = useAuth();
  const m = config?.authMethods || { phone: true, email: true, google: true };
  const [tab, setTab] = useState('phone');
  useEffect(() => { if (!m.phone && m.email) setTab('email'); }, [m.phone, m.email]);
  const googleReady = m.google && (GOOGLE.androidClientId || GOOGLE.webClientId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.brandDark }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ padding: 24, gap: 8 }}>
            <Text style={{ color: '#fff', fontSize: 34, fontWeight: '800' }}>Nalam 🌿</Text>
            <Text style={{ color: '#dcfce7', fontSize: 17 }}>Your health, simplified. Track food, workouts, water, weight & sleep.</Text>
            <View style={{ backgroundColor: '#fff', alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 6 }}>
              <Text style={{ color: C.brandDark, fontWeight: '700' }}>🎁 All Premium features free for {config?.trialDays ?? 7} days</Text>
            </View>
          </View>
          <View style={{ flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14 }}>
            <H1>Welcome 👋</H1>
            {m.phone && m.email ? (
              <Row style={{ backgroundColor: '#e8ede9', borderRadius: 12, padding: 4, gap: 4 }}>
                {[['phone', '📱 Mobile'], ['email', '✉️ Email']].map(([k, l]) => (
                  <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, padding: 10, borderRadius: 9, backgroundColor: tab === k ? '#fff' : 'transparent' }}>
                    <Text style={{ textAlign: 'center', fontWeight: '700', color: tab === k ? C.text : C.muted }}>{l}</Text>
                  </Pressable>
                ))}
              </Row>
            ) : null}
            {tab === 'phone' && m.phone ? <OtpForm channel="phone" onDone={signIn} /> : null}
            {tab === 'email' && m.email ? <EmailForm onDone={signIn} /> : null}
            {googleReady ? <><Muted style={{ textAlign: 'center' }}>— or —</Muted><GoogleLogin onDone={signIn} /></> : null}
            <Muted style={{ textAlign: 'center', fontSize: 12 }}>By continuing you agree to Nalam's Terms & Privacy Policy.</Muted>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OtpForm({ channel, onDone, initial = '' }) {
  const [target, setTarget] = useState(initial);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [cool, setCool] = useState(0);
  useEffect(() => { if (!cool) return; const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); }, [cool]);

  const send = async () => {
    setBusy(true); setError(null);
    try { await api('/auth/otp/request', { method: 'POST', body: { channel, target } }); setSent(true); setCool(30); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError(null);
    try { await onDone(await api('/auth/otp/verify', { method: 'POST', body: { channel, target, code, name: name || undefined } })); } catch (e) { setError(e); setBusy(false); }
  };

  if (!sent) {
    return (
      <View style={{ gap: 12 }}>
        <Field label={channel === 'phone' ? 'Mobile number (+91)' : 'Email'} value={target} onChangeText={setTarget}
          keyboardType={channel === 'phone' ? 'phone-pad' : 'email-address'} autoCapitalize="none" autoComplete={channel === 'phone' ? 'tel' : 'email'} placeholder={channel === 'phone' ? '98765 43210' : 'you@example.com'} />
        <ErrorText error={error} />
        <Button title="Get OTP" onPress={send} loading={busy} disabled={!target} />
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <Success>Code sent to {target}</Success>
      <Field label="Enter 6-digit OTP" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} autoComplete="sms-otp" textContentType="oneTimeCode"
        style={{ letterSpacing: 10, textAlign: 'center', fontSize: 22, fontWeight: '700' }} autoFocus />
      <Field label="Your name (new users)" value={name} onChangeText={setName} placeholder="Optional" />
      <ErrorText error={error} />
      <Button title="Verify & continue" onPress={verify} loading={busy} disabled={code.length !== 6} />
      <Row>
        <Button title="Change" variant="ghost" small onPress={() => { setSent(false); setCode(''); }} style={{ flex: 1 }} />
        <Button title={cool ? `Resend in ${cool}s` : 'Resend OTP'} variant="ghost" small disabled={cool > 0} onPress={send} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

function EmailForm({ onDone }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '', code: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (v) => setF({ ...f, [k]: v });

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      if (mode === 'login') return await onDone(await api('/auth/login', { method: 'POST', body: { email: f.email, password: f.password } }));
      if (mode === 'register') return await onDone(await api('/auth/register', { method: 'POST', body: { name: f.name, email: f.email, password: f.password } }));
      if (mode === 'forgot') { await api('/auth/password/forgot', { method: 'POST', body: { email: f.email } }); setMode('reset'); }
      if (mode === 'reset') return await onDone(await api('/auth/password/reset', { method: 'POST', body: { email: f.email, code: f.code, password: f.password } }));
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  if (mode === 'otp') return <View style={{ gap: 10 }}><OtpForm channel="email" onDone={onDone} initial={f.email} /><Button title="Use password instead" variant="ghost" small onPress={() => setMode('login')} /></View>;
  return (
    <View style={{ gap: 12 }}>
      {mode === 'register' ? <Field label="Full name" value={f.name} onChangeText={set('name')} autoComplete="name" /> : null}
      <Field label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={mode !== 'reset'} />
      {mode === 'reset' ? <Field label="Reset code from email" value={f.code} onChangeText={set('code')} keyboardType="number-pad" maxLength={6} /> : null}
      {mode !== 'forgot' ? <Field label={mode === 'reset' ? 'New password' : 'Password'} value={f.password} onChangeText={set('password')} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /> : null}
      <ErrorText error={error} />
      <Button title={{ login: 'Log in', register: 'Create account', forgot: 'Send reset code', reset: 'Reset password' }[mode]} onPress={submit} loading={busy} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: C.brandDark, fontWeight: '600' }} onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create account' : 'Back to login'}</Text>
        {mode === 'login' ? <Text style={{ color: C.brandDark, fontWeight: '600' }} onPress={() => setMode('forgot')}>Forgot password?</Text> : null}
      </Row>
      {mode === 'login' ? <Button title="Log in with email OTP" variant="ghost" onPress={() => setMode('otp')} /> : null}
    </View>
  );
}

function GoogleLogin({ onDone }) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({ androidClientId: GOOGLE.androidClientId, webClientId: GOOGLE.webClientId });
  const [error, setError] = useState(null);
  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params?.id_token || response.authentication?.idToken;
    api('/auth/google', { method: 'POST', body: { idToken } }).then(onDone).catch(setError);
  }, [response, onDone]);
  return (
    <Card style={{ padding: 0 }}>
      <Pressable disabled={!request} onPress={() => promptAsync()} style={{ padding: 14, flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
        <Text style={{ fontWeight: '800', fontSize: 16, color: '#4285F4' }}>G</Text><Text style={{ fontWeight: '700', fontSize: 15 }}>Continue with Google</Text>
      </Pressable>
      <ErrorText error={error} />
    </Card>
  );
}
