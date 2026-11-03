import { useState } from 'react';
import { api, fmtDate, rupees } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorBox, Loading, Modal, useApi } from '../components/ui.jsx';

const STATUS = { premium: 'green', trial: 'orange', expired: 'red', admin: 'violet' };

export default function Users() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const list = useApi(() => api(`/admin/users?q=${encodeURIComponent(q)}&filter=${filter}&page=${page}`), [q, filter, page]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between wrap"><h1 style={{ margin: 0 }}>Users</h1><input placeholder="Search name, email or phone" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ maxWidth: 300 }} /></div>
      <div className="chips">
        {[['', 'All'], ['premium', 'Premium'], ['trial', 'On trial'], ['expired', 'Trial ended'], ['blocked', 'Blocked'], ['admin', 'Admins']].map(([v, l]) => (
          <button key={v} className={`chip ${filter === v ? 'active' : ''}`} onClick={() => { setFilter(v); setPage(1); }}>{l}</button>
        ))}
      </div>
      <ErrorBox error={list.error} />
      <div className="card table-wrap">
        {list.loading && !list.data ? <Loading /> : null}
        <table>
          <thead><tr><th>User</th><th>Contact</th><th>Status</th><th>Access until</th><th>Joined</th><th /></tr></thead>
          <tbody>
            {list.data?.users.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name || '—'}</b>{u.status === 'blocked' ? <span className="badge red" style={{ marginLeft: 6 }}>blocked</span> : null}</td>
                <td className="small">{u.email}<br />{u.phone}</td>
                <td><span className={`badge ${STATUS[u.access.status]}`}>{u.access.status}</span></td>
                <td className="small">{u.access.status === 'premium' ? fmtDate(u.premium_until) : u.access.status === 'trial' ? fmtDate(u.trial_ends_at) : '—'}</td>
                <td className="small">{fmtDate(u.created_at)}</td>
                <td><button className="btn soft sm" onClick={() => setOpen(u.id)}>Manage</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data ? (
          <div className="row between mt small">
            <span className="muted">{list.data.total} users</span>
            <div className="row">
              <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
              <span>Page {page}</span>
              <button className="btn ghost sm" disabled={page * list.data.pageSize >= list.data.total} onClick={() => setPage(page + 1)}>Next →</button>
            </div>
          </div>
        ) : null}
      </div>
      {open ? <UserDetail id={open} onClose={() => setOpen(null)} onChanged={list.reload} /> : null}
    </div>
  );
}

const toLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

