import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type ForecastDay = {
  date: string;
  projected_balance: number;
  projected_inflow: number;
  projected_outflow: number;
};

export type CashFlowResult = {
  status: 'healthy' | 'warning' | 'critical';
  tip: string;
  forecast: ForecastDay[];
  days: Array<{ date: string; inflow: number; outflow: number; net: number; count: number }>;
  business_name: string;
  generated_at: string;
};

// 15 min cache — saves Edge Function invocations
const CACHE_TTL_MS = 1000 * 60 * 15;

export function useCashFlowWarning(businessId: string | null) {
  const [result, setResult]   = useState<CashFlowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const cacheRef              = useRef<{ data: CashFlowResult; ts: number } | null>(null);

  const fetch = useCallback(async (forceRefresh = false) => {
    if (!businessId) return;

    if (
      !forceRefresh &&
      cacheRef.current &&
      Date.now() - cacheRef.current.ts < CACHE_TTL_MS
    ) {
      setResult(cacheRef.current.data);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('calculate-cash-flow', {
        body: { business_id: businessId },
      });

      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      cacheRef.current = { data, ts: Date.now() };
      setResult(data as CashFlowResult);
    } catch (e: any) {
      setError(e.message ?? 'Failed to calculate cash flow');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  // Auto-fetch when businessId changes
  useEffect(() => { fetch(); }, [fetch]);

  return { result, loading, error, refresh: () => fetch(true) };
}