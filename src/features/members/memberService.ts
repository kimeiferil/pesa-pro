import { supabase } from '@/lib/supabase';

// Get member by phone number
export async function getMemberByPhone(phone: string) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();
    
  if (error) {
    console.error('Error fetching member by phone:', error);
    return null;
  }
  
  return data;
}

// Create a new member
export async function createMember(memberData: any) {
  const { data, error } = await supabase
    .from('members')
    .insert([memberData])
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

// Get all members
export async function getMembers() {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('name', { ascending: true });
    
  if (error) throw error;
  return data || [];
}
