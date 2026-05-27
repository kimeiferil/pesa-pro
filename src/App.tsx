// src/App.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  BrowserRouter as Router,
  Routes, Route, Navigate,
  useLocation, useNavigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './lib/supabase';
import { processSyncQueue } from './lib/syncQueue';

// Context & Providers
import { AuthProvider, useAuth } from './context/AuthContext';

// Navigation
import { Sidebar, BottomNav } from './components/AppNav';
import VerifyEmail from './pages/VerifyEmail';

// Pages
import Login             from './pages/Login';
import Signup            from './pages/Signup';
import DashboardPage     from './features/dashboard/DashboardPage';
import ImportMessage     from './pages/ImportMessage';
import TransactionsPage  from './pages/TransactionsPage';
import CampaignsPage     from './features/campaigns/CampaignsPage';
import CreateCampaign    from './pages/campaigns/CreateCampaign';
import CampaignDetails   from './pages/campaigns/CampaignDetails';
import MfaSetup          from './pages/MfaSetup';
import MfaChallenge      from './pages/MfaChallenge';
import ChamaManager      from './features/chama/ChamaManager';
import SettingsPage      from './pages/SettingsPage';
import AdminPanel        from './pages/AdminPanel';
import MentorPage        from './pages/MentorPage';

// Update service
import { updateService } from './services/updateService';
import type { AppVersion } from './services/updateService';

// Plan & payment
import { useUserPlan }            from './hooks/useUserPlan';
import { useBusinesses }          from './hooks/useBusinesses';
import PaymentSubmissionModal     from './components/PaymentSubmissionModal';
import type { Plan }              from './config/planLimits';

import { queryClient } from './lib/queryClient';
import type { ParsedTransaction } from './shared/mpesaParser';
import { clearTransactions } from './features/transactions/transactionService';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { useQuery } from '@tanstack/react-query';

// --- App Version ---------------------------------------------------------------
const APP_VERSION = '1.0.3'; // Bump this with each release

function useAppVersionCheck() {
  const [updateInfo, setUpdateInfo] = useState<AppVersion | null>(null);
  const [dismissed,  setDismissed]  = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const result = await updateService.checkForUpdates();
        if (!result.hasUpdate) return;
        if (updateService.hasSeenUpdate(result.latestVersion ?? '')) return;
        if (updateService.isUpdateDeferred()) return;
        setUpdateInfo({
          id:           '',
          version:      result.latestVersion!,
          is_required:  result.isRequired,
          changelog:    result.changelog ?? '',
          download_url: result.downloadUrl,
          release_date: result.releaseDate ?? '',
          created_at:   '',
        });
      } catch {
        // Silently ignore — don't break the app if version check fails
      }
    };
    check();
  }, []);

  const dismiss = () => {
    updateService.deferUpdateReminder(24);
    setDismissed(true);
  };

  const acknowledge = () => {
    if (updateInfo?.version) updateService.acknowledgeUpdate(updateInfo.version);
    setDismissed(true);
  };

  return { updateInfo, dismissed, dismiss, acknowledge };
}

// --- Update Banner ------------------------------------------------------------
function UpdateBanner({
  info, onDismiss, onAcknowledge,
}: {
  info: AppVersion;
  onDismiss: () => void;
  onAcknowledge: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9000,
      background: 'linear-gradient(90deg, #10b981, #059669)',
      color: '#022c22', padding: '10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: 13, fontWeight: 700, gap: 12, flexWrap: 'wrap',
      boxShadow: '0 2px 16px rgba(16,185,129,0.4)',
    }}>
      <span>
        {"\u{1F4E2}"} Pesa Pro v{info.version} is available!
        {info.is_required && <strong style={{ marginLeft: 8 }}>Update required.</strong>}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        {info.download_url && (
          <a
            href={info.download_url}
            target="_blank"
            rel="noreferrer"
            onClick={onAcknowledge}
            style={{
              padding: '5px 14px', background: '#022c22', color: '#10b981',
              borderRadius: 8, textDecoration: 'none', fontWeight: 800, fontSize: 12,
            }}
          >
            Download
          </a>
        )}
        {!info.is_required && (
          <button
            onClick={onDismiss}
            style={{
              padding: '5px 12px', background: 'rgba(0,0,0,0.15)', color: '#022c22',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12,
            }}
          >
            Later
          </button>
        )}
      </div>
    </div>
  );
}

