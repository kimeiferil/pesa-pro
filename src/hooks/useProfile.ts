import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  whatsapp_phone: string;
  whatsapp_same_as_phone: boolean;
  gender: 'male' | 'female';
  goals: string[];
  created_at: string;
  updated_at: string;
};

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (queryError) throw queryError;
      setProfile(data as Profile);
    } catch (e: any) {
      setError(e.message ?? 'Unable to load profile');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveProfile = useCallback(async (payload: Partial<Profile>) => {
    if (!user) return null;
    setLoading(true);
    setError(null);

    const payloadWithTimestamp = {
      ...payload,
      id: user.id,
      updated_at: new Date().toISOString(),
    } as Partial<Profile>;

    try {
      const { data, error: upsertError } = await supabase
        .from('profiles')
        .upsert(payloadWithTimestamp)
        .select()
        .single();

      if (upsertError) throw upsertError;
      setProfile(data as Profile);
      return data as Profile;
    } catch (e: any) {
      setError(e.message ?? 'Unable to save profile');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    fetchProfile,
    saveProfile,
  };
}
