import React, { useEffect, useState, useCallback } from 'react';
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
import AdminPanel       from './pages/AdminPanel';

// Plan & payment
import { useUserPlan }            from './hooks/useUserPlan';
import PaymentSubmissionModal     from './components/PaymentSubmissionModal';
import type { Plan }              from './config/planLimits';

import type { ParsedTransaction } from './shared/mpesaParser';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { useQuery } from '@tanstack/react-query';

// --- App Version ---------------------------------------------------------------
const APP_VERSION = '1.0.0'; // Bump this with each release

interface AppVersion {
  id: string;
  version: string;
  is_required: boolean;
  changelog: string;
  download_url: string | null;
  release_date: string;
}

function useAppVersionCheck() {
  const [updateInfo, setUpdateInfo] = useState<AppVersion | null>(null);
  const [dismissed,  setDismissed]  = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await supabase
          .from('app_versions')
          .select('*')
          .order('release_date', { ascending: false })
          .limit(1)
          .single();

        if (!data) return;

        // Compare versions â€” simple semver string compare is enough here
        const isNewer = data.version.localeCompare(APP_VERSION, undefined, { numeric: true, sensitivity: 'base' }) > 0;
        if (isNewer) setUpdateInfo(data as AppVersion);
      } catch {
        // silently ignore â€” don't break the app if version check fails
      }
    };
    check();
  }, []);

  return { updateInfo, dismissed, dismiss: () => setDismissed(true) };
}

// --- Update Banner ------------------------------------------------------------
function UpdateBanner({ info, onDismiss }: { info: AppVersion; onDismiss: () => void }) {
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
        ðŸš€ Pesa Pro v{info.version} is available!
        {info.is_required && <strong style={{ marginLeft: 8 }}>Update required.</strong>}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        {info.download_url && (
          <a
            href={info.download_url}
            target="_blank"
            rel="noreferrer"
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
// --- Query Client & Persistence -----------------------------------------------
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60 * 24, // 24 hours
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

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

// --- Supabase row â†’ ParsedTransaction -----------------------------------------
function rowToTransaction(row: Record<string, unknown>): ParsedTransaction {
  return {
    transaction_code: (row.txn_id            as string | null)             ?? null,
    type:             (row.type              as ParsedTransaction['type'])  ?? 'unknown',
    amount:           row.amount           != null ? Number(row.amount)           : null,
    name:             (row.name              as string | null)             ?? null,
    phone:            (row.phone             as string | null)             ?? null,
    account:          (row.account           as string | null)             ?? null,
    business:         (row.business          as string | null)             ?? null,
    paybill:          (row.paybill           as string | null)             ?? null,
    till:             (row.till              as string | null)             ?? null,
    balance:          row.balance          != null ? Number(row.balance)          : null,
    transaction_cost: row.transaction_cost != null ? Number(row.transaction_cost) : null,
    date:             (row.txn_date          as string | null)             ?? null,
    time:             (row.txn_time          as string | null)             ?? null,
    category:         (row.category          as string)                    ?? 'other',
    raw_text:         (row.raw_text          as string)                    ?? '',
    confidence:       row.confidence       != null ? Number(row.confidence)       : 0,
    needs_review:     Boolean(row.needs_review),
  };
}

// --- useTransactions ----------------------------------------------------------
function useTransactions() {
  const { user } = useAuth();

  const { data: transactions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      if (!user) return [];

      let all: ParsedTransaction[] = [];
      let page = 0;
      const PAGE_SIZE = 1000;
      let done = false;

      while (!done) {
        const from = page * PAGE_SIZE;
        const to   = from + PAGE_SIZE - 1;

        const { data, error: qErr } = await supabase
          .from('transactions')
          .select(`
            txn_id, type, amount, name, phone,
            account, business, paybill, till,
            balance, transaction_cost,
            txn_date, txn_time,
            category, raw_text, confidence, needs_review
          `)
          .eq('user_id', user.id)
          .order('txn_date',   { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, to);

        if (qErr) throw qErr;

        const rows = (data ?? []).map(rowToTransaction);
        all  = [...all, ...rows];
        done = rows.length < PAGE_SIZE;
        page++;
      }
      return all;
    },
    enabled: !!user,
    // Persistence settings
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('transactions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
        () => {
          if (navigator.onLine) refetch();
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refetch]);

  return {
    transactions,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
    refetch
  };
}

// --- Protected Route ----------------------------------------------------------
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, emailVerified } = useAuth();
  if (loading)        return <GlobalLoader />;
  if (!user)          return <Navigate to="/login"  replace />;
  if (!emailVerified) return <Navigate to="/verify" replace />;
  return <>{children}</>;
}

// --- Dashboard wrapper --------------------------------------------------------
function DashboardRoute({ transactions }: { transactions: ParsedTransaction[] }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Real-time plan from Supabase â€” updates instantly when you change it in the console
  const { plan } = useUserPlan(user?.id);

  // Upgrade modal state
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
        onNavigate={(page) => {
          // Handle absolute paths (e.g. '/settings', '/mfa') directly;
          // handle page-name shorthands (e.g. 'transactions') with a leading slash.
          if (page.startsWith('/')) {
            navigate(page);
          } else {
            navigate(`/${page}`);
          }
        }}
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
function TransactionsRoute({ transactions }: { transactions: ParsedTransaction[] }) {
  const navigate = useNavigate();
  return (
    <TransactionsPage
      transactions={transactions}
      onBack={() => navigate(-1)}
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
  const { updateInfo, dismissed, dismiss } = useAppVersionCheck();

  // Re-fetch when Android app resumes from background
  useEffect(() => {
    // Process offline queue whenever app starts or becomes online
    const handleSync = () => {
      if (navigator.onLine) {
        processSyncQueue().then(count => {
          if (count && count > 0) {
            console.log(`[Sync] Successfully synced ${count} items from offline queue`);
            refetch();
          }
        });
      }
    };

    handleSync();
    window.addEventListener('online', handleSync);

    if (Capacitor.getPlatform() !== 'android') return;
    const onPause   = () => console.log('[Native] App paused');
    const onResume  = () => {
      console.log('[Native] App resumed');
      handleSync();
      refetch();
    };
    const onBattery = (e: any) => {
      if (e.level < 0.2 && !e.isPlugged) console.warn('[Native] Low battery:', e.level);
    };
    document.addEventListener('pause',         onPause);
    document.addEventListener('resume',        onResume);
    window  .addEventListener('batterystatus', onBattery);
    return () => {
      window.removeEventListener('online', handleSync);
      document.removeEventListener('pause',         onPause);
      document.removeEventListener('resume',        onResume);
      window  .removeEventListener('batterystatus', onBattery);
    };
  }, [refetch]);

  if (loading) return <GlobalLoader />;

  return (
    <AppShell>
      {updateInfo && !dismissed && <UpdateBanner info={updateInfo} onDismiss={dismiss} />}
            {/* Non-blocking error banner (only if no data) */}
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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
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