// --- Persistence --------------------------------------------------------------
const persister = createSyncStoragePersister({ storage: window.localStorage });

// --- Routes without nav -------------------------------------------------------
const NO_NAV_ROUTES = ['/login', '/signup', '/mfa', '/verify', '/mfa-challenge'];

// --- Global Loader ------------------------------------------------------------
const GlobalLoader = () => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(160deg, #080d1a 0%, #0b1120 50%, #080d1a 100%)',
  }}>
    <style>{`
      @keyframes spin      { to { transform: rotate(360deg);  } }
      @keyframes spin-slow { to { transform: rotate(-360deg); } }
    `}</style>

    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1,   opacity: 1 }}
      exit={{   scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{ position: 'relative', width: 56, height: 56 }}
    >
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: '3px solid rgba(16,185,129,0.15)',
        borderTopColor: 'rgb(16,185,129)',
        animation: 'spin 0.85s linear infinite',
      }} />
      <div style={{
        position: 'absolute', inset: 8, borderRadius: '50%',
        border: '2px solid rgba(59,130,246,0.15)',
        borderTopColor: 'rgb(59,130,246)',
        animation: 'spin-slow 1.4s linear infinite',
      }} />
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 8, height: 8, borderRadius: '50%',
        background: 'rgb(16,185,129)',
        boxShadow: '0 0 10px rgba(16,185,129,0.55)',
      }} />
    </motion.div>

    <motion.p
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      style={{ marginTop: 20, fontSize: 13, color: 'rgb(100,116,139)', fontFamily: '-apple-system, sans-serif' }}
    >
      Initializing Pesa Pro...
    </motion.p>
  </div>
);

// --- Supabase row → ParsedTransaction -----------------------------------------
function rowToTransaction(row: Record<string, unknown>): ParsedTransaction {
  return {
    transaction_code:  ((row.txn_id || row.transaction_code) as string | null)?.trim() ?? null,
    type:              (row.type              as ParsedTransaction['type']) ?? 'unknown',
    direction:         ((row.type as string) === 'received' || (row.type as string) === 'deposit' || (row.type as string) === 'reversal') ? 'credit' as const : 'debit' as const,
    amount:            row.amount           != null ? Number(row.amount)           : null,
    name:              (row.name              as string | null)            ?? null,
    phone:             (row.phone             as string | null)            ?? null,
    account:           (row.account           as string | null)            ?? null,
    business:          (row.business          as string | null)            ?? null,
    paybill:           (row.paybill           as string | null)            ?? null,
    till:              (row.till              as string | null)            ?? null,
    balance:           row.balance          != null ? Number(row.balance)          : null,
    transaction_cost:  row.transaction_cost != null ? Number(row.transaction_cost) : null,
    fuliza_fee:        row.fuliza_fee       != null ? Number(row.fuliza_fee)       : null,
    fuliza_total_due:  row.fuliza_total_due != null ? Number(row.fuliza_total_due) : null,
    date:              (row.txn_date          as string | null)            ?? null,
    time:              (row.txn_time          as string | null)            ?? null,
    category:          (row.category          as string)                   ?? 'other',
    raw_text:          (row.raw_text          as string)                   ?? '',
    business_id:       (row.business_id       as string | null)            ?? null,
    confidence:        row.confidence       != null ? Number(row.confidence)       : 0,
    needs_review:      Boolean(row.needs_review),
  };
}

