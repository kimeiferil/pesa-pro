import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMentorView } from '../hooks/useMentorView';
import { ChevronLeft, Building2, TrendingUp, TrendingDown, Clock, AlertCircle, Users, Table } from 'lucide-react';

export default function MentorPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data, loading, error } = useMentorView(token ?? null);

  const fmt = (n: number) =>
    n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080d1a', color: '#64748b' }}>
      Loading mentor summary...
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#080d1a', padding: 20 }}>
      <AlertCircle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
      <p style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Link Invalid or Expired</p>
      <p style={{ color: '#64748b', textAlign: 'center', marginTop: 8 }}>Please ask the business owner for a new mentor link.</p>
      <button onClick={() => navigate('/login')} style={{ marginTop: 24, padding: '12px 24px', borderRadius: 50, background: '#00C851', color: '#fff', border: 'none', fontWeight: 700 }}>
        Go to Login
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f3f6f2', fontFamily: 'Sora, sans-serif' }}>
      <header style={{ background: 'linear-gradient(145deg,#00C851 0%,#005c28 100%)', padding: '24px 20px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={24} />
          </div>
          <div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>MENTOR VIEW</p>
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>{data.business_name}</h1>
          </div>
        </div>
      </header>

      <main style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={S.statCard}>
            <TrendingUp size={20} color="#00C851" />
            <p style={S.statLabel}>Total Inflow</p>
            <p style={S.statValue}>KES {fmt(data.total_inflow)}</p>
          </div>
          <div style={S.statCard}>
            <TrendingDown size={20} color="#ef4444" />
            <p style={S.statLabel}>Total Outflow</p>
            <p style={S.statValue}>KES {fmt(data.total_outflow)}</p>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Table size={18} color="#00C851" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Live Meeting Ledger</h3>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Current contributions for this month.</p>
          {/* We would map through transactions here */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13, border: '1px dashed #e2e8f0' }}>
            Ledger data will appear here during the meeting.
          </div>
        </div>

        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <AlertCircle size={18} color="#f59e0b" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Debt Summary</h3>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ color: '#64748b', fontSize: 13 }}>Outstanding Amount</span>
            <span style={{ fontWeight: 800, color: '#ef4444' }}>KES {fmt(data.outstanding_debt_amount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b', fontSize: 13 }}>Open Debts</span>
            <span style={{ fontWeight: 800 }}>{data.open_debts}</span>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Table size={18} color="#00C851" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Live Meeting Ledger</h3>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Current contributions for this month.</p>
          {/* We would map through transactions here */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13, border: '1px dashed #e2e8f0' }}>
            Ledger data will appear here during the meeting.
          </div>
        </div>

        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Clock size={18} color="#3b82f6" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Activity</h3>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ color: '#64748b', fontSize: 13 }}>Total Transactions</span>
            <span style={{ fontWeight: 800 }}>{data.total_transactions}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b', fontSize: 13 }}>Last Transaction</span>
            <span style={{ fontWeight: 600 }}>{data.last_transaction_at ? new Date(data.last_transaction_at).toLocaleDateString() : 'N/A'}</span>
          </div>
        </div>
      </main>
    </div>
  );
}

const S = {
  statCard: {
    background: '#fff', borderRadius: 16, padding: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  statLabel: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, marginTop: 8 },
  statValue: { fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 },
  card: {
    background: '#fff', borderRadius: 16, padding: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  }
};
