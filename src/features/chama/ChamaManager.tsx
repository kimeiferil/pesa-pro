import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePlanGate } from '../../hooks/usePlanGate';
import { useUserPlan  } from '../../hooks/useUserPlan';
import { PLAN_LIMITS  } from '../../config/planLimits';
import { supabase } from '../../lib/supabase';
import { useAuth } from '@/context/AuthContext';
import autoTable from 'jspdf-autotable';

/* ─────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────── */
const C = {
  bg:        '#07090f',
  surface:   '#0e1320',
  surface2:  '#131b2e',
  surface3:  '#1a2540',
  border:    'rgba(255,255,255,0.07)',
  borderHi:  'rgba(255,255,255,0.15)',
  text:      '#f0f4ff',
  muted:     '#5a6a8a',
  sub:       '#8899bb',
  green:     '#00d68f',
  blue:      '#4f8ef7',
  amber:     '#f5a623',
  red:       '#f05060',
  purple:    '#a78bfa',
  pink:      '#f472b6',
};

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const kes    = (n: number) => `KES ${(n || 0).toLocaleString('en-KE')}`;
const pct    = (a: number, b: number) => (b ? Math.min(Math.round((a / b) * 100), 100) : 0);
const fmtDate = (d: any) =>
  d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  'merry-go-round': { label: 'Merry-Go-Round',  color: C.green,  icon: 'MGR' },
  'investment':     { label: 'Investment Chama', color: C.blue,   icon: 'INV' },
  'table-banking':  { label: 'Table Banking',    color: C.amber,  icon: 'TAB' },
  'welfare':        { label: 'Welfare Group',    color: C.purple, icon: 'WEL' },
};
const FREQ: Record<string, string> = {
  weekly: 'Weekly', 'bi-weekly': 'Bi-weekly', monthly: 'Monthly',
};

/* ─────────────────────────────────────────────
   INLINE STYLES
───────────────────────────────────────────── */
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 13px', background: C.surface2,
  border: `1px solid ${C.border}`, borderRadius: 10, color: C.text,
  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
};
const btnPrimary = (color = C.green, textColor = '#020e07'): React.CSSProperties => ({
  background: color, color: textColor, border: 'none', borderRadius: 10,
  padding: '9px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
});
const btnGhost: React.CSSProperties = {
  background: 'transparent', border: `1px solid ${C.border}`, color: C.sub,
  borderRadius: 9, padding: '7px 12px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
  fontFamily: 'inherit', transition: 'all .15s',
};

/* ─────────────────────────────────────────────
   SMALL REUSABLE COMPONENTS
───────────────────────────────────────────── */

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: `${color}22`, color, textTransform: 'uppercase' as const,
      letterSpacing: '0.04em', whiteSpace: 'nowrap' as const,
    }}>
      {label}
    </span>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{
        width: `${pct(value, max)}%`, height: '100%',
        background: color, borderRadius: 10, transition: 'width .5s',
      }} />
    </div>
  );
}

function StatCard({ label, value, sub, color, onClick }: any) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: '14px 16px', cursor: onClick ? 'pointer' : 'default',
        transition: 'all .15s',
      }}
      onMouseEnter={e => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.borderColor = C.borderHi;
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = C.border;
        (e.currentTarget as HTMLElement).style.transform = 'none';
      }}
    >
      <p style={{ margin: '0 0 6px', fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color }}>{value}</p>
      {sub && <p style={{ margin: '3px 0 0', fontSize: 11, color: C.muted }}>{sub}</p>}
    </div>
  );
}

