const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'nalam_token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

let onUnauthorized = () => {};
let onPaywall = () => {};
export const setApiHandlers = (h) => { onUnauthorized = h.onUnauthorized || onUnauthorized; onPaywall = h.onPaywall || onPaywall; };

export async function api(path, { method = 'GET', body, form, silentPaywall } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: form || (body !== undefined ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && token === getToken()) onUnauthorized();
    if (res.status === 402 && !silentPaywall) onPaywall(data);
    throw new ApiError(res.status, data);
  }
  return data;
}

/** Image paths from the API are relative (/static/..., /uploads/...) */
export const img = (url) => (!url ? '' : /^https?:/.test(url) ? url : `${BASE}${url}`);
export const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
