import React from 'react'
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'

// Lazy-load pages so the initial bundle stays small
const Dashboard    = lazy(() => import('./features/dashboard/DashboardPage'))
const Transactions = lazy(() => import('./pages/TransactionsPage'))
const Budgets      = lazy(() => import('./pages/BudgetsPage'))
const Chama        = lazy(() => import('./features/chama/ChamaManager'))
const Settings     = lazy(() => import('./pages/SettingsPage'))

// Fallback shown while a page chunk loads
const PageLoader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#111411', color: '#00A651', fontSize: 14,
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  }}>
    Loading...
  </div>
)

// ── Wrappers that supply required props to lazy page components ───────────────
// DashboardPage and TransactionsPage both require a `transactions` prop.
// These wrappers source transactions from localStorage/sync-queue so the
// router stays decoupled from the full auth/query stack.
function DashboardWrapper() {
  const [transactions, setTransactions] = React.useState<any[]>([]);
  React.useEffect(() => {
    try {
      const q = JSON.parse(localStorage.getItem('pesapro_sync_queue') || '[]');
      setTransactions(q.map((i: any) => i.transaction ?? i));
    } catch { /* ignore */ }
  }, []);
  return <Dashboard transactions={transactions} />;
}

function TransactionsWrapper() {
  const [transactions, setTransactions] = React.useState<any[]>([]);
  React.useEffect(() => {
    try {
      const q = JSON.parse(localStorage.getItem('pesapro_sync_queue') || '[]');
      setTransactions(q.map((i: any) => i.transaction ?? i));
    } catch { /* ignore */ }
  }, []);
  return <Transactions transactions={transactions} />;
}

// HashRouter is required for Capacitor Android — BrowserRouter breaks on file:// protocol
export const router = createHashRouter([
  { path: '/',             element: <Navigate to="/dashboard" replace /> },
  { path: '/dashboard',   element: <Suspense fallback={<PageLoader />}><DashboardWrapper /></Suspense> },
  { path: '/transactions', element: <Suspense fallback={<PageLoader />}><TransactionsWrapper /></Suspense> },
  { path: '/budgets',     element: <Suspense fallback={<PageLoader />}><Budgets /></Suspense> },
  { path: '/chama',       element: <Suspense fallback={<PageLoader />}><Chama /></Suspense> },
  { path: '/settings',    element: <Suspense fallback={<PageLoader />}><Settings /></Suspense> },
  { path: '*',            element: <Navigate to="/dashboard" replace /> },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}