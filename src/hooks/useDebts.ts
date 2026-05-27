import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type DebtDirection = 'owed_to_us' | 'owed_by_us';
export type DebtStatus    = 'pending' | 'partial' | 'paid' | 'overdue';

export type Debt = {
  id: string;
  business_id: string;
  customer_id: string | null;
  direction: DebtDirection;
  amount: number;
  paid_amount: number;
  due_date: string | null;
  status: DebtStatus;
  description: string | null;
  created_at: string;
  customer?: { id: string; name: string; phone: string | null } | null;
};

export type CreateDebtInput = {
  customer_id?: string | null;
  direction: DebtDirection;
  amount: number;
  due_date?: string | null;
  description?: string | null;
};

export function useDebts(businessId: string | null) {
  const [debts, setDebts]     = useState<Debt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const fetchDebts = useCallback(async () => {
    if (!businessId) { setDebts([]); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('debts')
        .select(`
          id, business_id, customer_id, direction,
          amount, paid_amount, due_date, status, description, created_at,
          customer:customers(id, name, phone)
        `)
        .eq('business_id', businessId)
        .neq('status', 'paid')
        .order('created_at', { ascending: false });

      if (qErr) throw qErr;
      setDebts((data ?? []) as unknown as Debt[]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load debts');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  const createDebt = useCallback(async (input: CreateDebtInput): Promise<Debt | null> => {
    if (!businessId) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error: insErr } = await supabase
      .from('debts')
      .insert({
        user_id:     user.id,
        business_id: businessId,
        customer_id: input.customer_id ?? null,
        direction:   input.direction,
        amount:      input.amount,
        due_date:    input.due_date ?? null,
        description: input.description ?? null,
      })
      .select()
      .single();

    if (insErr) { setError(insErr.message); return null; }
    await fetchDebts();
    return data as Debt;
  }, [businessId, fetchDebts]);

  const recordPayment = useCallback(async (
    debtId: string,
    paymentAmount: number,
  ): Promise<boolean> => {
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return false;

    const newPaid  = Math.min(debt.paid_amount + paymentAmount, debt.amount);
    const newStatus: DebtStatus = newPaid >= debt.amount ? 'paid' : 'partial';

    const { error: upErr } = await supabase
      .from('debts')
      .update({ paid_amount: newPaid, status: newStatus })
      .eq('id', debtId);

    if (upErr) { setError(upErr.message); return false; }
    await fetchDebts();
    return true;
  }, [debts, fetchDebts]);

  const deleteDebt = useCallback(async (debtId: string): Promise<boolean> => {
    const { error: delErr } = await supabase.from('debts').delete().eq('id', debtId);
    if (delErr) { setError(delErr.message); return false; }
    setDebts(prev => prev.filter(d => d.id !== debtId));
    return true;
  }, []);

  const sendSmsReminder = useCallback(async (debtId: string): Promise<string | null> => {
    const { data, error: fnErr } = await supabase.functions.invoke('debt-sms-text', {
      body: { debt_id: debtId, send_sms: true },
    });
    if (fnErr || data?.error) return null;
    return data?.english ?? null;
  }, []);

  const summary = {
    totalOwedToUs: debts.filter(d => d.direction === 'owed_to_us')
                       .reduce((s, d) => s + d.amount - d.paid_amount, 0),
    totalOwedByUs: debts.filter(d => d.direction === 'owed_by_us')
                       .reduce((s, d) => s + d.amount - d.paid_amount, 0),
    overdueCount:  debts.filter(d =>
                     d.due_date && new Date(d.due_date) < new Date() && d.status !== 'paid'
                   ).length,
  };

  return {
    debts,
    summary,
    loading,
    error,
    createDebt,
    recordPayment,
    deleteDebt,
    sendSmsReminder,
    refetch: fetchDebts,
  };
}