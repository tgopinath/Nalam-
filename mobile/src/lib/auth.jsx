import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { api, loadToken, saveToken, setApiHandlers } from './api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, access: null });
  const [config, setConfig] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const me = await api('/me');
      setState({ loading: false, user: me.user, access: me.access });
    } catch {
      setState({ loading: false, user: null, access: null });
    }
  }, []);

  const signOut = useCallback(async () => {
    await saveToken(null);
    setState({ loading: false, user: null, access: null });
    router.replace('/login');
  }, []);

  const signIn = useCallback(async (s) => {
    await saveToken(s.token);
    setState({ loading: false, user: s.user, access: s.access });
    router.replace(s.user.onboarded || s.user.role === 'admin' ? '/' : '/onboarding');
  }, []);

  useEffect(() => {
    setApiHandlers({ onUnauthorized: signOut, onPaywall: () => router.push('/premium') });
    api('/config').then(setConfig).catch(() => setConfig({ authMethods: { phone: true, email: true, google: false }, plans: [], features: {}, trialDays: 7 }));
    loadToken().then((t) => (t ? refresh() : setState({ loading: false, user: null, access: null })));
  }, [refresh, signOut]);

  const value = useMemo(() => ({
    ...state, config, refresh, signIn, signOut,
    setUser: (user) => setState((s) => ({ ...s, user })),
    setSession: (s) => setState((p) => ({ ...p, user: s.user, access: s.access })),
    can: (f) => !!state.access?.features?.includes(f),
  }), [state, config, refresh, signIn, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
