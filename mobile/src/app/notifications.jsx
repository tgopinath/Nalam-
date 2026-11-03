import { api, fmtDate } from '../lib/api';
import { Card, H2, Loading, Muted, Screen, useApi } from '../lib/ui';

export default function Notifications() {
  const n = useApi(() => api('/me/notifications'), []);
  if (!n.data) return <Loading />;
  return (
    <Screen onRefresh={n.reload}>
      {!n.data.length ? <Muted>You're all caught up 🎉</Muted> : null}
      {n.data.map((x) => <Card key={x.id}><H2>{x.title}</H2><Muted>{x.body}</Muted><Muted style={{ fontSize: 11 }}>{fmtDate(x.created_at)}</Muted></Card>)}
    </Screen>
  );
}
