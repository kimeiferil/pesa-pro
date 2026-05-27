import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface Budget {
  id: string;
  category: string;
  amount: number;
  rollover: boolean;
}

export function useBudgets(businessId: string | null) {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBudgets = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from('budgets')
      .select('id, category, amount, rollover')
      .eq('user_id', user.id);

    if (businessId) {
      query = query.eq('business_id', businessId);
    } else {
      query = query.is('business_id', null);
    }

    const { data, error } = await query;
    if (!error && data) setBudgets(data);
    setLoading(false);
  }, [user, businessId]);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const saveBudget = async (category: string, amount: number, rollover: boolean = false) => {
    if (!user) return;
    const { error } = await supabase
      .from('budgets')
      .upsert({
        user_id: user.id,
        business_id: businessId,
        category,
        amount,
        rollover,
        updated_at: new Date().toISOString()
      });
    if (!error) fetchBudgets();
  };

  return { budgets, saveBudget, loading, refetch: fetchBudgets };
}
