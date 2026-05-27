import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type BusinessMember = {
  id: string;
  business_id: string;
  invited_by: string | null;
  user_id: string | null;
  email: string;
  name: string;
  phone: string | null;
  job_title: string | null;
  status: 'pending' | 'active' | 'suspended';
  created_at: string;
};

export type Role = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  permissions: Record<string, string>;
  created_at: string;
};

export function useTeamMembers(businessId: string | null) {
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (!businessId) {
      setMembers([]);
      setRoles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [{ data: memberData, error: memberError }, { data: roleData, error: roleError }] =
        await Promise.all([
          supabase
            .from('business_members')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: true }),
          supabase
            .from('roles')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: true }),
        ]);

      if (memberError) throw memberError;
      if (roleError) throw roleError;

      setMembers((memberData ?? []) as BusinessMember[]);
      setRoles((roleData ?? []) as Role[]);
    } catch (e: any) {
      setError(e.message ?? 'Unable to load team');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const inviteMember = useCallback(async (member: Omit<BusinessMember, 'id' | 'created_at' | 'status'>) => {
    if (!businessId) return null;
    const payload = {
      ...member,
      business_id: businessId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('business_members').insert(payload).select().single();
    if (error) throw error;
    setMembers(prev => [...prev, data as BusinessMember]);
    return data as BusinessMember;
  }, [businessId]);

  const createRole = useCallback(async (role: Omit<Role, 'id' | 'created_at'>) => {
    if (!businessId) return null;
    const payload = {
      ...role,
      business_id: businessId,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('roles').insert(payload).select().single();
    if (error) throw error;
    setRoles(prev => [...prev, data as Role]);
    return data as Role;
  }, [businessId]);

  const assignRole = useCallback(async (memberId: string, roleId: string) => {
    const { data, error } = await supabase.from('member_roles').insert({ member_id: memberId, role_id: roleId }).select().single();
    if (error) throw error;
    return data;
  }, []);

  const updateRole = useCallback(async (roleId: string, updates: Partial<Role>) => {
    const { data, error } = await supabase.from('roles').update(updates).eq('id', roleId).select().single();
    if (error) throw error;
    setRoles(prev => prev.map(r => (r.id === roleId ? (data as Role) : r)));
    return data as Role;
  }, []);

  const removeMember = useCallback(async (memberId: string) => {
    const { error } = await supabase.from('business_members').delete().eq('id', memberId);
    if (error) throw error;
    setMembers(prev => prev.filter(item => item.id !== memberId));
    return true;
  }, []);

  useEffect(() => {
    void fetchTeam();
  }, [fetchTeam]);

  return {
    members,
    roles,
    loading,
    error,
    refetch: fetchTeam,
    inviteMember,
    createRole,
    assignRole,
    updateRole,
    removeMember,
  };
}
