import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';

export const dataService = {
  /**
   * Completely wipes all data for the current user.
   * 1. Clear local storage
   * 2. Clear React Query cache
   * 3. If logged in, delete remote data (RLS will ensure only their data is deleted)
   */
  async wipeAllData() {
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Remote cleanup (if authenticated)
    if (user) {
      console.log('[DataService] Wiping remote data for user:', user.id);

      // We perform explicit deletes.
      // Most of our tables have ON DELETE CASCADE linked to user_id or group_id (which links to owner_id)
      // but let's be thorough for transparency.

      const tables = [
        'transaction_splits',
        'transactions',
        'group_members',
        'groups',
        'public_meeting_links',
        'public_mentor_links',
        'audit_logs',
        'payments_submissions'
      ];

      for (const table of tables) {
        try {
          await supabase.from(table).delete().neq('created_at', '1970-01-01'); // Force delete all
        } catch (e) {
          console.warn(`[DataService] Failed to clear table ${table}:`, e);
        }
      }

      // Finally sign out to clear session
      await supabase.auth.signOut();
    }

    // 2. Local cleanup
    console.log('[DataService] Wiping local storage and cache');
    localStorage.clear();
    queryClient.clear();

    // Force a full reload to reset all app states
    window.location.href = '/login';
  },

  /**
   * Returns a breakdown of what is stored where for transparency.
   */
  getTransparencyReport() {
    return {
      local: [
        { key: 'pesapro_cached_profile', description: 'Your basic profile info (name, email) for faster loading.' },
        { key: 'pesapro_sync_queue', description: 'Transactions you saved while offline, waiting to sync.' },
        { key: 'current_business_id', description: 'The ID of the last business/group you viewed.' },
        { key: 'supabase.auth.token', description: 'Your secure login session (if logged in).' },
        { key: 'TanStack Query Cache', description: 'Encrypted temporary storage of your transaction list for speed.' }
      ],
      remote: [
        { table: 'profiles', description: 'Your account details and preferences.' },
        { table: 'transactions', description: 'The M-Pesa messages you have parsed and saved.' },
        { table: 'groups', description: 'Your Chamas and Businesses.' },
        { table: 'transaction_splits', description: 'How you categorized your group payments.' },
        { table: 'audit_logs', description: 'A history of changes for the 7-day undo feature.' }
      ],
      processing: [
        { step: 'SMS Parsing', description: 'Happens entirely on your phone. No raw SMS text is sent to our servers unless you save it.' }
      ]
    };
  }
};