// --- useTransactions ----------------------------------------------------------
function useTransactions() {
  const { user } = useAuth();

  const { data: transactions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['transactions', user?.id ?? 'local'],
    queryFn: async () => {
      // 1. Get from Supabase if logged in
      let remote: ParsedTransaction[] = [];
      if (user) {
        let page = 0;
        const PAGE_SIZE = 1000;
        let done = false;

        while (!done) {
          const from = page * PAGE_SIZE;
          const to   = from + PAGE_SIZE - 1;

          const { data, error: qErr } = await supabase
            .from('transactions')
            .select(`
              txn_id, transaction_code, type, amount, name, phone,
              account, business, paybill, till,
              balance, transaction_cost, fuliza_fee, fuliza_total_due,
              txn_date, txn_time,
              category, raw_text, business_id, confidence, needs_review
            `)
            .eq('user_id', user.id)
            .order('txn_date',   { ascending: false })
            .order('created_at', { ascending: false })
            .range(from, to);

          if (qErr) throw qErr;

          const rows = (data ?? []).map(rowToTransaction);
          remote  = [...remote, ...rows];
          done = rows.length < PAGE_SIZE;
          page++;
        }
      }

      // 2. Merge with items in Sync Queue (Local data)
      const queue = JSON.parse(localStorage.getItem('pesapro_sync_queue') || '[]');
      const local = queue.map((item: any) => ({
        ...item.transaction,
        is_local: true,
      }));

      // Combine and remove duplicates (prefer remote if same code)
      const combined = [...local, ...remote];
      const unique = Array.from(new Map(combined.map(t => [t.transaction_code, t])).values());

      return unique;
    },
    // Keep data longer to support offline use
    staleTime: 1000 * 60 * 5,
    gcTime:    1000 * 60 * 60 * 24,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    // Use a unique suffix to avoid "channel already subscribed" errors on re-renders
    const channelId = `tx-sync-${user.id.slice(0, 8)}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
        () => { if (navigator.onLine) refetch(); },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  return {
    transactions,
    loading: isLoading,
    error:   error instanceof Error ? error.message : null,
    refetch,
  };
}

// --- Protected Route ----------------------------------------------------------
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, emailVerified } = useAuth();

  if (loading) return <GlobalLoader />;

  // If user exists but email is not verified, force verification
  if (user && !emailVerified) {
    return <Navigate to="/verify" replace />;
  }

  // Otherwise allow access (Local-only mode if !user)
  return <>{children}</>;
}

// --- Dashboard wrapper --------------------------------------------------------
function DashboardRoute({ transactions }: { transactions: ParsedTransaction[] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { plan } = useUserPlan(user?.id);

  const [upgradeModal, setUpgradeModal] = useState<{
    open: boolean;
    plan: Exclude<Plan, 'basic'>;
  }>({ open: false, plan: 'pro' });

  return (
    <>
      <DashboardPage
        transactions={transactions}
        username={user?.email?.split('@')[0] ?? 'User'}
        mfaEnabled={false}
        plan={plan}
        onSignOut={async () => {
          await supabase.auth.signOut();
          navigate('/login', { replace: true });
        }}
        onNavigate={(page) => navigate(page.startsWith('/') ? page : `/${page}`)}
        onUpgrade={(newPlan) => {
          if (newPlan === 'basic') return;
          setUpgradeModal({ open: true, plan: newPlan as Exclude<Plan, 'basic'> });
        }}
      />

      {upgradeModal.open && user && (
        <PaymentSubmissionModal
          userId={user.id}
          userPhone={user.phone ?? ''}
          planRequested={upgradeModal.plan}
          onClose={() => setUpgradeModal({ open: false, plan: 'pro' })}
        />
      )}
    </>
  );
}

// --- Transactions wrapper -----------------------------------------------------
function TransactionsRoute({ transactions: allTransactions }: { transactions: ParsedTransaction[] }) {
  const navigate = useNavigate();
  const { currentBusinessId: bizId, currentBusiness } = useBusinesses();
  const { refetch } = useTransactions();

  const transactions = useMemo(() => {
    if (!bizId) return allTransactions.filter(t => !t.business_id);
    return allTransactions.filter(t => t.business_id === bizId);
  }, [allTransactions, bizId]);

  const handleClearAll = useCallback(async () => {
    try {
      await clearTransactions(bizId);
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to clear transactions');
    }
  }, [bizId, refetch]);

  return (
    <TransactionsPage
      transactions={transactions}
      businessName={currentBusiness?.name ?? 'Personal'}
      onBack={() => navigate(-1)}
      onClearAll={handleClearAll}
    />
  );
}

// --- App Shell ----------------------------------------------------------------
function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const showNav  = user && !NO_NAV_ROUTES.includes(location.pathname);

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: 'linear-gradient(160deg, #080d1a 0%, #0b1120 50%, #080d1a 100%)',
    }}>
      {showNav && <div className="nav-sidebar"><Sidebar /></div>}

      <main
        style={{ flex: 1, minWidth: 0, paddingBottom: showNav ? 'var(--bottom-nav-height, 72px)' : 0 }}
        className={showNav ? 'has-nav' : ''}
      >
        {children}
      </main>

      {showNav && <div className="nav-bottom"><BottomNav /></div>}

      <style>{`
        @media (min-width: 768px) {
          .nav-sidebar { display: flex; }
          .nav-bottom  { display: none;  }
          .has-nav     { padding-bottom: 0 !important; }
        }
        @media (max-width: 767px) {
          .nav-sidebar { display: none;  }
          .nav-bottom  { display: block; }
        }
      `}</style>
    </div>
  );
}

// --- App Routes ---------------------------------------------------------------
function AppRoutes() {
  const { user, loading } = useAuth();
  const { transactions, error: txnError, refetch } = useTransactions();
  const { updateInfo, dismissed, dismiss, acknowledge } = useAppVersionCheck();

  useEffect(() => {
    const handleSync = () => {
      if (!navigator.onLine) return;
      processSyncQueue().then(count => {
        if (count && count > 0) {
          console.log(`[Sync] Synced ${count} items from offline queue`);
          refetch();
        }
      });
    };

    handleSync();
    window.addEventListener('online', handleSync);

    if (Capacitor.getPlatform() !== 'android') {
      return () => window.removeEventListener('online', handleSync);
    }

    const onPause   = () => console.log('[Native] App paused');
    const onResume  = () => { console.log('[Native] App resumed'); handleSync(); refetch(); };
    const onBattery = (e: any) => {
      if (e.level < 0.2 && !e.isPlugged) console.warn('[Native] Low battery:', e.level);
    };
    document.addEventListener('pause',         onPause);
    document.addEventListener('resume',        onResume);
    window  .addEventListener('batterystatus', onBattery);
    return () => {
      window  .removeEventListener('online',       handleSync);
      document.removeEventListener('pause',        onPause);
      document.removeEventListener('resume',       onResume);
      window  .removeEventListener('batterystatus',onBattery);
    };
  }, [refetch]);

  if (loading) return <GlobalLoader />;

  return (
    <AppShell>
      {updateInfo && !dismissed && (
        <UpdateBanner info={updateInfo} onDismiss={dismiss} onAcknowledge={acknowledge} />
      )}

      {txnError && transactions.length === 0 && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 8888,
          background: '#7f1d1d', color: '#fca5a5',
          padding: '8px 16px', fontSize: 13, textAlign: 'center',
        }}>
          Could not load transactions: {txnError}&nbsp;&mdash;&nbsp;
          <button
            onClick={() => refetch()}
            style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Retry
          </button>
        </div>
      )}

      <div style={{ overflowX: 'hidden' }}>
        <Routes>
          {/* -- Public -- */}
          <Route path="/verify"        element={<VerifyEmail />} />
          <Route path="/mfa-challenge" element={<MfaChallenge />} />
          <Route path="/login"         element={<Login />} />
          <Route path="/signup"        element={<Signup />} />

          {/* -- Protected -- */}
          <Route path="/" element={
            <ProtectedRoute><DashboardRoute transactions={transactions} /></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardRoute transactions={transactions} /></ProtectedRoute>
          } />
          <Route path="/transactions" element={
            <ProtectedRoute><TransactionsRoute transactions={transactions} /></ProtectedRoute>
          } />
          <Route path="/import"           element={<ProtectedRoute><ImportMessage /></ProtectedRoute>} />
          <Route path="/campaigns"        element={<ProtectedRoute><CampaignsPage /></ProtectedRoute>} />
          <Route path="/campaigns/create" element={<ProtectedRoute><CreateCampaign /></ProtectedRoute>} />
          <Route path="/campaigns/:id"    element={<ProtectedRoute><CampaignDetails /></ProtectedRoute>} />
          <Route path="/mfa"              element={<ProtectedRoute><MfaSetup /></ProtectedRoute>} />
          <Route path="/chama"            element={<ProtectedRoute><ChamaManager /></ProtectedRoute>} />
          <Route path="/settings"         element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/admin"            element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
          <Route path="/mentor/:token"    element={<MentorPage />} />

          {/* -- Catch-all -- */}
          <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
        </Routes>
      </div>
    </AppShell>
  );
}

// --- Root ---------------------------------------------------------------------
export default function App() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <Router>
        <AuthProvider>
          <AnimatePresence mode="wait">
            <AppRoutes />
          </AnimatePresence>
        </AuthProvider>
      </Router>
    </PersistQueryClientProvider>
  );
}