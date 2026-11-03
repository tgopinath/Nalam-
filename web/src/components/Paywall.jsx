import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Modal } from './ui.jsx';

export default function Paywall() {
  const { paywall, setPaywall, config } = useAuth();
  const nav = useNavigate();
  if (!paywall) return null;
  const close = () => setPaywall(null);
  return (
    <Modal title="Unlock Nalam Premium ⭐" onClose={close}>
      <p>{paywall.error || 'This feature is part of Nalam Premium.'}</p>
      <ul className="check-list">
        {Object.values(config?.features || {}).slice(0, 8).map((f) => <li key={f}>{f}</li>)}
      </ul>
      <div className="row mt">
        <button className="btn block" onClick={() => { close(); nav('/premium'); }}>View plans</button>
        <button className="btn ghost" onClick={close}>Later</button>
      </div>
    </Modal>
  );
}

export function Locked({ feature }) {
  const { config } = useAuth();
  const nav = useNavigate();
  return (
    <div className="card" style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <h2>{config?.features?.[feature] || 'This feature'} is a Premium feature</h2>
      <p className="muted">Your free trial has ended. Subscribe monthly or yearly to continue.</p>
      <button className="btn" onClick={() => nav('/premium')}>See plans</button>
    </div>
  );
}
