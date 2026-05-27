import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type MentorSummary = {
  business_id: string;
  business_name: string;
  business_type: string;
  total_transactions: number;
  total_inflow: number;
  total_outflow: number;
  open_debts: number;
  outstanding_debt_amount: number;
  last_transaction_at: string | null;
};

export function useMentorView(token: string | null) {
  const [data, setData]       = useState<MentorSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);

    supabase
      .rpc('get_mentor_summary', { p_token: token })
      .then(({ data: summary, error: sumErr }) => {
        if (sumErr) setError(sumErr.message);
        else setData(summary as MentorSummary);
        setLoading(false);
      });
  }, [token]);

  return { data, loading, error };
}

// ── Add this RPC to your migration SQL ───────────────────────
/*
create or replace function public.get_mentor_summary(p_token text)
returns json
language plpgsql security definer as $$
declare
  v_business_id uuid;
  v_expires_at  timestamptz;
begin
  select business_id, expires_at
    into v_business_id, v_expires_at
  from public.public_mentor_links
  where token = p_token and is_active = true;

  if v_business_id is null then
    raise exception 'Invalid token';
  end if;

  if v_expires_at is not null and v_expires_at < now() then
    raise exception 'Link expired';
  end if;

  return (
    select row_to_json(s)
    from public.mentor_business_summary s
    where s.business_id = v_business_id
  );
end;
$$;
*/