/**
 * Hirely Auth — guest-first, Supabase magic link + Google when configured.
 */
(function (global) {
  const AUTH_SESSION_KEY = 'hirely_auth_hint';

  let supabase = null;
  let config = { supabaseUrl: '', supabaseAnonKey: '', authEnabled: false };
  let session = null;
  let listeners = [];

  function emit() {
    listeners.forEach((fn) => {
      try {
        fn(session);
      } catch (e) {
        console.warn(e);
      }
    });
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) config = await res.json();
    } catch (e) {
      console.warn('Hirely config unavailable', e);
    }
    return config;
  }

  function isConfigured() {
    return !!(config.supabaseUrl && config.supabaseAnonKey);
  }

  async function init() {
    await loadConfig();
    if (!isConfigured() || !global.supabase?.createClient) {
      emit();
      return { session: null, configured: false };
    }
    supabase = global.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    const { data } = await supabase.auth.getSession();
    session = data?.session || null;
    if (session) localStorage.setItem(AUTH_SESSION_KEY, '1');
    supabase.auth.onAuthStateChange((_event, s) => {
      session = s;
      if (session) localStorage.setItem(AUTH_SESSION_KEY, '1');
      else localStorage.removeItem(AUTH_SESSION_KEY);
      emit();
    });
    emit();
    return { session, configured: true };
  }

  function getSession() {
    return session;
  }

  function getUser() {
    return session?.user || null;
  }

  function isSignedIn() {
    return !!session?.user;
  }

  function isGuest() {
    return !isSignedIn();
  }

  function onAuthChange(fn) {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((x) => x !== fn);
    };
  }

  async function signInWithEmail(email) {
    if (!supabase) throw new Error('Sign-in is not configured yet. Continue as guest — your draft saves on this device.');
    const redirectTo = `${location.origin}${location.pathname}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
    return true;
  }

  async function signInWithGoogle() {
    if (!supabase) throw new Error('Google sign-in is not configured yet.');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}${location.pathname}` },
    });
    if (error) throw error;
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    session = null;
    localStorage.removeItem(AUTH_SESSION_KEY);
    emit();
  }

  function getClient() {
    return supabase;
  }

  global.HirelyAuth = {
    init,
    loadConfig,
    isConfigured,
    getSession,
    getUser,
    isSignedIn,
    isGuest,
    onAuthChange,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    getClient,
  };
})(typeof window !== 'undefined' ? window : globalThis);
