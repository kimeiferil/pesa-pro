import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Plan } from '../config/planLimits';
import { useQuery } from '@tanstack/react-query';

export function useUserPlan(userId: string | undefined) {
  const { data: plan = 'basic', isLoading: loading, refetch } = useQuery({
    queryKey: ['user-plan', userId],
    queryFn: async () => {
      if (!userId) return 'basic';
      const { data } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', userId)
        .single();
      return (data?.plan as Plan) || 'basic';
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  useEffect(() => {
    if (!userId) return;

    // Real-time listener — fires the moment you update plan in Supabase console
    const channel = supabase
      .channel(`user-plan-${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'profiles',
          filter: `id=eq.${userId}`,
        },
        () => {
          if (navigator.onLine) refetch();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, refetch]);

  return { plan, loading };
}
