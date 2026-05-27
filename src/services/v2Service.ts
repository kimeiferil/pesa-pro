import { supabase } from '../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- Types ───────────────────────────────────────────────────────────────────

export interface RecurringPayment {
  id: string;
  merchant: string;
  amount: number;
  frequency: string;
  category_id?: number;
  next_expected_date: string;
  is_active: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  color: string;
  emoji: string;
  allocation_percent: number;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  value: number;
}

export interface Debt {
  id: string;
  contact_name: string;
  contact_phone: string;
  amount: number;
  direction: 'lent' | 'borrowed';
  due_date: string;
  status: 'active' | 'paid';
}

// --- Hooks ────────────────────────────────────────────────────────────────────

export function useRecurringPayments() {
  return useQuery({
    queryKey: ['recurring_payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_payments')
        .select('*, categories(name, icon)')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    networkMode: 'offlineFirst',
  });
}

export function useSavingsGoals() {
  return useQuery({
    queryKey: ['savings_goals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('savings_goals').select('*');
      if (error) throw error;
      return data as SavingsGoal[];
    },
    networkMode: 'offlineFirst',
  });
}

export function useNetWorth() {
  return useQuery({
    queryKey: ['net_worth'],
    queryFn: async () => {
      const { data: assets, error: aErr } = await supabase.from('assets').select('*');
      if (aErr) throw aErr;

      // Calculate from latest transactions balance too
      const { data: latestTxn } = await supabase
        .from('transactions')
        .select('balance_after')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const totalAssets = (assets as Asset[]).reduce((sum, a) => sum + Number(a.value), 0);
      const mpesaBalance = Number(latestTxn?.balance_after || 0);

      return {
        total: totalAssets + mpesaBalance,
        assets: assets as Asset[],
        mpesa: mpesaBalance
      };
    },
    networkMode: 'offlineFirst',
  });
}

export function useDebtsV2() {
  return useQuery({
    queryKey: ['debts_v2'],
    queryFn: async () => {
      const { data, error } = await supabase.from('debts').select('*').neq('status', 'paid');
      if (error) throw error;
      return data as Debt[];
    },
    networkMode: 'offlineFirst',
  });
}

// --- Mutations ───────────────────────────────────────────────────────────────

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: Partial<SavingsGoal>) => {
      const { data, error } = await supabase.from('savings_goals').insert([goal]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savings_goals'] }),
  });
}
