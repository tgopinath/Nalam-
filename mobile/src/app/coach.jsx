import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, C, Field, Loading, Locked, Muted, Row, Screen, useApi } from '../lib/ui';

export default function Coach() {
  const { can, loading } = useAuth();
  const msgs = useApi(() => (can('coach') ? api('/coach/messages', { silentPaywall: true }) : null), [can('coach')]);
  const [text, setText] = useState('');
  const listRef = useRef(null);
  useEffect(() => {
    if (loading) return <Loading />;
  if (!can('coach')) return;
    const t = setInterval(() => api('/coach/messages').then(msgs.setData).catch(() => {}), 15000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!can('coach')) return <Screen><Locked label="Coach chat" /></Screen>;
  if (!msgs.data) return <Loading />;
  const send = async () => { const body = text.trim(); if (!body) return; setText(''); await api('/coach/messages', { method: 'POST', body: { body } }); msgs.reload(); };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList ref={listRef} data={msgs.data} keyExtractor={(m) => String(m.id)} contentContainerStyle={{ padding: 16, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        ListEmptyComponent={<Muted style={{ textAlign: 'center' }}>Ask anything about diet, workouts or your goals 👋</Muted>}
        renderItem={({ item: m }) => (
          <View style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: m.sender === 'user' ? C.brand : '#fff', padding: 12, borderRadius: 16 }}>
            <Text style={{ color: m.sender === 'user' ? '#fff' : C.text }}>{m.body}</Text>
            <Text style={{ fontSize: 10, marginTop: 4, color: m.sender === 'user' ? '#dcfce7' : C.muted }}>{new Date(m.created_at).toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}</Text>
          </View>
        )} />
      <Row style={{ padding: 12, backgroundColor: '#fff' }}>
        <View style={{ flex: 1 }}><Field value={text} onChangeText={setText} placeholder="Type your message…" maxLength={2000} /></View>
        <Button title="Send" onPress={send} disabled={!text.trim()} />
      </Row>
    </KeyboardAvoidingView>
  );
}
