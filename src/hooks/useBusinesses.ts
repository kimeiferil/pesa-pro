import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'current_business_id';

export type Business = {
  id: string;
  name: string;
  type: string;
  currency: string;
  created_at: string;
};

export function useBusinesses() {
  const [businesses, setBusinesses]       = useState<Business[]>([]);
  const [currentBusinessId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  // Load persisted business ID on mount
  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id) setCurrentId(id);
  }, []);

  const fetchBusinesses = useCallback(async () => {
    // If not logged in, we only have the implicit 'Personal' (null) business
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBusinesses([]);
      setCurrentId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('businesses')
        .select('id, name, type, currency, created_at')
        .order('created_at', { ascending: true });

      if (qErr) throw qErr;

      const list = data ?? [];
      setBusinesses(list);

      setCurrentId(prev => {
        if (prev && list.find(b => b.id === prev)) return prev;
        const firstId = list[0]?.id ?? null;
        if (firstId) localStorage.setItem(STORAGE_KEY, firstId);
        return firstId;
      });
    } catch (e: any) {
      setError(e.message ?? 'Failed to load businesses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBusinesses(); }, [fetchBusinesses]);

  // Switch business — instant, no reload
  const switchBusiness = useCallback((id: string | null) => {
    setCurrentId(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const createBusiness = useCallback(async (
    name: string,
    type: string = 'other',
  ): Promise<Business | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error: insErr } = await supabase
      .from('businesses')
      .insert({ user_id: user.id, name: name.trim(), type })
      .select()
      .single();

    if (insErr) { setError(insErr.message); return null; }

    await fetchBusinesses();
    switchBusiness(data.id);
    return data as Business;
  }, [fetchBusinesses, switchBusiness]);

  const currentBusiness = businesses.find(b => b.id === currentBusinessId) ?? null;

  const generateMentorLink = useCallback(async (businessId: string): Promise<string | null> => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    const { error } = await supabase
      .from('public_mentor_links')
      .insert({
        business_id: businessId,
        token: token,
        expires_at: expiresAt.toISOString(),
      });

    if (error) {
      console.error('Error creating mentor link:', error);
      return null;
    }

    return token;
  }, []);

  const deleteBusiness = useCallback(async (id: string) => {
    const { error } = await supabase.from('businesses').delete().eq('id', id);
    if (error) {
      setError(error.message);
      return false;
    }
    setBusinesses(prev => prev.filter(b => b.id !== id));
    if (currentBusinessId === id) {
      const next = businesses.find(b => b.id !== id);
      switchBusiness(next?.id ?? null);
    }
    return true;
  }, [businesses, currentBusinessId, switchBusiness]);

  return {
    businesses,
    currentBusiness,
    currentBusinessId,
    switchBusiness,
    createBusiness,
    deleteBusiness,
    generateMentorLink,
    refetch: fetchBusinesses,
    loading,
    error,
  };
}
