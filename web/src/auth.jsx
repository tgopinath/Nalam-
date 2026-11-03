import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setApiHandlers, setToken } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, access: null });
  const [config, setConfig] = useState(null);
  const [paywall, setPaywall] = useState(null);

  const refresh = useCallback(async () => {
    if (!getToken()) return setState({ loading: false, user: null, access: null });
    try {
      const me = await api('/me');
      setState({ loading: false, user: me.user, access: me.access });
    } catch {
      setState({ loading: false, user: null, access: null });
    }
  }, []);

  const signIn = useCallback((session) => {
    setToken(session.token);
    setState({ loading: false, user: session.user, access: session.access });
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setState({ loading: false, user: null, access: null });
  }, []);

  useEffect(() => {
    setApiHandlers({ onUnauthorized: signOut, onPaywall: (d) => setPaywall(d || {}) });
    api('/config').then(setConfig).catch(() => setConfig({ authMethods: { phone: true, email: true, google: false }, plans: [], trialDays: 7, features: {} }));
    refresh();
  }, [refresh, signOut]);

  const value = useMemo(
    () => ({
      ...state,
      config,
      refresh,
      signIn,
      signOut,
      setUser: (user) => setState((s) => ({ ...s, user })),
      setSession: (s) => setState((p) => ({ ...p, user: s.user, access: s.access })),
      can: (f) => !!state.access?.features?.includes(f),
      paywall,
      setPaywall,
    }),
    [state, config, refresh, signIn, signOut, paywall],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
