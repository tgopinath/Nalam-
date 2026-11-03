import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra ?? {};
// EXPO_PUBLIC_API_URL (set per EAS build profile) wins; app.json extra.apiUrl is the dev default
// (10.0.2.2 = your computer's localhost from the Android emulator).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || 'http://localhost:4000').replace(/\/$/, '');
export const GOOGLE = { androidClientId: extra.googleAndroidClientId || undefined, webClientId: extra.googleWebClientId || undefined };

const KEY = 'nalam_token';
let token = null;
const store = {
  get: () => (Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) ?? null : SecureStore.getItemAsync(KEY)),
  set: (v) => (Platform.OS === 'web' ? globalThis.localStorage?.setItem(KEY, v) : SecureStore.setItemAsync(KEY, v)),
  del: () => (Platform.OS === 'web' ? globalThis.localStorage?.removeItem(KEY) : SecureStore.deleteItemAsync(KEY)),
};
let tokenLoaded = null;
/** Reads the saved token once; every API call waits for it so cold-start requests are authenticated. */
export function loadToken() {
  tokenLoaded ??= Promise.resolve(store.get()).then((t) => { token = t; return t; });
  return tokenLoaded;
}
export async function saveToken(t) { await loadToken(); token = t; t ? await store.set(t) : await store.del(); }
export const hasToken = () => !!token;

export class ApiError extends Error {
  constructor(status, body) { super(body?.error || `Request failed (${status})`); this.status = status; this.body = body; }
}

let handlers = { onUnauthorized: () => {}, onPaywall: () => {} };
export const setApiHandlers = (h) => { handlers = { ...handlers, ...h }; };

export async function api(path, { method = 'GET', body, silentPaywall } = {}) {
  await loadToken();
  const headers = { Accept: 'application/json' };
  const sent = token; // only a rejected token we actually sent should sign the user out
  if (sent) headers.Authorization = `Bearer ${sent}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, { error: 'Cannot reach Nalam servers. Check your internet connection.' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && sent && sent === token) handlers.onUnauthorized();
    if (res.status === 402 && !silentPaywall) handlers.onPaywall(data);
    throw new ApiError(res.status, data);
  }
  return data;
}

export const img = (url) => (!url ? undefined : /^https?:/.test(url) ? url : `${API_URL}${url}`);
export const rupees = (p) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