function EmptyState({ title, sub, action, onAction }: any) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 20px', background: C.surface,
      border: `1px solid ${C.border}`, borderRadius: 16,
    }}>
      <p style={{ color: C.text, fontWeight: 700, fontSize: 15, margin: '0 0 8px' }}>{title}</p>
      <p style={{ color: C.muted, fontSize: 13, margin: '0 0 20px' }}>{sub}</p>
      {action && (
        <button style={btnPrimary()} onClick={onAction}>+ {action}</button>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, wide }: any) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)', zIndex: 400,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, overflowY: 'auto',
    }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.borderHi}`,
        borderRadius: 20, width: '100%', maxWidth: wide ? 620 : 480,
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
          position: 'sticky', top: 0, background: C.surface, zIndex: 1,
        }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 20, lineHeight: 1, padding: '0 4px' }}
          >
            x
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 700, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
      }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ margin: '4px 0 0', fontSize: 11, color: C.muted }}>{hint}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   WHATSAPP REPORT BUILDER
───────────────────────────────────────────── */
function buildReport(chama: any, members: any[], contributions: any[], loans: any[]) {
  const meta = TYPE_META[chama.type] || TYPE_META['welfare'];
  const date = fmtDate(new Date());
  const lines = [
    `*${chama.name.toUpperCase()}*`,
    `_${meta.label} Report - ${date}_`, '',
    `Members: ${members.filter((m: any) => m.is_active).length}`,
    `Total Pool: ${kes(chama.total_pool)}`,
    `Frequency: ${FREQ[chama.contribution_frequency]}`,
    `Fixed Amount: ${kes(chama.contribution_amount)}`, '',
  ];
  if (contributions.length > 0) {
    lines.push('*Recent Contributions*');
    contributions.slice(0, 10).forEach((c: any) =>
      lines.push(`- ${c.chama_members?.name || '-'}: ${kes(c.amount)} (${c.cycle_label || fmtDate(c.paid_at)})`),
    );
    lines.push('');
  }
  const activeLoans = loans.filter((l: any) => l.status === 'active');
  if (activeLoans.length > 0) {
    lines.push('*Active Loans*');
    activeLoans.forEach((l: any) => {
      const bal = (l.total_due || l.principal) - (l.amount_repaid || 0);
      lines.push(`- ${l.chama_members?.name || '-'}: Balance ${kes(bal)}, Due ${fmtDate(l.due_date)}`);
    });
  }
  lines.push('', '_Sent via Pesa Pro_');
  return lines.join('\n');
}

/* ─────────────────────────────────────────────
   PDF EXPORT
───────────────────────────────────────────── */
async function exportPDF(chama: any, members: any[], contributions: any[], loans: any[]) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();
  const meta = TYPE_META[chama.type] || TYPE_META['welfare'];
  const GREEN = [0, 214, 143] as [number,number,number];
  const DARK  = [7,  9,  15]  as [number,number,number];
  const NAVY  = [14, 19, 32]  as [number,number,number];
  const MUTED = [90, 106,138] as [number,number,number];
  const WHITE = [240,244,255] as [number,number,number];

  const drawFooter = () => {
    const pn = (doc.internal as any).getCurrentPageInfo().pageNumber;
    const tp = (doc.internal as any).getNumberOfPages();
    doc.setFillColor(...DARK); doc.rect(0, ph - 8, pw, 8, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
    doc.text('PESA PRO  |  Chama Statement', 8, ph - 3);
    doc.text(`Page ${pn} of ${tp}`, pw - 8, ph - 3, { align: 'right' });
  };

  // Header
  doc.setFillColor(...DARK); doc.rect(0, 0, pw, 58, 'F');
  doc.setFillColor(...GREEN); doc.rect(0, 0, 4, 58, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...WHITE);
  doc.text(chama.name, 12, 28);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text(`${meta.label}  |  Generated ${fmtDate(new Date())}`, 12, 36);
  doc.text(`${FREQ[chama.contribution_frequency]} contributions of ${kes(chama.contribution_amount)}`, 12, 43);

  // KPIs
  const totalLent   = loans.reduce((s: number, l: any) => s + (l.principal || 0), 0);
  const totalRepaid = loans.reduce((s: number, l: any) => s + (l.amount_repaid || 0), 0);
  const kpis = [
    { label: 'Total Pool', value: kes(chama.total_pool), accent: GREEN },
    { label: 'Members',    value: members.filter((m: any) => m.is_active).length.toString(), accent: [79,142,247] as [number,number,number] },
    { label: 'Total Lent', value: kes(totalLent),   accent: [245,166,35] as [number,number,number] },
    { label: 'Repaid',     value: kes(totalRepaid), accent: GREEN },
  ];
  const cw = (pw - 20 - 9) / 4, cy = 62;
  kpis.forEach((k, i) => {
    const cx = 10 + i * (cw + 3);
    doc.setFillColor(...NAVY); doc.roundedRect(cx, cy, cw, 16, 2, 2, 'F');
    doc.setFillColor(...k.accent); doc.rect(cx, cy, 2, 16, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...MUTED);
    doc.text(k.label.toUpperCase(), cx + 5, cy + 5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
    doc.text(k.value, cx + 5, cy + 12);
  });

  // Contributions table
  const tY = cy + 22;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MUTED);
  doc.text('CONTRIBUTIONS', 10, tY - 2);
  autoTable(doc, {
    head: [['#', 'DATE', 'MEMBER', 'CYCLE', 'METHOD', 'AMOUNT']],
    body: contributions.map((c: any, i: number) => [
      i + 1, fmtDate(c.paid_at), c.chama_members?.name || '-',
      c.cycle_label || '-', c.payment_method || '-', kes(c.amount),
    ]),
    startY: tY, margin: { left: 10, right: 10 }, theme: 'plain',
    styles: { fontSize: 7.5, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, textColor: [30,41,59] as any },
    headStyles: { fillColor: NAVY as any, textColor: MUTED as any, fontSize: 6.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] as any },
    columnStyles: { 0: { cellWidth: 7, halign: 'center' }, 5: { halign: 'right', fontStyle: 'bold' } },
    didDrawPage() { drawFooter(); },
  });

  if (loans.length > 0) {
    doc.addPage();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text('LOANS', 10, 18);
    autoTable(doc, {
      head: [['MEMBER', 'PRINCIPAL', 'INTEREST %', 'TOTAL DUE', 'REPAID', 'BALANCE', 'STATUS']],
      body: loans.map((l: any) => [
        l.chama_members?.name || '-', kes(l.principal),
        `${l.interest_rate}%`, kes(l.total_due),
        kes(l.amount_repaid || 0),
        kes((l.total_due || l.principal) - (l.amount_repaid || 0)),
        (l.status || '').toUpperCase(),
      ]),
      startY: 21, margin: { left: 10, right: 10 }, theme: 'plain',
      styles: { fontSize: 7, cellPadding: { top: 3, bottom: 3, left: 2, right: 2 }, textColor: [30,41,59] as any },
      headStyles: { fillColor: NAVY as any, textColor: MUTED as any, fontSize: 6, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] as any },
      didDrawPage() { drawFooter(); },
    });
  }

  drawFooter();
  doc.save(`${chama.name.replace(/\s+/g, '_')}_Statement_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/* ─────────────────────────────────────────────
   GLOBAL CSS
───────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  .cm-root { font-family: 'Sora', sans-serif; background: ${C.bg}; color: ${C.text}; min-height: 100vh; }
  .cm-row { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 13px; padding: 12px 15px; display: flex; align-items: center; gap: 12px; transition: border-color .15s; }
  .cm-row:hover { border-color: ${C.borderHi}; }
  .cm-tab { padding: 8px 14px; background: none; border: none; cursor: pointer; font-size: 12px; font-weight: 600; color: ${C.muted}; border-bottom: 2px solid transparent; white-space: nowrap; transition: all .15s; font-family: inherit; }
  .cm-tab.active { font-weight: 800; }
  input:focus, select:focus, textarea:focus { border-color: ${C.borderHi} !important; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .fade-up { animation: fadeUp .25s ease forwards; }
`;

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function ChamaManager() {
  const { user } = useAuth();

  // ── Plan gating ───────────────────────────
  const { plan }                   = useUserPlan(user?.id);
  const { gate, check, closeGate } = usePlanGate(plan);
  // ─────────────────────────────────────────

  // ── State ─────────────────────────────────
  const [chamas,        setChamas]        = useState<any[]>([]);
  const [selected,      setSelected]      = useState<any>(null);
  const [members,       setMembers]       = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [rotations,     setRotations]     = useState<any[]>([]);
  const [loans,         setLoans]         = useState<any[]>([]);
  const [expenses,      setExpenses]      = useState<any[]>([]);
  const [minutes,       setMinutes]       = useState<any[]>([]);
  const [penalties,     setPenalties]     = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState('overview');
  const [search,        setSearch]        = useState('');
  const [modal,         setModal]         = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [formErr,       setFormErr]       = useState('');
  const [showRepayLoan, setShowRepayLoan] = useState<any>(null);
  const [repayAmount,   setRepayAmount]   = useState('');

  // ── Form state ────────────────────────────
  const blankChama  = { name: '', type: 'merry-go-round', description: '', contribution_amount: '', contribution_frequency: 'monthly', start_date: new Date().toISOString().split('T')[0] };
  const blankMember = { name: '', phone: '', email: '', role: 'member', rotation_order: '' };
  const blankContrib = { member_id: '', amount: '', cycle_label: '', payment_method: 'mpesa', transaction_code: '' };
  const blankLoan   = { member_id: '', principal: '', interest_rate: '10', duration_months: '12', interest_type: 'flat', due_date: '', notes: '' };
  const blankExpense = { description: '', amount: '', category: 'meeting', paid_by: '' };
  const blankMinutes = { meeting_date: new Date().toISOString().split('T')[0], title: '', notes: '', decisions: '' };
  const blankPenalty = { member_id: '', amount: '', reason: '' };

  const [newChama,   setNewChama]   = useState(blankChama);
  const [newMember,  setNewMember]  = useState(blankMember);
  const [newContrib, setNewContrib] = useState(blankContrib);
  const [newLoan,    setNewLoan]    = useState(blankLoan);
  const [newExpense, setNewExpense] = useState(blankExpense);
  const [newMinutes, setNewMinutes] = useState(blankMinutes);
  const [newPenalty, setNewPenalty] = useState(blankPenalty);

  // ── Derived values ─────────────────────────
  const currentCycle = useMemo(() => {
    const now = new Date();
    return `${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear()}`;
  }, []);

  const activeMembers   = useMemo(() => members.filter(m => m.is_active), [members]);
  const activeLoans     = useMemo(() => loans.filter(l => l.status === 'active'), [loans]);
  const totalLent       = useMemo(() => loans.reduce((s, l) => s + (l.principal || 0), 0), [loans]);
  const totalExpenses   = useMemo(() => expenses.reduce((s, e) => s + (e.amount || 0), 0), [expenses]);
  const unpaidPenalties = useMemo(() => penalties.filter(p => !p.paid && !p.waived), [penalties]);

  const defaulters = useMemo(() => {
    const paid = new Set(contributions.filter(c => c.cycle_label === currentCycle).map(c => c.member_id));
    return activeMembers.filter(m => !paid.has(m.id));
  }, [activeMembers, contributions, currentCycle]);

  const memberTotals = useMemo(() => {
    const map: Record<string, number> = {};
    contributions.forEach(c => { map[c.member_id] = (map[c.member_id] || 0) + (c.amount || 0); });
    return map;
  }, [contributions]);

  const poolTimeline = useMemo(() => {
    const by: Record<string, number> = {};
    contributions.forEach(c => {
      const k = new Date(c.paid_at).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' });
      by[k] = (by[k] || 0) + (c.amount || 0);
    });
    return Object.entries(by).slice(-6).map(([month, amount]) => ({ month, amount }));
  }, [contributions]);

  const calcLoan = useMemo(() => {
    const p = parseFloat(newLoan.principal) || 0;
    const r = parseFloat(newLoan.interest_rate) || 0;
    const d = parseInt(newLoan.duration_months) || 1;
    let interest = 0, total = 0, monthly = 0;
    if (newLoan.interest_type === 'flat') {
      interest = p * (r / 100) * (d / 12);
      total    = p + interest;
      monthly  = total / d;
    } else {
      const mRate = r / 100 / 12;
      monthly  = mRate ? p * mRate / (1 - Math.pow(1 + mRate, -d)) : p / d;
      total    = monthly * d;
      interest = total - p;
    }
    return { interest, total, monthly };
  }, [newLoan]);

  const filteredMembers = useMemo(() => {
    if (!search) return members;
    const s = search.toLowerCase();
    return members.filter(m =>
      m.name?.toLowerCase().includes(s) || m.phone?.includes(s) || m.email?.toLowerCase().includes(s),
    );
  }, [members, search]);

  // ── Data loaders ──────────────────────────
  const loadChamas = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('chamas').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setChamas(data || []);
    } finally { setLoading(false); }
  }, [user]);

  const loadDetail = useCallback(async (id: string) => {
    const [m, c, r, l, e, mn, p] = await Promise.all([
      supabase.from('chama_members').select('*').eq('chama_id', id).order('rotation_order'),
      supabase.from('chama_contributions').select('*,chama_members(name)').eq('chama_id', id).order('paid_at', { ascending: false }),
      supabase.from('chama_rotations').select('*,chama_members(name)').eq('chama_id', id).order('round_number'),
      supabase.from('chama_loans').select('*,chama_members(name)').eq('chama_id', id).order('issued_at', { ascending: false }),
      supabase.from('chama_expenses').select('*').eq('chama_id', id).order('created_at', { ascending: false }),
      supabase.from('chama_minutes').select('*').eq('chama_id', id).order('meeting_date', { ascending: false }),
      supabase.from('chama_penalties').select('*,chama_members(name)').eq('chama_id', id).order('created_at', { ascending: false }),
    ]);
    setMembers(m.data || []);
    setContributions(c.data || []);
    setRotations(r.data || []);
    setLoans(l.data || []);
    setExpenses(e.data || []);
    setMinutes(mn.data || []);
    setPenalties(p.data || []);
  }, []);

  useEffect(() => { loadChamas(); }, [loadChamas]);
  useEffect(() => { if (selected) loadDetail(selected.id); }, [selected, loadDetail]);

  // ── Modal helpers ─────────────────────────
  const openModal  = (key: string) => { setFormErr(''); setModal(key); };
  const closeModal = () => { setModal(null); setFormErr(''); };

  // ── CRUD actions ──────────────────────────
  const createChama = async () => {
    if (!check('maxChamas', { currentCount: chamas.length, reason: 'Upgrade to create more Chamas.' })) return;
    if (!newChama.name || !newChama.contribution_amount) { setFormErr('Name and amount are required'); return; }
    setSaving(true); setFormErr('');
    try {
      const { data, error } = await supabase
        .from('chamas')
        .insert([{ ...newChama, contribution_amount: parseFloat(newChama.contribution_amount), user_id: user?.id }])
        .select().single();
      if (error) throw error;
      setChamas(p => [data, ...p]);
      setNewChama(blankChama);
      closeModal();
    } catch (e: any) { setFormErr(e.message); }
    finally { setSaving(false); }
  };

  const addMember = async () => {
    if (!newMember.name || !selected) return;
    if (!check('chamaMembers', { currentCount: members.length, reason: 'Upgrade to add more members to this Chama.' })) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('chama_members').insert([{
        chama_id: selected.id, name: newMember.name, phone: newMember.phone || null,
        email: newMember.email || null, role: newMember.role,
        rotation_order: newMember.rotation_order ? parseInt(newMember.rotation_order) : null,
      }]).select().single();
      if (error) throw error;
      setMembers(p => [...p, data]);
      setNewMember(blankMember);
      closeModal();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const addContribution = async () => {
    if (!newContrib.member_id || !newContrib.amount || !selected) return;
    setSaving(true);
    try {
      const amount = parseFloat(newContrib.amount);
      const { data, error } = await supabase
        .from('chama_contributions')
        .insert([{
          chama_id: selected.id, member_id: parseInt(newContrib.member_id),
          amount, cycle_label: newContrib.cycle_label || currentCycle,
          payment_method: newContrib.payment_method,
          transaction_code: newContrib.transaction_code || null,
        }])
        .select('*,chama_members(name)').single();
      if (error) throw error;
      await supabase.from('chamas').update({ total_pool: (selected.total_pool || 0) + amount }).eq('id', selected.id);
      setContributions(p => [data, ...p]);
      setSelected((p: any) => p ? { ...p, total_pool: (p.total_pool || 0) + amount } : p);
      setNewContrib(blankContrib);
      closeModal();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const addLoan = async () => {
    if (!newLoan.member_id || !newLoan.principal || !selected) return;
    if (!check('chamaLoans', { reason: 'Chama loans are available on the Pro plan.' })) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('chama_loans').insert([{
        chama_id: selected.id, member_id: parseInt(newLoan.member_id),
        principal: parseFloat(newLoan.principal),
        interest_rate: parseFloat(newLoan.interest_rate || '10'),
        interest_type: newLoan.interest_type,
        duration_months: parseInt(newLoan.duration_months || '12'),
        total_due: calcLoan.total,
        monthly_payment: calcLoan.monthly,
        due_date: newLoan.due_date || null,
        notes: newLoan.notes || null,
      }]).select('*,chama_members(name)').single();
      if (error) throw error;
      setLoans(p => [data, ...p]);
      setNewLoan(blankLoan);
      closeModal();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const repayLoan = async () => {
    if (!showRepayLoan || !repayAmount) return;
    const amount   = parseFloat(repayAmount);
    setSaving(true);
    try {
      await supabase.from('chama_loan_repayments').insert([{ loan_id: showRepayLoan.id, amount }]);
      const newRepaid = (showRepayLoan.amount_repaid || 0) + amount;
      const newStatus = newRepaid >= (showRepayLoan.total_due || showRepayLoan.principal) ? 'repaid' : 'active';
      await supabase.from('chama_loans').update({ amount_repaid: newRepaid, status: newStatus }).eq('id', showRepayLoan.id);
      setLoans(p => p.map(l => l.id === showRepayLoan.id ? { ...l, amount_repaid: newRepaid, status: newStatus } : l));
      setShowRepayLoan(null); setRepayAmount('');
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const addExpense = async () => {
    if (!newExpense.description || !newExpense.amount || !selected) return;
    if (!check('chamaExpenses', { reason: 'Chama expense tracking is available on the Pro plan.' })) return;
    setSaving(true);
    try {
      const amount = parseFloat(newExpense.amount);
      const { data, error } = await supabase.from('chama_expenses').insert([{
        chama_id: selected.id, description: newExpense.description,
        amount, category: newExpense.category, paid_by: newExpense.paid_by || null,
      }]).select().single();
      if (error) throw error;
      setExpenses(p => [data, ...p]);
      setNewExpense(blankExpense);
      closeModal();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const addMinutes = async () => {
    if (!newMinutes.title || !selected) return;
    if (!check('chamaMinutes', { reason: 'Meeting minutes are available on the Pro plan.' })) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('chama_minutes').insert([{
        chama_id: selected.id, meeting_date: newMinutes.meeting_date,
        title: newMinutes.title, notes: newMinutes.notes || null,
        decisions: newMinutes.decisions || null,
      }]).select().single();
      if (error) throw error;
      setMinutes(p => [data, ...p]);
      setNewMinutes(blankMinutes);
      closeModal();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const addPenalty = async () => {
    if (!newPenalty.member_id || !newPenalty.amount || !selected) return;
    if (!check('chamaPenalties', { reason: 'Penalty management is available on the Pro plan.' })) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('chama_penalties').insert([{
        chama_id: selected.id, member_id: parseInt(newPenalty.member_id),
        amount: parseFloat(newPenalty.amount), reason: newPenalty.reason || null,
      }]).select('*,chama_members(name)').single();
      if (error) throw error;
      setPenalties(p => [data, ...p]);
      setNewPenalty(blankPenalty);
      closeModal();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const generateRotations = async () => {
    if (!selected) return;
    const ordered = [...members]
      .filter(m => m.is_active && m.rotation_order != null)
      .sort((a, b) => (a.rotation_order || 0) - (b.rotation_order || 0));
    if (!ordered.length) { alert('Set rotation_order on members first'); return; }
    await supabase.from('chama_rotations').delete().eq('chama_id', selected.id);
    const rows = ordered.map((m, i) => ({
      chama_id: selected.id, member_id: m.id, round_number: i + 1,
      payout_amount: selected.contribution_amount * ordered.length, status: 'pending',
    }));
    const { error } = await supabase.from('chama_rotations').insert(rows);
    if (error) { alert(error.message); return; }
    loadDetail(selected.id);
  };

  const markRotationPaid = async (rot: any) => {
    await supabase.from('chama_rotations')
      .update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', rot.id);
    setRotations(p => p.map(r => r.id === rot.id ? { ...r, status: 'paid' } : r));
  };

  const distributePool = () => {
    if (!selected || !activeMembers.length) return;
    const share = Math.floor((selected.total_pool - totalExpenses) / activeMembers.length);
    alert(`Each of the ${activeMembers.length} members receives ${kes(share)}\nTotal pool: ${kes(selected.total_pool)}\nExpenses deducted: ${kes(totalExpenses)}`);
  };

  const deleteChama = async () => {
    if (!selected) return;
    await supabase.from('chamas').delete().eq('id', selected.id);
    setChamas(p => p.filter(c => c.id !== selected.id));
    setSelected(null);
    closeModal();
  };

  const shareReport = () => {
    if (!selected) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(buildReport(selected, members, contributions, loans))}`, '_blank');
  };

  // ── LIST VIEW (no chama selected) ─────────
  if (!selected) {
    const totalPool = chamas.reduce((s, c) => s + (c.total_pool || 0), 0);
    return (
      <div className="cm-root">
        <style>{CSS}</style>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: '-0.5px', color: C.text }}>Chama Manager</h1>
              <p style={{ color: C.muted, margin: '4px 0 0', fontSize: 13 }}>Your savings circles and investment groups</p>
            </div>
            <button style={btnPrimary()} onClick={() => openModal('createChama')}>
              + New Chama
            </button>
          </div>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
            <StatCard label="Active Chamas"  value={chamas.length.toString()}                                 color={C.green} />
            <StatCard label="Combined Pool"  value={kes(totalPool)}                                           color={C.blue}  />
            <StatCard label="Chama Types"    value={new Set(chamas.map(c => c.type)).size.toString()}          color={C.amber} />
          </div>

          {/* List */}
          {loading
            ? <p style={{ textAlign: 'center', padding: 60, color: C.muted }}>Loading...</p>
            : chamas.length === 0
              ? <EmptyState title="No chamas yet" sub="Create your first savings circle to get started" action="Create Chama" onAction={() => openModal('createChama')} />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {chamas.map((c, i) => {
                    const m = TYPE_META[c.type] || TYPE_META['welfare'];
                    return (
                      <div
                        key={c.id}
                        className="cm-row fade-up"
                        style={{ cursor: 'pointer', animationDelay: `${i * 0.04}s`, opacity: 0 }}
                        onClick={() => { setSelected(c); setTab('overview'); }}
                      >
                        <div style={{
                          width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                          background: `${m.color}20`, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', color: m.color, fontWeight: 900, fontSize: 11,
                        }}>
                          {m.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: C.text }}>{c.name}</p>
                            <span style={{ fontSize: 14, fontWeight: 900, color: m.color }}>{kes(c.total_pool)}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Badge label={m.label} color={m.color} />
                            <span style={{ fontSize: 11, color: C.muted }}>{FREQ[c.contribution_frequency]} — {kes(c.contribution_amount)}</span>
                          </div>
                        </div>
                        <span style={{ color: C.muted, fontSize: 18 }}>›</span>
                      </div>
                    );
                  })}
                </div>
              )
          }
        </div>

        {/* Create Chama Modal */}
        {modal === 'createChama' && (
          <Modal title="Create New Chama" onClose={closeModal}>
            {formErr && (
              <div style={{ padding: '9px 13px', background: 'rgba(240,80,96,0.1)', border: '1px solid rgba(240,80,96,0.25)', borderRadius: 9, color: '#fca5a5', fontSize: 13, marginBottom: 14 }}>
                {formErr}
              </div>
            )}
            <Field label="Chama Name *">
              <input style={inp} placeholder="e.g. Maendeleo Chama" value={newChama.name}
                onChange={e => setNewChama(p => ({ ...p, name: e.target.value }))} />
            </Field>
            <Field label="Type *">
              <select style={inp} value={newChama.type} onChange={e => setNewChama(p => ({ ...p, type: e.target.value }))}>
                <option value="merry-go-round">Merry-Go-Round (Mchikichini)</option>
                <option value="investment">Investment Chama</option>
                <option value="table-banking">Table Banking</option>
                <option value="welfare">Welfare Group</option>
              </select>
            </Field>
            <Field label="Description">
              <textarea style={{ ...inp, resize: 'vertical' }} rows={2} placeholder="Brief description..."
                value={newChama.description} onChange={e => setNewChama(p => ({ ...p, description: e.target.value }))} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Contribution Amount (KES) *">
                <input style={inp} type="number" placeholder="2000" value={newChama.contribution_amount}
                  onChange={e => setNewChama(p => ({ ...p, contribution_amount: e.target.value }))} />
              </Field>
              <Field label="Frequency">
                <select style={inp} value={newChama.contribution_frequency}
                  onChange={e => setNewChama(p => ({ ...p, contribution_frequency: e.target.value }))}>
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
            </div>
            <Field label="Start Date">
              <input style={inp} type="date" value={newChama.start_date}
                onChange={e => setNewChama(p => ({ ...p, start_date: e.target.value }))} />
            </Field>
            <button
              style={{ ...btnPrimary(), width: '100%', justifyContent: 'center', padding: '12px', marginTop: 6, opacity: saving ? 0.7 : 1 }}
              disabled={saving} onClick={createChama}
            >
              {saving ? 'Creating...' : 'Create Chama'}
            </button>
          </Modal>
        )}
      </div>
    );
  }

  // ── DETAIL VIEW ───────────────────────────
  const meta = TYPE_META[selected.type] || TYPE_META['welfare'];

  const TABS = [
    { key: 'overview',      label: 'Overview' },
    { key: 'members',       label: `Members (${activeMembers.length})` },
    { key: 'contributions', label: `Contributions (${contributions.length})` },
    { key: 'loans',         label: `Loans (${loans.length})` },
    { key: 'expenses',      label: `Expenses (${expenses.length})` },
    { key: 'analytics',     label: 'Analytics' },
    { key: 'defaulters',    label: `Defaulters${defaulters.length > 0 ? ` (${defaulters.length})` : ''}` },
    { key: 'penalties',     label: `Penalties (${penalties.length})` },
    { key: 'minutes',       label: `Minutes (${minutes.length})` },
    ...(selected.type === 'merry-go-round' ? [{ key: 'rotations', label: `Rotations (${rotations.length})` }] : []),
  ];

  return (
    <div className="cm-root">
      <style>{CSS}</style>

      {/* Sticky header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(7,9,15,0.97)', backdropFilter: 'blur(18px)',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 14px', height: 54, display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Back */}
          <button style={btnGhost} onClick={() => setSelected(null)}>
            ‹ Back
          </button>

          {/* Title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>
              {selected.name}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {meta.label}
            </p>
          </div>

          {/* Notification badge */}
          <div style={{ position: 'relative' }}>
            <button style={btnGhost} onClick={() => setTab('defaulters')}>
              Alerts
              {defaulters.length > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 17, height: 17, borderRadius: '50%',
                  background: C.red, color: '#fff', fontSize: 9, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {defaulters.length}
                </span>
              )}
            </button>
          </div>

          <button
            style={{ ...btnGhost, color: '#25D366', borderColor: 'rgba(37,211,102,0.25)' }}
            onClick={shareReport}
          >
            WhatsApp
          </button>
          <button style={btnGhost} onClick={() => { if (!check('chamaPDFExport', { reason: 'PDF export is available on the Pro plan.' })) return; void exportPDF(selected, members, contributions, loans); }}>
            PDF
          </button>
          <button style={{ ...btnGhost, color: C.red, borderColor: 'rgba(240,80,96,0.2)' }} onClick={() => openModal('deleteChama')}>
            Delete
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 14px', display: 'flex', gap: 2, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`cm-tab${tab === t.key ? ' active' : ''}`}
              style={{ color: tab === t.key ? meta.color : (t.key === 'defaulters' && defaulters.length > 0 ? C.amber : C.muted) }}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Tab content */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '18px 14px 80px' }}>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="fade-up">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10, marginBottom: 14 }}>
              <StatCard label="Total Pool"    value={kes(selected.total_pool)}        color={meta.color} />
              <StatCard label="Members"       value={activeMembers.length.toString()} color={C.blue} />
              <StatCard label="Active Loans"  value={activeLoans.length.toString()}   color={C.amber} />
              <StatCard label="Expenses"      value={kes(totalExpenses)}              color={C.red} />
              <StatCard label="Defaulters"    value={defaulters.length.toString()}    color={defaulters.length > 0 ? C.red : C.green} onClick={() => setTab('defaulters')} />
              <StatCard label="Net Pool"      value={kes((selected.total_pool || 0) - totalExpenses)} color={C.purple} />
            </div>

            {/* Details block */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
              <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Chama Details
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Type',          value: meta.label },
                  { label: 'Frequency',     value: FREQ[selected.contribution_frequency] },
                  { label: 'Fixed Amount',  value: kes(selected.contribution_amount) },
                  { label: 'Start Date',    value: fmtDate(selected.start_date) },
                  { label: 'Status',        value: (selected.status || 'active').toUpperCase() },
                  { label: 'Contributions', value: contributions.length.toString() },
                ].map(r => (
                  <div key={r.label}>
                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                      {r.label}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: C.sub, fontWeight: 600 }}>{r.value}</p>
                  </div>
                ))}
              </div>
              {selected.description && (
                <p style={{ margin: '12px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                  {selected.description}
                </p>
              )}
            </div>

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {[
                { label: 'Add Contribution', color: C.green,     action: () => openModal('addContrib') },
                { label: 'Issue Loan',        color: C.amber,     action: () => openModal('addLoan') },
                { label: 'Add Expense',       color: C.red,       action: () => openModal('addExpense') },
                { label: 'Record Minutes',    color: C.blue,      action: () => openModal('addMinutes') },
                { label: 'Distribute Pool',   color: C.purple,    action: distributePool },
                { label: 'WhatsApp Report',   color: '#25D366',   action: shareReport },
              ].map(a => (
                <button
                  key={a.label}
                  onClick={a.action}
                  style={{
                    padding: '11px 10px', background: `${a.color}15`, color: a.color,
                    border: `1px solid ${a.color}30`, borderRadius: 11, fontWeight: 700,
                    fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 6, fontFamily: 'inherit', transition: 'all .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${a.color}28`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${a.color}15`; }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── MEMBERS ── */}
        {tab === 'members' && (
          <div className="fade-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
              <input
                style={{ ...inp, maxWidth: 280 }}
                placeholder="Search members..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button style={btnPrimary()} onClick={() => openModal('addMember')}>+ Add Member</button>
            </div>
            {filteredMembers.length === 0
              ? <EmptyState title="No members yet" sub="Add your first chama member" action="Add Member" onAction={() => openModal('addMember')} />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredMembers.map(m => (
                    <div key={m.id} className="cm-row">
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                        background: `${meta.color}20`, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: meta.color, fontWeight: 800, fontSize: 15,
                      }}>
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.text }}>{m.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>
                          {m.phone || m.email || 'No contact'} — <span style={{ textTransform: 'capitalize' }}>{m.role}</span>
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: meta.color }}>
                          {kes(memberTotals[m.id] || 0)}
                        </p>
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', marginTop: 4 }}>
                          {m.rotation_order != null && <Badge label={`#${m.rotation_order}`} color={meta.color} />}
                          <Badge label={m.is_active ? 'Active' : 'Inactive'} color={m.is_active ? C.green : C.muted} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* ── CONTRIBUTIONS ── */}
        {tab === 'contributions' && (
          <div className="fade-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
                Pool: <strong style={{ color: meta.color }}>{kes(selected.total_pool)}</strong>
              </p>
              <button style={btnPrimary()} onClick={() => openModal('addContrib')} disabled={!members.length}>
                + Record
              </button>
            </div>
            {/* Cycle progress */}
            <div style={{
              background: `${meta.color}0e`, border: `1px solid ${meta.color}28`,
              borderRadius: 12, padding: '12px 16px', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Current Cycle: {currentCycle}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: C.muted }}>
                    {activeMembers.length - defaulters.length} of {activeMembers.length} paid
                  </p>
                </div>
                <span style={{ fontSize: 18, fontWeight: 900, color: meta.color }}>
                  {pct(activeMembers.length - defaulters.length, activeMembers.length)}%
                </span>
              </div>
              <ProgressBar value={activeMembers.length - defaulters.length} max={activeMembers.length} color={meta.color} />
            </div>
            {contributions.length === 0
              ? <EmptyState title="No contributions yet" sub="Record your first contribution" action="Record Contribution" onAction={() => openModal('addContrib')} />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contributions.map(c => (
                    <div key={c.id} className="cm-row">
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        background: `${meta.color}20`, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: meta.color, fontSize: 13, fontWeight: 800,
                      }}>
                        {(c.chama_members?.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.text }}>
                          {c.chama_members?.name || 'Unknown'}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>
                          {c.cycle_label || fmtDate(c.paid_at)} — {c.payment_method}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontWeight: 800, color: C.green, fontSize: 14 }}>{kes(c.amount)}</p>
                        {c.transaction_code && (
                          <p style={{ margin: '2px 0 0', fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>{c.transaction_code}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* ── LOANS ── */}
        {tab === 'loans' && (
          <div className="fade-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
                {activeLoans.length} active — Total lent: <strong style={{ color: C.amber }}>{kes(totalLent)}</strong>
              </p>
              <button style={btnPrimary(C.amber, '#1a0a00')} onClick={() => openModal('addLoan')} disabled={!members.length}>
                + Issue Loan
              </button>
            </div>
            {loans.length === 0
              ? <EmptyState title="No loans issued" sub="Issue your first chama loan" action="Issue Loan" onAction={() => openModal('addLoan')} />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {loans.map(l => {
                    const bal     = (l.total_due || l.principal) - (l.amount_repaid || 0);
                    const overdue = l.due_date && new Date(l.due_date) < new Date() && l.status === 'active';
                    return (
                      <div key={l.id} style={{
                        background: C.surface, border: `1px solid ${overdue ? C.red : C.border}`,
                        borderRadius: 14, padding: '14px 16px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                            background: l.status === 'repaid' ? 'rgba(0,214,143,0.15)' : 'rgba(245,166,35,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: l.status === 'repaid' ? C.green : C.amber, fontWeight: 800, fontSize: 14,
                          }}>
                            {(l.chama_members?.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.text }}>
                              {l.chama_members?.name || 'Unknown'}
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>
                              Principal: {kes(l.principal)} — {l.interest_rate}% {l.interest_type || 'flat'} — {l.duration_months || '-'} mo
                            </p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: l.status === 'repaid' ? C.green : overdue ? C.red : C.amber }}>
                              {kes(bal)}
                            </p>
                            <Badge label={overdue ? 'OVERDUE' : l.status} color={overdue ? C.red : l.status === 'repaid' ? C.green : C.amber} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8, fontSize: 11, color: C.muted }}>
                          <span>Total due: <strong style={{ color: C.text }}>{kes(l.total_due)}</strong></span>
                          <span>Monthly: <strong style={{ color: C.text }}>{kes(l.monthly_payment)}</strong></span>
                          {l.due_date && <span style={{ color: overdue ? C.red : C.muted }}>Due: {fmtDate(l.due_date)}</span>}
                        </div>
                        <ProgressBar value={l.amount_repaid || 0} max={l.total_due || l.principal} color={l.status === 'repaid' ? C.green : C.amber} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: C.muted }}>
                          <span>Repaid: {kes(l.amount_repaid || 0)}</span>
                          <span>{pct(l.amount_repaid || 0, l.total_due || l.principal)}%</span>
                        </div>
                        {l.status === 'active' && (
                          <button
                            onClick={() => { setShowRepayLoan(l); setRepayAmount(''); }}
                            style={{
                              width: '100%', marginTop: 10, padding: '8px',
                              background: 'rgba(245,166,35,0.1)', color: C.amber,
                              border: `1px solid rgba(245,166,35,0.25)`, borderRadius: 9,
                              fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            Record Repayment
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>
        )}

        {/* ── EXPENSES ── */}
        {tab === 'expenses' && (
          <div className="fade-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
                Total: <strong style={{ color: C.red }}>{kes(totalExpenses)}</strong>
              </p>
              <button style={btnPrimary(C.red, '#fff')} onClick={() => openModal('addExpense')}>+ Add Expense</button>
            </div>
            {expenses.length === 0
              ? <EmptyState title="No expenses recorded" sub="Track chama expenses here" action="Add Expense" onAction={() => openModal('addExpense')} />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {expenses.map(e => (
                    <div key={e.id} className="cm-row">
                      <div style={{
                        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                        background: 'rgba(240,80,96,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: C.red, fontWeight: 700, fontSize: 11,
                      }}>
                        EXP
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.text }}>{e.description}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>
                          {fmtDate(e.created_at)} — {e.category}{e.paid_by ? ` — Paid by ${e.paid_by}` : ''}
                        </p>
                      </div>
                      <p style={{ margin: 0, fontWeight: 800, color: C.red, fontSize: 14, flexShrink: 0 }}>-{kes(e.amount)}</p>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {tab === 'analytics' && (
          <div className="fade-up">
            {/* Bar chart */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
              <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Pool Growth (Last 6 Months)
              </p>
              {poolTimeline.length === 0
                ? <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Not enough data yet</p>
                : (() => {
                    const maxAmt = Math.max(...poolTimeline.map(p => p.amount), 1);
                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
                        {poolTimeline.map((p, i) => (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: '100%', background: meta.color, borderRadius: '4px 4px 0 0', height: `${(p.amount / maxAmt) * 80}px`, minHeight: 4 }} />
                            <span style={{ fontSize: 9, color: C.muted, textAlign: 'center', whiteSpace: 'nowrap' }}>{p.month}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()
              }
            </div>

            {/* Member contributions */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
              <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Member Contributions
              </p>
              {members.length === 0
                ? <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '10px 0' }}>No members yet</p>
                : (() => {
                    const maxC = Math.max(...members.map(m => memberTotals[m.id] || 0), 1);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[...members].sort((a, b) => (memberTotals[b.id] || 0) - (memberTotals[a.id] || 0)).map(m => (
                          <div key={m.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{m.name}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{kes(memberTotals[m.id] || 0)}</span>
                            </div>
                            <ProgressBar value={memberTotals[m.id] || 0} max={maxC} color={meta.color} />
                          </div>
                        ))}
                      </div>
                    );
                  })()
              }
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <StatCard label="Contributions"    value={contributions.length.toString()} color={meta.color} />
              <StatCard label="Avg Contribution" value={kes(contributions.length ? Math.round(contributions.reduce((s, c) => s + (c.amount || 0), 0) / contributions.length) : 0)} color={C.blue} />
              <StatCard label="Repaid Loans"     value={loans.filter(l => l.status === 'repaid').length.toString()} color={C.green} />
              <StatCard label="Pending Payouts"  value={rotations.filter(r => r.status === 'pending').length.toString()} color={C.amber} />
            </div>
          </div>
        )}

        {/* ── DEFAULTERS ── */}
        {tab === 'defaulters' && (
          <div className="fade-up">
            <div style={{
              background: 'rgba(240,80,96,0.06)', border: '1px solid rgba(240,80,96,0.18)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 14,
            }}>
              <p style={{ margin: 0, fontSize: 13, color: C.sub }}>
                <strong style={{ color: C.red }}>{defaulters.length} member{defaulters.length !== 1 ? 's' : ''}</strong> have not contributed for <strong>{currentCycle}</strong>
              </p>
            </div>
            {defaulters.length === 0
              ? <EmptyState title="All members are up to date!" sub={`Everyone has contributed for ${currentCycle}`} />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {defaulters.map(m => (
                    <div key={m.id} className="cm-row" style={{ borderColor: 'rgba(240,80,96,0.25)' }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(240,80,96,0.12)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: C.red, fontWeight: 800, fontSize: 14,
                      }}>
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.text }}>{m.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>{m.phone || 'No phone'}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {m.phone && (
                          <a
                            href={`https://wa.me/${m.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${m.name}, kindly contribute ${kes(selected.contribution_amount)} for ${currentCycle} to ${selected.name}. Thank you!`)}`}
                            target="_blank" rel="noreferrer"
                            style={{
                              padding: '6px 10px', background: 'rgba(37,211,102,0.1)', color: '#25D366',
                              border: '1px solid rgba(37,211,102,0.2)', borderRadius: 8, fontSize: 12,
                              fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            Remind
                          </a>
                        )}
                        <button
                          onClick={() => { setNewPenalty(p => ({ ...p, member_id: m.id.toString() })); openModal('addPenalty'); }}
                          style={{
                            padding: '6px 10px', background: 'rgba(240,80,96,0.1)', color: C.red,
                            border: '1px solid rgba(240,80,96,0.2)', borderRadius: 8, fontSize: 12,
                            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          Penalise
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* ── PENALTIES ── */}
        {tab === 'penalties' && (
          <div className="fade-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
                Unpaid: <strong style={{ color: C.red }}>{kes(unpaidPenalties.reduce((s, p) => s + (p.amount || 0), 0))}</strong>
              </p>
              <button style={btnPrimary(C.amber, '#1a0a00')} onClick={() => openModal('addPenalty')}>+ Add Penalty</button>
            </div>
            {penalties.length === 0
              ? <EmptyState title="No penalties recorded" sub="Track late payment penalties here" />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {penalties.map(p => (
                    <div key={p.id} className="cm-row">
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        background: p.waived ? 'rgba(90,106,138,0.12)' : p.paid ? 'rgba(0,214,143,0.12)' : 'rgba(245,166,35,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: p.waived ? C.muted : p.paid ? C.green : C.amber, fontWeight: 800, fontSize: 14,
                      }}>
                        {(p.chama_members?.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.text }}>{p.chama_members?.name || 'Unknown'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>
                          {p.reason || 'Late contribution'} — {fmtDate(p.created_at)}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontWeight: 800, color: p.waived ? C.muted : p.paid ? C.green : C.amber, fontSize: 14 }}>
                          {kes(p.amount)}
                        </p>
                        <Badge label={p.waived ? 'WAIVED' : p.paid ? 'PAID' : 'PENDING'} color={p.waived ? C.muted : p.paid ? C.green : C.amber} />
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* ── MINUTES ── */}
        {tab === 'minutes' && (
          <div className="fade-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
                {minutes.length} meeting{minutes.length !== 1 ? 's' : ''} recorded
              </p>
              <button style={btnPrimary(C.blue)} onClick={() => openModal('addMinutes')}>+ Record Minutes</button>
            </div>
            {minutes.length === 0
              ? <EmptyState title="No meeting minutes" sub="Record your chama meetings here" action="Record Minutes" onAction={() => openModal('addMinutes')} />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {minutes.map(m => (
                    <div key={m.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.text }}>{m.title}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>{fmtDate(m.meeting_date)}</p>
                        </div>
                        <Badge label="Minutes" color={C.blue} />
                      </div>
                      {m.notes && (
                        <p style={{ margin: '8px 0 0', fontSize: 12, color: C.sub, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                          {m.notes}
                        </p>
                      )}
                      {m.decisions && (
                        <div style={{ marginTop: 8, padding: '8px 11px', background: 'rgba(79,142,247,0.07)', borderRadius: 8, border: '1px solid rgba(79,142,247,0.18)' }}>
                          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Decisions
                          </p>
                          <p style={{ margin: 0, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>{m.decisions}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* ── ROTATIONS ── */}
        {tab === 'rotations' && (
          <div className="fade-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Merry-go-round payout schedule</p>
              <button
                style={rotations.length === 0 ? btnPrimary() : btnGhost}
                onClick={generateRotations}
                disabled={!activeMembers.length}
              >
                {rotations.length === 0 ? 'Generate Schedule' : 'Regenerate'}
              </button>
            </div>
            {rotations.length === 0
              ? <EmptyState title="No rotation schedule" sub="Set rotation_order on members then generate" action="Generate Schedule" onAction={generateRotations} />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rotations.map(r => (
                    <div key={r.id} className="cm-row">
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: r.status === 'paid' ? 'rgba(0,214,143,0.15)' : `${meta.color}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: r.status === 'paid' ? C.green : meta.color, fontWeight: 800, fontSize: 13,
                      }}>
                        {r.round_number}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.text }}>
                          {r.chama_members?.name || 'Unknown'}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>
                          {r.scheduled_date ? fmtDate(r.scheduled_date) : 'No date'}
                          {r.payout_amount ? ` — ${kes(r.payout_amount)}` : ''}
                        </p>
                      </div>
                      {r.status === 'paid'
                        ? <Badge label="Paid" color={C.green} />
                        : (
                          <button
                            onClick={() => markRotationPaid(r)}
                            style={{
                              padding: '6px 12px', background: `${meta.color}20`, color: meta.color,
                              border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700,
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            Mark Paid
                          </button>
                        )
                      }
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}
      </div>

      {/* ══ MODALS ══════════════════════════════════════════ */}

      {modal === 'addMember' && (
        <Modal title="Add Member" onClose={closeModal}>
          <Field label="Full Name *">
            <input style={inp} placeholder="Jane Njoroge" value={newMember.name}
              onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Phone">
            <input style={inp} placeholder="+254700000000" value={newMember.phone}
              onChange={e => setNewMember(p => ({ ...p, phone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <input style={inp} type="email" placeholder="jane@email.com" value={newMember.email}
              onChange={e => setNewMember(p => ({ ...p, email: e.target.value }))} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Role">
              <select style={inp} value={newMember.role} onChange={e => setNewMember(p => ({ ...p, role: e.target.value }))}>
                <option value="member">Member</option>
                <option value="treasurer">Treasurer</option>
                <option value="secretary">Secretary</option>
                <option value="admin">Admin / Chairman</option>
              </select>
            </Field>
            {selected.type === 'merry-go-round' && (
              <Field label="Rotation Order">
                <input style={inp} type="number" min="1" placeholder="1" value={newMember.rotation_order}
                  onChange={e => setNewMember(p => ({ ...p, rotation_order: e.target.value }))} />
              </Field>
            )}
          </div>
          <button style={{ ...btnPrimary(), width: '100%', justifyContent: 'center', padding: '12px', marginTop: 6, opacity: saving ? 0.7 : 1 }}
            disabled={saving} onClick={addMember}>
            {saving ? 'Adding...' : 'Add Member'}
          </button>
        </Modal>
      )}

      {modal === 'addContrib' && (
        <Modal title="Record Contribution" onClose={closeModal}>
          <Field label="Member *">
            <select style={inp} value={newContrib.member_id}
              onChange={e => setNewContrib(p => ({ ...p, member_id: e.target.value }))}>
              <option value="">Select member...</option>
              {members.filter(m => m.is_active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Amount (KES) *">
              <input style={inp} type="number" placeholder={selected.contribution_amount.toString()}
                value={newContrib.amount} onChange={e => setNewContrib(p => ({ ...p, amount: e.target.value }))} />
            </Field>
            <Field label="Cycle Label">
              <input style={inp} placeholder={currentCycle} value={newContrib.cycle_label}
                onChange={e => setNewContrib(p => ({ ...p, cycle_label: e.target.value }))} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Payment Method">
              <select style={inp} value={newContrib.payment_method}
                onChange={e => setNewContrib(p => ({ ...p, payment_method: e.target.value }))}>
                <option value="mpesa">M-Pesa</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Transaction Code">
              <input style={inp} placeholder="QG7XY1234Z" value={newContrib.transaction_code}
                onChange={e => setNewContrib(p => ({ ...p, transaction_code: e.target.value }))} />
            </Field>
          </div>
          <button style={{ ...btnPrimary(), width: '100%', justifyContent: 'center', padding: '12px', marginTop: 6, opacity: saving ? 0.7 : 1 }}
            disabled={saving} onClick={addContribution}>
            {saving ? 'Recording...' : 'Record Contribution'}
          </button>
        </Modal>
      )}

      {modal === 'addLoan' && (
        <Modal title="Issue Loan" onClose={closeModal} wide>
          <Field label="Member *">
            <select style={inp} value={newLoan.member_id}
              onChange={e => setNewLoan(p => ({ ...p, member_id: e.target.value }))}>
              <option value="">Select member...</option>
              {members.filter(m => m.is_active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Principal Amount (KES) *">
              <input style={inp} type="number" placeholder="5000" value={newLoan.principal}
                onChange={e => setNewLoan(p => ({ ...p, principal: e.target.value }))} />
            </Field>
            <Field label="Interest Rate (%)">
              <input style={inp} type="number" step="0.1" placeholder="10" value={newLoan.interest_rate}
                onChange={e => setNewLoan(p => ({ ...p, interest_rate: e.target.value }))} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Duration (Months)">
              <input style={inp} type="number" min="1" placeholder="12" value={newLoan.duration_months}
                onChange={e => setNewLoan(p => ({ ...p, duration_months: e.target.value }))} />
            </Field>
            <Field label="Interest Type">
              <select style={inp} value={newLoan.interest_type}
                onChange={e => setNewLoan(p => ({ ...p, interest_type: e.target.value }))}>
                <option value="flat">Flat Rate</option>
                <option value="reducing">Reducing Balance</option>
              </select>
            </Field>
          </div>
          <Field label="Due Date (Optional)">
            <input style={inp} type="date" value={newLoan.due_date}
              onChange={e => setNewLoan(p => ({ ...p, due_date: e.target.value }))} />
          </Field>
          <Field label="Notes">
            <textarea style={{ ...inp, resize: 'vertical' }} rows={2} placeholder="Any notes..."
              value={newLoan.notes} onChange={e => setNewLoan(p => ({ ...p, notes: e.target.value }))} />
          </Field>
          {newLoan.principal && newLoan.interest_rate && (
            <div style={{ padding: '14px 16px', background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.22)', borderRadius: 12, marginBottom: 14 }}>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Loan Calculator ({newLoan.interest_type === 'flat' ? 'Flat Rate' : 'Reducing Balance'})
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { label: 'Interest',        value: kes(calcLoan.interest) },
                  { label: 'Total Due',        value: kes(calcLoan.total) },
                  { label: 'Monthly Payment',  value: kes(Math.round(calcLoan.monthly)) },
                ].map(r => (
                  <div key={r.label} style={{ textAlign: 'center' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.muted, fontWeight: 600 }}>{r.label}</p>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: C.amber }}>{r.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            style={{ ...btnPrimary(C.amber, '#1a0a00'), width: '100%', justifyContent: 'center', padding: '12px', opacity: saving ? 0.7 : 1 }}
            disabled={saving} onClick={addLoan}>
            {saving ? 'Issuing...' : 'Issue Loan'}
          </button>
        </Modal>
      )}

      {modal === 'addExpense' && (
        <Modal title="Record Expense" onClose={closeModal}>
          <Field label="Description *">
            <input style={inp} placeholder="e.g. Venue hire, Refreshments" value={newExpense.description}
              onChange={e => setNewExpense(p => ({ ...p, description: e.target.value }))} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Amount (KES) *">
              <input style={inp} type="number" placeholder="500" value={newExpense.amount}
                onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} />
            </Field>
            <Field label="Category">
              <select style={inp} value={newExpense.category}
                onChange={e => setNewExpense(p => ({ ...p, category: e.target.value }))}>
                <option value="meeting">Meeting</option>
                <option value="venue">Venue</option>
                <option value="food">Food and Drinks</option>
                <option value="transport">Transport</option>
                <option value="welfare">Welfare</option>
                <option value="admin">Administration</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
          <Field label="Paid By">
            <input style={inp} placeholder="Name of payer" value={newExpense.paid_by}
              onChange={e => setNewExpense(p => ({ ...p, paid_by: e.target.value }))} />
          </Field>
          <button
            style={{ ...btnPrimary(C.red, '#fff'), width: '100%', justifyContent: 'center', padding: '12px', marginTop: 6, opacity: saving ? 0.7 : 1 }}
            disabled={saving} onClick={addExpense}>
            {saving ? 'Saving...' : 'Record Expense'}
          </button>
        </Modal>
      )}

      {modal === 'addMinutes' && (
        <Modal title="Record Meeting Minutes" onClose={closeModal} wide>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Meeting Date *">
              <input style={inp} type="date" value={newMinutes.meeting_date}
                onChange={e => setNewMinutes(p => ({ ...p, meeting_date: e.target.value }))} />
            </Field>
            <Field label="Meeting Title *">
              <input style={inp} placeholder="e.g. Monthly AGM" value={newMinutes.title}
                onChange={e => setNewMinutes(p => ({ ...p, title: e.target.value }))} />
            </Field>
          </div>
          <Field label="Meeting Notes">
            <textarea style={{ ...inp, resize: 'vertical' }} rows={4} placeholder="What was discussed..."
              value={newMinutes.notes} onChange={e => setNewMinutes(p => ({ ...p, notes: e.target.value }))} />
          </Field>
          <Field label="Decisions Made">
            <textarea style={{ ...inp, resize: 'vertical' }} rows={3} placeholder="Key decisions and resolutions..."
              value={newMinutes.decisions} onChange={e => setNewMinutes(p => ({ ...p, decisions: e.target.value }))} />
          </Field>
          <button
            style={{ ...btnPrimary(C.blue), width: '100%', justifyContent: 'center', padding: '12px', marginTop: 6, opacity: saving ? 0.7 : 1 }}
            disabled={saving} onClick={addMinutes}>
            {saving ? 'Saving...' : 'Save Minutes'}
          </button>
        </Modal>
      )}

      {modal === 'addPenalty' && (
        <Modal title="Record Penalty" onClose={closeModal}>
          <Field label="Member *">
            <select style={inp} value={newPenalty.member_id}
              onChange={e => setNewPenalty(p => ({ ...p, member_id: e.target.value }))}>
              <option value="">Select member...</option>
              {members.filter(m => m.is_active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Penalty Amount (KES) *">
              <input style={inp} type="number" placeholder="200" value={newPenalty.amount}
                onChange={e => setNewPenalty(p => ({ ...p, amount: e.target.value }))} />
            </Field>
            <Field label="Reason">
              <input style={inp} placeholder="Late contribution" value={newPenalty.reason}
                onChange={e => setNewPenalty(p => ({ ...p, reason: e.target.value }))} />
            </Field>
          </div>
          <button
            style={{ ...btnPrimary(C.amber, '#1a0a00'), width: '100%', justifyContent: 'center', padding: '12px', marginTop: 6, opacity: saving ? 0.7 : 1 }}
            disabled={saving} onClick={addPenalty}>
            {saving ? 'Saving...' : 'Record Penalty'}
          </button>
        </Modal>
      )}

      {showRepayLoan && (
        <Modal title="Record Repayment" onClose={() => { setShowRepayLoan(null); setRepayAmount(''); }}>
          <div style={{ padding: '12px 14px', background: C.surface2, borderRadius: 11, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Member: <strong style={{ color: C.text }}>{showRepayLoan.chama_members?.name}</strong></p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>Balance: <strong style={{ color: C.amber }}>{kes((showRepayLoan.total_due || showRepayLoan.principal) - (showRepayLoan.amount_repaid || 0))}</strong></p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>Monthly: <strong style={{ color: C.text }}>{kes(showRepayLoan.monthly_payment)}</strong></p>
          </div>
          <Field label="Repayment Amount (KES)">
            <input style={inp} type="number" placeholder="Enter amount" value={repayAmount}
              onChange={e => setRepayAmount(e.target.value)} autoFocus />
          </Field>
          <button
            style={{ ...btnPrimary(), width: '100%', justifyContent: 'center', padding: '12px', opacity: saving ? 0.7 : 1 }}
            disabled={saving} onClick={repayLoan}>
            {saving ? 'Saving...' : 'Record Repayment'}
          </button>
        </Modal>
      )}

      {/* Plan gate modal */}
      {gate.open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={closeGate}
        >
          <div
            style={{
              background: C.surface, border: `1px solid ${C.borderHi}`,
              borderRadius: 20, padding: 28, maxWidth: 380, width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: C.text }}>
              {gate.requiredPlan === 'premium' ? '✨ Premium Feature' : '⚡ Pro Feature'}
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              {gate.reason}
            </p>
            {gate.limitCount != null && (
              <p style={{ margin: '0 0 16px', fontSize: 12, color: C.amber }}>
                {gate.currentCount} / {gate.limitCount} used
              </p>
            )}
            <button
              onClick={closeGate}
              style={{
                ...btnPrimary(gate.requiredPlan === 'premium' ? C.purple : C.green),
                width: '100%', justifyContent: 'center', padding: '12px',
              }}
            >
              Upgrade to {gate.requiredPlan === 'premium' ? 'Premium' : 'Pro'}
            </button>
          </div>
        </div>
      )}

      {modal === 'deleteChama' && (
        <Modal title="Delete Chama?" onClose={closeModal}>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 22 }}>
            This will permanently delete <strong style={{ color: C.text }}>{selected.name}</strong> and all its members, contributions, rotations, loans, expenses, minutes and penalties. This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...btnGhost, flex: 1, justifyContent: 'center', padding: '11px' }} onClick={closeModal}>
              Cancel
            </button>
            <button
              onClick={deleteChama}
              style={{ flex: 1, padding: '11px', background: C.red, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              Delete Forever
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}