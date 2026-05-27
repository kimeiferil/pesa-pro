import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ParsedTransaction } from '../shared/mpesaParser';

export interface MatchResult {
  member: any | null;
  confidence: number;
  reason: string;
}

export function useSmsMatcher() {
  const matchTransaction = useCallback(async (
    txn: ParsedTransaction,
    groupId: string | null
  ): Promise<MatchResult> => {
    if (!txn.phone || !groupId) {
      return { member: null, confidence: 10, reason: 'No phone number or group selected' };
    }

    // 1. Fetch member by phone in this group
    const { data: member, error } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('phone', txn.phone)
      .maybeSingle();

    if (error) {
      console.error('[SmsMatcher] Error:', error);
      return { member: null, confidence: 0, reason: 'Database error' };
    }

    if (!member) {
      return { member: null, confidence: 20, reason: 'No matching member found for this phone' };
    }

    // 2. Fetch group settings (e.g. monthly amount)
    const { data: group } = await supabase
      .from('groups')
      .select('monthly_amount')
      .eq('id', groupId)
      .single();

    let confidence = 80; // Base confidence for a phone match
    let reason = 'Phone number matched to ' + member.name;

    // 3. Score based on amount
    if (group?.monthly_amount && txn.amount === group.monthly_amount) {
      confidence = 100;
      reason = 'Perfect match: Phone + Monthly Amount (' + txn.amount + ')';
    } else if (txn.amount && txn.amount > 0) {
      reason += '. Amount (' + txn.amount + ') differs from monthly requirement.';
    }

    return { member, confidence, reason };
  }, []);

  return { matchTransaction };
}
