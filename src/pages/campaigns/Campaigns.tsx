import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { deleteCampaign } from '@/features/campaigns/campaignService';
import { ArrowLeft, Target, Plus, ChevronRight, Trash2, Loader2, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Tokens ────────────────────────────────────────────────── */
const C = {
  bg:          'linear-gradient(160deg, #080d1a 0%, #0b1120 50%, #080d1a 100%)',
  surface:     '#0f1729',
  surfaceHover:'#131f35',
  border:      'rgba(255,255,255,0.06)',
  borderHover: 'rgba(255,255,255,0.13)',
  text:        '#f8fafc',
  textMuted:   '#64748b',
  textSub:     '#94a3b8',
  primary:     '#10b981',
  primaryBg:   'rgba(16,185,129,0.10)',
  primaryGlow: 'rgba(16,185,129,0.18)',
  secondary:   '#3b82f6',
  secondaryBg: 'rgba(59,130,246,0.10)',
  red:         '#ef4444',
  redBg:       'rgba(239,68,68,0.09)',
  amber:       '#f59e0b',
  amberBg:     'rgba(245,158,11,0.09)',
};

interface Campaign {
  id: number;
  title: string;
  category: string;
  description: string;
  target_amount: number;
  current_amount: number;
  beneficiary_name?: string;
  status: string;
  created_at: string;
}

const CATEGORIES = ['medical', 'urgent', 'harambee', 'education', 'celebration'];

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  medical:     { text: '#60a5fa', bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.2)' },
  urgent:      { text: '#f87171', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.2)' },
  harambee:    { text: '#34d399', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.2)' },
  education:   { text: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.2)' },
  celebration: { text: '#fbbf24', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.2)' },
};

/* ─── Campaign card ─────────────────────────────────────────── */
function CampaignCard({ c, onDelete, deletingId, onClick }: {
  c: Campaign; onDelete: (e: React.MouseEvent, id: number) => void;
  deletingId: number | null; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [delHover, setDelHover] = useState(false);
  const progress = Math.min(((c.current_amount || 0) / c.target_amount) * 100, 100);
  const isDeleting = deletingId === c.id;
  const cat = CAT_COLOR[c.category] ?? { text: C.textMuted, bg: 'rgba(255,255,255,0.05)', border: C.border };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? C.surfaceHover : C.surface,
        border: `1px solid ${hover ? C.borderHover : C.border}`,
        borderRadius: 18,
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'all 0.18s',
        transform: hover ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      {/* Progress bar at top */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.04)' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, ${C.primary}, #34d399)`, transition: 'width 0.6s ease', borderRadius: '0 2px 2px 0' }} />
      </div>

      <div style={{ padding: '20px 20px 18px' }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, color: cat.text, background: cat.bg, border: `1px solid ${cat.border}`, padding: '2px 8px', borderRadius: 6, textTransform: 'capitalize', marginBottom: 6, letterSpacing: '0.03em' }}>
              {c.category}
            </span>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
              {c.title}
            </h2>
          </div>
          <button
            onMouseEnter={() => setDelHover(true)}
            onMouseLeave={() => setDelHover(false)}
            onClick={e => onDelete(e, c.id)}
            disabled={isDeleting}
            title="Delete campaign"
            style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              background: delHover ? C.red : C.redBg,
              border: `1px solid ${delHover ? C.red : 'rgba(239,68,68,0.2)'}`,
              color: delHover ? '#fff' : C.red,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', opacity: isDeleting ? 0.5 : 1,
            }}
          >
            {isDeleting
              ? <Loader2 size={13} style={{ animation: 'spin 0.9s linear infinite' }} />
              : <Trash2 size={13} />}
          </button>
        </div>

        {/* Description */}
        <p style={{
          fontSize: 12, color: C.textSub, lineHeight: 1.6, margin: '0 0 16px',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
          overflow: 'hidden', height: 38,
        }}>
          {c.description}
        </p>

        {/* Progress row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, fontSize: 11, fontWeight: 600 }}>
          <span style={{ color: C.textMuted }}>{Math.round(progress)}% raised</span>
          <span style={{ color: C.primary }}>KES {(c.current_amount || 0).toLocaleString()}</span>
        </div>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, ${C.primary}, #34d399)`, borderRadius: 10 }} />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>👤</div>
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{c.beneficiary_name || 'Generic'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textMuted }}>
            <span>View</span>
            <ChevronRight size={13} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main page ─────────────────────────────────────────────── */
export default function CampaignsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadCampaigns();
    const channel = supabase.channel('cam-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, loadCampaigns)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadCampaigns = async () => {
    try {
      const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setCampaigns(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Permanently delete this campaign and all its contribution records?')) return;
    try {
      setDeletingId(id);
      await deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      alert('Delete failed: ' + (err.message || 'Database blocked the operation.'));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.category === filter);

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 38, height: 38, border: `3px solid rgba(16,185,129,0.12)`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.85s linear infinite' }} />
        <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>Loading campaigns…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Nav */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,13,26,0.9)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate('/')}
              style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: `1px solid ${C.border}`, color: C.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ArrowLeft size={15} />
            </button>
            <div style={{ width: 1, height: 18, background: C.border }} />
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: C.text, letterSpacing: '-0.02em' }}>Campaigns</h1>
            {campaigns.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: C.primary, background: C.primaryBg, padding: '2px 8px', borderRadius: 20, border: `1px solid rgba(16,185,129,0.2)` }}>
                {campaigns.length}
              </span>
            )}
          </div>
          <button
            onClick={() => navigate('/campaigns/create')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 9,
              background: C.primary, color: 'rgb(6,78,59)',
              border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: `0 4px 16px ${C.primaryGlow}`,
            }}
          >
            <Plus size={14} /> New Goal
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 64px' }}>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 28, scrollbarWidth: 'none' }}>
          {['all', ...CATEGORIES].map(cat => {
            const active = filter === cat;
            const col = cat !== 'all' ? CAT_COLOR[cat] : null;
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                style={{
                  padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const,
                  transition: 'all 0.15s',
                  background: active
                    ? (col ? col.bg : C.primaryBg)
                    : 'rgba(255,255,255,0.04)',
                  color: active
                    ? (col ? col.text : C.primary)
                    : C.textMuted,
                  boxShadow: active
                    ? `0 0 0 1px ${col ? col.border : 'rgba(16,185,129,0.3)'}`
                    : `0 0 0 1px ${C.border}`,
                  textTransform: 'capitalize',
                }}
              >
                {cat === 'all' ? 'All Goals' : cat}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <motion.div
          layout
          style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
        >
          <AnimatePresence>
            {filtered.map(c => (
              <CampaignCard
                key={c.id}
                c={c}
                onDelete={handleDelete}
                deletingId={deletingId}
                onClick={() => navigate(`/campaigns/${c.id}`)}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ padding: '80px 0', textAlign: 'center' }}>
            <Target size={44} style={{ color: C.border, marginBottom: 16 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: C.textMuted, margin: '0 0 6px' }}>No campaigns found</p>
            <p style={{ fontSize: 13, color: '#334155', margin: 0 }}>
              {filter !== 'all' ? `No ${filter} campaigns yet.` : 'Create your first goal to get started.'}
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}