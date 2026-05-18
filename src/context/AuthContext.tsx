import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: any;
  session: any;
  profile: any;
  loading: boolean;
  emailVerified: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, metadata?: any) => Promise<any>;
  signOut: () => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const PROFILE_CACHE_KEY = 'pesapro_cached_profile';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]                   = useState<any>(null);
  const [session, setSession]             = useState<any>(null);

  const [profile, setProfile]             = useState<any>(() => {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  });

  // Start loading as false if we have a cached profile to prevent flicker
  const [loading, setLoading]             = useState(!profile);
  const [emailVerified, setEmailVerified] = useState(!!profile);
  const initialized = useRef(false);

  // Helper to update profile + cache
  const updateProfile = useCallback((newProfile: any) => {
    setProfile(newProfile);
    if (newProfile) {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(newProfile));
    } else {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  }, []);

  // ── Load profile from DB, create it if missing ──────────────────────────────
  const loadProfile = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        updateProfile(data);
      } else if (!data && !error && navigator.onLine) {
        // Only try to create/upsert if we are online and profile really doesn't exist
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser && authUser.id === userId) {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .upsert([{
              id: userId,
              email: authUser.email,
              full_name: authUser.user_metadata?.full_name || authUser.email,
              updated_at: new Date().toISOString(),
            }])
            .select()
            .maybeSingle();
          if (!insertError) updateProfile(newProfile);
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  }, [updateProfile]);

  // ── Sync emailVerified from user object ──────────────────────────────────────
  const updateVerified = useCallback((u: any) => {
    const verified = !!u?.email_confirmed_at;
    setEmailVerified(verified);
    return verified;
  }, []);

  // ── Bootstrap auth on mount ──────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // Failsafe: release loading after 5 s no matter what
    const failsafe = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth init timeout — releasing loading state');
        setLoading(false);
      }
    }, 5000);

    const initializeAuth = async () => {
      if (initialized.current) return;
      initialized.current = true;
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          updateVerified(initialSession?.user ?? null);
          if (initialSession?.user) loadProfile(initialSession.user.id);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (mounted) { setLoading(false); clearTimeout(failsafe); }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!mounted) return;
      console.log('Auth event:', event);

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      updateVerified(currentSession?.user ?? null);

      if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
        if (currentSession?.user) loadProfile(currentSession.user.id);
      } else if (event === 'SIGNED_OUT') {
        updateProfile(null);
        setEmailVerified(false);
      }

      setLoading(false);
    });

    return () => { mounted = false; clearTimeout(failsafe); subscription.unsubscribe(); };
  }, [loadProfile, updateVerified]);

  // ── Auth actions ─────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email: string, password: string, metadata: any = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/verify`,
      },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null); setSession(null); updateProfile(null);
      setEmailVerified(false); setLoading(false);
    }
  };

  const resendVerification = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/verify` },
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading, emailVerified,
      signIn, signUp, signOut, resendVerification,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}