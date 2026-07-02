import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

export const ALLOWED_DOMAIN = 'intuscorp.com';

// When Supabase env vars are missing the app runs in "modo local": no login,
// data persisted in this browser only. Lets the app be developed/verified
// before the Supabase keys are configured.
export const authDisabled = !supabase;

const LOCAL_SESSION = {
  local: true,
  user: { email: 'modo-local@' + ALLOWED_DOMAIN, id: 'local' },
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = loading, null = signed out, object = session
  const [session, setSession] = useState(authDisabled ? LOCAL_SESSION : undefined);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Enforce company domain client-side (server-side enforcement lives in RLS
  // policies + backend middleware — see supabase/schema.sql).
  useEffect(() => {
    if (!supabase || !session?.user?.email) return;
    const email = session.user.email.toLowerCase();
    if (!email.endsWith('@' + ALLOWED_DOMAIN)) {
      supabase.auth.signOut().then(() => {
        setAuthError(`Acceso restringido a cuentas @${ALLOWED_DOMAIN}. Sesión cerrada (${email}).`);
      });
    }
  }, [session]);

  async function signInGoogle() {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { hd: ALLOWED_DOMAIN, prompt: 'select_account' },
      },
    });
    if (error) setAuthError(error.message);
  }

  async function signInPassword(email, password) {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
  }

  const value = {
    session,
    user: session?.user ?? null,
    signOut,
    signInGoogle,
    signInPassword,
    authDisabled,
    authError,
    setAuthError,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
