import { useCallback, useEffect, useState } from 'react';

export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: await fn(), error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) };
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="row between mb">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Loading = () => <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>;
export const ErrorBox = ({ error }) => (error ? <div className="error">{error.message || String(error)}</div> : null);
export const Empty = ({ children }) => <div className="empty">{children}</div>;

export function Ring({ value, max, size = 170, stroke = 14, color = 'var(--brand)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max ? Math.min(1, value / max) : 0;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#eef2f0" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={value > max ? 'var(--red)' : color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .5s' }} />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export function Bar({ value, max, color }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return <div className="bar"><span style={{ width: `${pct}%`, background: color }} /></div>;
}

const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export function LineChart({ points, height = 200, color = 'var(--brand)', unit = '' }) {
  if (!points?.length) return <Empty>No data yet</Empty>;
  const W = 600, H = height, P = 32;
  const vals = points.map((p) => p.y);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const x = (i) => P + (points.length === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (points.length - 1));
  const y = (v) => H - P - ((v - min) / (max - min)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.y)}`).join(' ');
  const step = Math.ceil(points.length / 6);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
      {[min, (min + max) / 2, max].map((v) => (
        <g key={v}><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="#eef2f0" /><text x={2} y={y(v) + 4}>{Math.round(v * 10) / 10}{unit}</text></g>
      ))}
      <path d={`${d} L${x(points.length - 1)},${H - P} L${x(0)},${H - P} Z`} fill={color} opacity="0.08" />
      <path d={d} stroke={color} strokeWidth="3" fill="none" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.y)} r="4" fill="#fff" stroke={color} strokeWidth="2.5"><title>{`${shortDate(p.x)}: ${p.y}${unit}`}</title></circle>)}
      {points.map((p, i) => (i % step === 0 ? <text key={`t${i}`} x={x(i)} y={H - 8} textAnchor="middle">{shortDate(p.x)}</text> : null))}
    </svg>
  );
}

export function BarChart({ points, height = 180, color = 'var(--brand)', target }) {
  if (!points?.length) return <Empty>No data yet</Empty>;
  const W = 600, H = height, P = 28;
  const max = Math.max(...points.map((p) => p.y), target || 0) || 1;
  const bw = (W - 2 * P) / points.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
      {target ? <line x1={P} x2={W - P} y1={H - P - (target / max) * (H - 2 * P)} y2={H - P - (target / max) * (H - 2 * P)} stroke="var(--accent)" strokeDasharray="6 5" /> : null}
      {points.map((p, i) => {
        const h = (p.y / max) * (H - 2 * P);
        return (
          <g key={i}>
            <rect x={P + i * bw + bw * 0.18} y={H - P - h} width={bw * 0.64} height={Math.max(h, 1)} rx="6" fill={color}><title>{`${shortDate(p.x)}: ${p.y}`}</title></rect>
            <text x={P + i * bw + bw / 2} y={H - 8} textAnchor="middle">{new Date(p.x).toLocaleDateString('en-IN', { weekday: 'short' })}</text>
          </g>
        );
      })}
    </svg>
  );
}