function UserDetail({ id, onClose, onChanged }) {
  const { user: me } = useAuth();
  const d = useApi(() => api(`/admin/users/${id}`), [id]);
  const [days, setDays] = useState(30);
  const [msg, setMsg] = useState(null);
  const [note, setNote] = useState({ title: '', body: '' });

  const act = async (fn, ok) => {
    setMsg(null);
    try { await fn(); setMsg({ ok }); d.reload(); onChanged(); } catch (e) { setMsg({ err: e.message }); }
  };
  const patch = (body, ok) => act(() => api(`/admin/users/${id}`, { method: 'PATCH', body }), ok);

  if (d.loading && !d.data) return <Modal title="User" onClose={onClose}><Loading /></Modal>;
  if (d.error) return <Modal title="User" onClose={onClose}><ErrorBox error={d.error} /></Modal>;
  const { user: u, access, payments, activity } = d.data;
  const self = u.id === me.id;

  return (
    <Modal title={u.name || u.email || u.phone} onClose={onClose} wide>
      <div className="stack">
        <div className="row wrap">
          <span className={`badge ${STATUS[access.status]}`}>{access.status}{access.daysLeft ? ` · ${access.daysLeft}d left` : ''}</span>
          <span className="badge">{u.role}</span>
          <span className={`badge ${u.status === 'blocked' ? 'red' : 'green'}`}>{u.status}</span>
          {u.google_linked ? <span className="badge blue">Google</span> : null}
        </div>
        <div className="grid grid-3 small">
          <div><span className="muted">Email</span><br />{u.email || '—'} {u.email_verified ? '✅' : ''}</div>
          <div><span className="muted">Phone</span><br />{u.phone || '—'} {u.phone_verified ? '✅' : ''}</div>
          <div><span className="muted">Joined / last login</span><br />{fmtDate(u.created_at)} / {u.last_login_at ? fmtDate(u.last_login_at) : '—'}</div>
          <div><span className="muted">Goal</span><br />{u.goal || '—'} · {u.weight_kg ?? '—'} → {u.target_weight_kg ?? '—'} kg</div>
          <div><span className="muted">Calorie target</span><br />{u.calorie_target ?? '—'} kcal</div>
          <div><span className="muted">Activity</span><br />{activity.food_logs} food · {activity.workouts} workouts · {activity.water_logs} water</div>
        </div>

        <div className="card stack">
          <h3>Subscription</h3>
          <div className="row wrap">
            <span className="small">Give free Premium:</span>
            <input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 90 }} />
            <span className="small">days</span>
            <button className="btn sm" onClick={() => act(() => api(`/admin/users/${id}/grant`, { method: 'POST', body: { days: Number(days) } }), `Added ${days} days`)}>Grant</button>
          </div>
          <div className="grid grid-2">
            <label className="field">Trial ends at
              <div className="row"><input type="datetime-local" defaultValue={toLocal(u.trial_ends_at)} id="trial" />
                <button className="btn ghost sm" onClick={() => { const v = document.getElementById('trial').value; patch({ trial_ends_at: v ? new Date(v).toISOString() : null }, 'Trial updated'); }}>Save</button></div>
            </label>
            <label className="field">Premium until
              <div className="row"><input type="datetime-local" defaultValue={toLocal(u.premium_until)} id="prem" />
                <button className="btn ghost sm" onClick={() => { const v = document.getElementById('prem').value; patch({ premium_until: v ? new Date(v).toISOString() : null }, 'Premium updated'); }}>Save</button></div>
            </label>
          </div>
        </div>

        {payments.length ? (
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th><th>Via</th></tr></thead>
            <tbody>{payments.map((p) => <tr key={p.id}><td>{fmtDate(p.created_at)}</td><td>{p.plan_name || p.note || 'Manual'}</td><td>{rupees(p.amount_paise)}</td><td><span className={`badge ${p.status === 'paid' ? 'green' : p.status === 'created' ? '' : 'red'}`}>{p.status}</span></td><td>{p.provider}</td></tr>)}</tbody>
          </table></div>
        ) : null}

        <div className="card stack">
          <h3>Send a notification</h3>
          <input placeholder="Title" value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} />
          <input placeholder="Message" value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} />
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} disabled={!note.title || !note.body}
            onClick={() => act(() => api('/admin/notifications', { method: 'POST', body: { ...note, user_id: id } }), 'Notification sent').then(() => setNote({ title: '', body: '' }))}>Send</button>
        </div>

        {msg?.ok ? <div className="success">{msg.ok}</div> : null}
        {msg?.err ? <div className="error">{msg.err}</div> : null}

        {!self ? (
          <div className="row wrap">
            {u.status === 'active'
              ? <button className="btn danger sm" onClick={() => patch({ status: 'blocked' }, 'User blocked and signed out')}>Block user</button>
              : <button className="btn soft sm" onClick={() => patch({ status: 'active' }, 'User unblocked')}>Unblock</button>}
            {u.role === 'admin'
              ? <button className="btn ghost sm" onClick={() => patch({ role: 'user' }, 'Admin removed')}>Remove admin</button>
              : <button className="btn ghost sm" onClick={() => confirm('Give this user full admin access?') && patch({ role: 'admin' }, 'Now an admin')}>Make admin</button>}
            <button className="btn danger sm" onClick={() => confirm('Permanently delete this user and all their data?') && act(() => api(`/admin/users/${id}`, { method: 'DELETE' }), 'Deleted').then(onClose)}>Delete user</button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
