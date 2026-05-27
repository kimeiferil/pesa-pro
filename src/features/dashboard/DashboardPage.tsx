/**
 * DashboardPage.tsx - PesaPro (Safaricom MySafaricom UI)
 *
 * Plans:
 *  Basic   - free tier, limited features, no charts
 *  Pro     - paid tier, most features unlocked, no ads
 *  Premium - full access, all features, AI insights, priority support
 */

import React, {
  useMemo, useEffect, useState, useCallback, useRef,
} from 'react';
import {
  AreaChart, Area,
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { AlertCircle, BarChart2, Bell, Building2, Check, ChevronDown, ChevronRight, Clock, Compass, CreditCard, Crown, Download, Eye, EyeOff, FileText, Filter, Gift, Globe, HelpCircle, Home, Lock, LogOut, Mail, MessageCircle, MoreVertical, Phone, PiggyBank, Plus, QrCode, RefreshCw, Search, Settings, Share2, ShieldCheck, ShoppingBag, Sparkles, Star, Tag, Target, Trash2, TrendingDown, TrendingUp, Unlock, User, Wallet, X, Zap } from 'lucide-react';
import type { ParsedTransaction } from '../../shared/mpesaParser';
import { useBusinesses } from '../../hooks/useBusinesses';
import { useCashFlowWarning } from '../../hooks/useCashFlowWarning';
import { useDebts } from '../../hooks/useDebts';
import { useBudgets } from '../../hooks/useBudgets';
import { useSavingsGoals, useNetWorth, useRecurringPayments } from '../../services/v2Service';
import { motion } from 'framer-motion';

// --- Plan config --------------------------------------------------------------
export type Plan = 'basic' | 'pro' | 'premium';

interface PlanConfig {
  id:       Plan;
  name:     string;
  emoji:    string;
  price:    string;
  period:   string;
  color:    string;
  gradient: string;
  badge:    string;
  features: string[];
  locked:   string[];
}

export const PLANS: PlanConfig[] = [
  {
    id:       'basic',
    name:     'Basic',
    emoji:    '\u{1F331}',
    price:    'Free',
    period:   'forever',
    color:    '#64748b',
    gradient: 'linear-gradient(135deg,#64748b,#334155)',
    badge:    'Starter',
    features: [
      'View last 30 transactions',
      'Import SMS (up to 50/month)',
      'Basic balance overview',
      'Email support',
    ],
    locked: ['charts', 'chama', 'campaigns', 'analytics', 'statement', 'qr', 'aiInsights'],
  },
  {
    id:       'pro',
    name:     'Pro',
    emoji:    '\u26A1',
    price:    'KES 299',
    period:   'per month',
    color:    '#3b82f6',
    gradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
    badge:    'Popular',
    features: [
      'Unlimited transactions',
      'Unlimited SMS import',
      'Cash flow charts',
      'Spend by category',
      'Chama group savings',
      'QR code payments',
      'Statement downloads',
      'WhatsApp support',
    ],
    locked: ['aiInsights', 'prioritySupport'],
  },
  {
    id:       'premium',
    name:     'Premium',
    emoji:    '\u{1F451}',
    price:    'KES 699',
    period:   'per month',
    color:    '#f59e0b',
    gradient: 'linear-gradient(135deg,#f59e0b,#b45309)',
    badge:    'Best Value',
    features: [
      'Everything in Pro',
      'AI spending insights',
      'Priority 24/7 support',
      'Early access to new features',
      'Custom categories',
      'Multi-account management',
      'Export to Excel / PDF',
      'Dedicated account manager',
    ],
    locked: [],
  },
];

// --- Types -------------------------------------------------------------------
interface Props {
  transactions: ParsedTransaction[];
  username?:    string;
  mfaEnabled?:  boolean;
  plan?:        Plan;
  onSignOut?:   () => void;
  // Updated: now accepts arbitrary path strings like '/settings' | '/mfa' in addition to page names
  onNavigate?:  (page: 'transactions' | 'campaigns' | 'import' | 'chama' | '/settings' | '/mfa') => void;
  onUpgrade?:   (plan: Plan) => void;
}

type Screen = 'phone' | 'tablet' | 'laptop';
type NavTab = 'home' | 'wallet' | 'discover' | 'account';
type Modal  = 'search' | 'menu' | 'plans' | null;

// --- Hook: screen size -------------------------------------------------------
function useScreen(): Screen {
  const get = useCallback((): Screen => {
    const w = window.innerWidth;
    if (w >= 1024) return 'laptop';
    if (w >= 640)  return 'tablet';
    return 'phone';
  }, []);
  const [screen, setScreen] = useState<Screen>(get);
  useEffect(() => {
    const handler = () => setScreen(get());
    const mql640  = window.matchMedia('(min-width: 640px)');
    const mql1024 = window.matchMedia('(min-width: 1024px)');
    mql640 .addEventListener('change', handler);
    mql1024.addEventListener('change', handler);
    window.addEventListener('resize', handler, { passive: true });
    return () => {
      mql640 .removeEventListener('change', handler);
      mql1024.removeEventListener('change', handler);
      window .removeEventListener('resize', handler);
    };
  }, [get]);
  return screen;
}

// --- Helpers -----------------------------------------------------------------
const fmt = (n: number) =>
  n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CREDIT_TYPES = new Set(['received', 'deposit', 'reversal', 'pochi']);

const CATEGORY_COLORS: Record<string, string> = {
  food: '#f97316', transport: '#38bdf8', shopping: '#a78bfa',
  utilities: '#facc15', healthcare: '#f472b6', education: '#34d399',
  airtime: '#22d3ee', charity: '#fb923c', banking: '#6366f1',
  salary: '#4ade80', rent: '#f87171', insurance: '#c084fc',
  other: '#475569',
};

// --- Notifications logic removed ---

const SEARCH_ITEMS = [
  { icon: '\u{1F4C8}', label: 'Transactions', sub: 'View full history'   },
  { icon: '\u{1F381}', label: 'Campaigns',    sub: 'Active offers'        },
  { icon: '\u{1F4F1}', label: 'Import SMS',   sub: 'Sync M-PESA messages' },
  { icon: '\u{1F465}', label: 'Chama',        sub: 'Group savings'        },
  { icon: '\u{1F4C4}', label: 'Statement',    sub: 'Download PDF'         },
  { icon: '\u{1F4AC}', label: 'Support',      sub: 'Get help now'         },
];

const FAQ_ITEMS = [
  'How do I reset my M-PESA PIN?',
  'Why is my transaction pending?',
  'How do I join a Chama group?',
  'What is PesaPro Smart Savings?',
];

// --- Plan helpers ------------------------------------------------------------
function usePlan(plan: Plan) {
  const config   = PLANS.find(p => p.id === plan) ?? PLANS[0];
  const isLocked  = (feature: string) => config.locked.includes(feature);
  const canAccess = (feature: string) => !isLocked(feature);
  return { config, isLocked, canAccess };
}

// --- Plan badge --------------------------------------------------------------
function PlanBadge({ plan }: { plan: Plan }) {
  const cfg = PLANS.find(p => p.id === plan)!;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 800,
      background: cfg.color + '22', color: cfg.color,
      border: `1px solid ${cfg.color}44`,
      borderRadius: 20, padding: '3px 9px', letterSpacing: '.04em',
    }}>
      {cfg.emoji} {cfg.name.toUpperCase()}
    </span>
  );
}

// --- Locked gate -------------------------------------------------------------
function LockedGate({ feature, plan, onUpgrade, children }: {
  feature: string; plan: Plan; onUpgrade: () => void; children: React.ReactNode;
}) {
  const { isLocked } = usePlan(plan);
  if (!isLocked(feature)) return <>{children}</>;
  return (
    <div style={S.lockedWrap} onClick={onUpgrade}>
      <div style={S.lockedBlur}>{children}</div>
      <div style={S.lockedOverlay}>
        <div style={S.lockedBadge}>
          <Crown size={14} /><span>Upgrade to unlock</span>
        </div>
      </div>
    </div>
  );
}

// --- Plans modal -------------------------------------------------------------
function PlansModal({ currentPlan, onClose, onSelect }: {
  currentPlan: Plan; onClose: () => void; onSelect: (p: Plan) => void;
}) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.sheet, maxHeight: '92vh', padding: '20px 16px 40px' }}
        onClick={e => e.stopPropagation()}>
        <div style={S.sheetHandle} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <p style={S.sheetTitle}>Choose Your Plan</p>
          <button onClick={onClose} style={S.sheetClose}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 18 }}>
          Unlock more features and grow smarter with PesaPro
        </p>
        {PLANS.map(p => {
          const isCurrent = p.id === currentPlan;
          return (
            <div key={p.id} style={{
              border: `2px solid ${isCurrent ? p.color : '#e2e8f0'}`,
              borderRadius: 18, padding: '16px 16px 14px', marginBottom: 12,
              background: isCurrent ? p.color + '0a' : '#fff',
              cursor: isCurrent ? 'default' : 'pointer',
              boxShadow: isCurrent ? `0 0 0 3px ${p.color}22` : '0 1px 4px rgba(0,0,0,.06)',
              position: 'relative' as const,
            }} onClick={() => !isCurrent && onSelect(p.id)}>
              <div style={{ position: 'absolute', top: -10, right: 14 }}>
                <span style={{
                  background: p.gradient, color: '#fff',
                  fontSize: 10, fontWeight: 800,
                  padding: '3px 10px', borderRadius: 20, letterSpacing: '.04em',
                }}>{p.badge}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: p.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>{p.emoji}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{p.name}</p>
                  <p style={{ fontSize: 12, color: '#64748b' }}>{p.period}</p>
                </div>
                <p style={{ fontSize: 18, fontWeight: 900, color: p.color }}>{p.price}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155' }}>
                    <Check size={13} style={{ color: p.color, flexShrink: 0 }} />{f}
                  </div>
                ))}
              </div>
              <button style={{
                marginTop: 12, width: '100%', padding: '11px', borderRadius: 50,
                background: isCurrent ? '#f1f5f9' : p.gradient,
                color: isCurrent ? '#94a3b8' : '#fff',
                border: 'none', fontSize: 13, fontWeight: 700,
                cursor: isCurrent ? 'default' : 'pointer',
                fontFamily: "'Sora', sans-serif",
              }} onClick={e => { e.stopPropagation(); if (!isCurrent) onSelect(p.id); }}>
                {isCurrent ? 'Current Plan' : `Get ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Upgrade nudge -----------------------------------------------------------
function UpgradeNudge({ plan, onUpgrade }: { plan: Plan; onUpgrade: () => void }) {
  if (plan === 'premium') return null;
  const next = PLANS[plan === 'basic' ? 1 : 2];
  return (
    <div onClick={onUpgrade} style={{
      background: next.gradient, borderRadius: 14, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
    }}>
      <span style={{ fontSize: 24 }}>{next.emoji}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Upgrade to {next.name}</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>
          {plan === 'basic' ? 'Unlock charts, Chama & more' : 'Unlock AI insights & priority support'}
        </p>
      </div>
      <ChevronRight size={18} style={{ color: '#fff' }} />
    </div>
  );
}

// --- AI Insights card --------------------------------------------------------
function AIInsightsCard() {
  return (
    <div style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', borderRadius: 18, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Sparkles size={18} style={{ color: '#a78bfa' }} />
        <p style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>AI Spending Insights</p>
        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: 20, padding: '2px 8px' }}>
          PREMIUM
        </span>
      </div>
      {[
        'You spent 34% more on transport this week vs last.',
        'Switch utility providers to save KES 1,200/month.',
        'Your top spending day is Saturday - plan ahead!',
      ].map(i => (
        <div key={i} style={{ fontSize: 12, color: '#c4b5fd', lineHeight: 1.6, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          {i}
        </div>
      ))}
    </div>
  );
}

// --- Data derivations --------------------------------------------------------
function useDashboardData(transactions: ParsedTransaction[]) {
  return useMemo(() => {
    let totalIn = 0, totalOut = 0;
    const dayMap: Record<string, { in: number; out: number }> = {};
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000);
      const k = d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
      dayMap[k] = { in: 0, out: 0 };
    }
    const catMap: Record<string, number> = {};
    for (const t of transactions) {
      const amt = t.amount ?? 0;
      if (CREDIT_TYPES.has(t.type)) totalIn  += amt;
      else                          totalOut += amt;
      if (t.date) {
        try {
          const d = new Date(t.date);
          const age = (now - d.getTime()) / 86_400_000;
          if (age >= 0 && age < 7) {
            const k = d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
            if (dayMap[k]) {
              if (CREDIT_TYPES.has(t.type)) dayMap[k].in  += amt;
              else                          dayMap[k].out += amt;
            }
          }
        } catch { /* ignore */ }
      }
      if (!CREDIT_TYPES.has(t.type) && amt > 0) {
        const cat = t.category ?? 'other';
        catMap[cat] = (catMap[cat] ?? 0) + amt;
      }
    }
    const cashFlow = Object.entries(dayMap).map(([day, v]) => ({
      day, Inflow: Math.round(v.in), Outflow: Math.round(v.out),
    }));
    const spendByCategory = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, value]) => ({ name, value: Math.round(value) }));
    const totalSpend = spendByCategory.reduce((s, c) => s + c.value, 0);
    return { totalIn, totalOut, net: totalIn - totalOut, cashFlow, spendByCategory, totalSpend };
  }, [transactions]);
}

// --- BottomSheet -------------------------------------------------------------
function BottomSheet({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={S.sheetHandle} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={S.sheetTitle}>{title}</p>
          <button onClick={onClose} style={S.sheetClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// --- SearchModal -------------------------------------------------------------
function SearchModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const inputRef  = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const results = q.trim()
    ? SEARCH_ITEMS.filter(i =>
        i.label.toLowerCase().includes(q.toLowerCase()) ||
        i.sub  .toLowerCase().includes(q.toLowerCase()))
    : SEARCH_ITEMS;
  return (
    <BottomSheet title="Search PesaPro" onClose={onClose}>
      <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search features, transactions..." style={S.searchInput} />
      {results.length === 0 && (
        <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
          No results found
        </p>
      )}
      {results.map(r => (
        <div key={r.label} style={S.searchRow}>
          <div style={S.searchRowIcon}>{r.icon}</div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{r.label}</p>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{r.sub}</p>
          </div>
        </div>
      ))}
    </BottomSheet>
  );
}

// --- MenuModal ---------------------------------------------------------------
// Updated: removed Statements/Offers items; Settings/Security now navigate properly
function MenuModal({ onClose, onSupport, onPlans, onSignOut, onNavigate, onSwitchBusiness, isAdmin }: {
  onClose: () => void;
  onSupport: () => void;
  onPlans: () => void;
  onSignOut?: () => void;
  onNavigate?: (path: string) => void;
  onSwitchBusiness: () => void;
  isAdmin: boolean;
}) {
  const items = [
    {
      icon: <Building2 size={18} />,
      label: 'Switch Business',
      action: () => { onClose(); onSwitchBusiness(); },
    },
    {
      icon: <Settings   size={18} />,
      label: 'Settings',
      action: () => { onClose(); onNavigate?.('/settings'); },
    },
    ...(isAdmin ? [{
      icon: <ShieldCheck size={18} />,
      label: 'Admin Panel',
      action: () => { onClose(); onNavigate?.('/admin'); },
    }] : []),
    {
      icon: <Lock       size={18} />,
      label: 'Security & Privacy',
      action: () => { onClose(); onNavigate?.('/mfa'); },
    },
    {
      icon: <Star       size={18} />,
      label: 'Upgrade Plan',
      action: () => { onClose(); onPlans(); },
    },
    {
      icon: <HelpCircle size={18} />,
      label: 'Help & Support',
      action: () => { onClose(); onSupport(); },
    },
    {
      icon: <LogOut     size={18} />,
      label: 'Sign Out',
      action: onSignOut,
      danger: true,
    },
  ];

  return (
    <BottomSheet title="More Options" onClose={onClose}>
      {items.map(({ icon, label, action, danger }) => (
        <button
          key={label}
          onClick={() => { action?.(); }}
          style={{ ...S.menuItem, ...(danger ? { color: '#ef4444' } : {}) }}
        >
          <div style={{
            ...S.menuIcon,
            ...(danger ? { background: '#fef2f2', color: '#ef4444' } : {}),
          }}>
            {icon}
          </div>
          <span style={{ flex: 1 }}>{label}</span>
          <ChevronRight size={16} style={{ color: '#cbd5e1' }} />
        </button>
      ))}
    </BottomSheet>
  );
}

// --- SupportPage -------------------------------------------------------------
function SupportPage({ onBack, plan }: { onBack: () => void; plan: Plan }) {
  const isPriority = plan === 'premium';
  return (
    <main className="pp-body">
      <div style={S.supportHero}>
        <div style={S.supportHeroBubble} />
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.65)', letterSpacing: '.1em', textTransform: 'uppercase' as const }}>
          PesaPro Support
        </p>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '6px 0 8px', lineHeight: 1.3 }}>
          How can we help you?
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.8)' }}>
          {isPriority ? 'Priority support - response within 1 hour!' : "We're here for you - reach out any time!"}
        </p>
      </div>

      <p className="pp-section-label">Contact Us</p>

      <a href="https://wa.me/254115942586" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
        <div style={{ ...S.supportCard, borderColor: '#dcfce7' }}>
          <div style={{ ...S.supportCardIcon, background: '#dcfce7', color: '#16a34a' }}>
            <MessageCircle size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              WhatsApp Us {isPriority ? '(Priority)' : ''}
            </p>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
              0115 942 586 - {isPriority ? 'Priority response' : 'Fastest response'}
            </p>
          </div>
          <ChevronRight size={18} style={{ color: '#cbd5e1' }} />
        </div>
      </a>

      <a href="mailto:fetrogames1@gmail.com" style={{ textDecoration: 'none' }}>
        <div style={{ ...S.supportCard, borderColor: '#dbeafe' }}>
          <div style={{ ...S.supportCardIcon, background: '#dbeafe', color: '#2563eb' }}>
            <Mail size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Email Support</p>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
              fetrogames1@gmail.com - {isPriority ? 'Reply in 1hr' : 'Reply in 24hrs'}
            </p>
          </div>
          <ChevronRight size={18} style={{ color: '#cbd5e1' }} />
        </div>
      </a>

      <div style={{ ...S.supportCard, borderColor: '#fef3c7', cursor: 'default' }}>
        <div style={{ ...S.supportCardIcon, background: '#fef3c7', color: '#d97706' }}>
          <Phone size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Call Centre</p>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>0800 721 000 - Mon-Fri 8am-8pm</p>
        </div>
        <ChevronRight size={18} style={{ color: '#cbd5e1' }} />
      </div>

      <p className="pp-section-label" style={{ marginTop: 4 }}>Quick Answers</p>
      {FAQ_ITEMS.map(q => (
        <div key={q} style={S.faqItem}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', flex: 1 }}>{q}</span>
          <ChevronRight size={16} style={{ color: '#cbd5e1', flexShrink: 0 }} />
        </div>
      ))}
      <button className="pp-cta-pill-green" onClick={onBack} style={{ marginTop: 8 }}>
        Back to Home
      </button>
    </main>
  );
}

// --- CashFlowChart -----------------------------------------------------------
function CashFlowChart({ data, screen }: {
  data: ReturnType<typeof useDashboardData>['cashFlow']; screen: Screen;
}) {
  const h = screen === 'phone' ? 200 : screen === 'tablet' ? 220 : 260;
  return (
    <div className="pp-card">
      <p className="pp-chart-title">7-Day Cash Flow</p>
      <p className="pp-chart-sub">Daily inflow vs outflow</p>
      <ResponsiveContainer width="100%" height={h}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradIn"  x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <RTooltip
            contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: 12 }}
            formatter={(v: unknown) => [`KES ${fmt(v as number)}`, undefined]}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 8 }} />
          <Area type="monotone" dataKey="Inflow"  stroke="#22c55e" strokeWidth={2} fill="url(#gradIn)"  dot={{ r: 4, fill: '#22c55e' }} />
          <Area type="monotone" dataKey="Outflow" stroke="#ef4444" strokeWidth={2} fill="url(#gradOut)" dot={{ r: 4, fill: '#ef4444' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- SpendChart --------------------------------------------------------------
function SpendChart({ data, total, screen }: {
  data: ReturnType<typeof useDashboardData>['spendByCategory'];
  total: number; screen: Screen;
}) {
  const sz = screen === 'phone' ? 80 : 100;
  return (
    <div className="pp-card">
      <p className="pp-chart-title">Spend by Category</p>
      <p className="pp-chart-sub">This period</p>
      <ResponsiveContainer width="100%" height={screen === 'phone' ? 160 : 190}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%"
            innerRadius={sz * 0.55} outerRadius={sz} paddingAngle={3} dataKey="value">
            {data.map(entry => (
              <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#475569'} />
            ))}
          </Pie>
          <RTooltip
            contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: 12 }}
            formatter={(v: unknown) => [`KES ${fmt(v as number)} (${total ? (((v as number) / total) * 100).toFixed(0) : 0}%)`, undefined]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
        {data.map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS[d.name] ?? '#475569', flexShrink: 0 }} />
            <span style={{ flex: 1, color: '#64748b', textTransform: 'capitalize' }}>{d.name}</span>
            <span style={{ fontWeight: 700, color: '#1e293b' }}>
              {total ? ((d.value / total) * 100).toFixed(0) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- QuickStats --------------------------------------------------------------
function QuickStats({ transactions }: { transactions: ParsedTransaction[] }) {
  const stats = useMemo(() => {
    const needsReview = transactions.filter(t => t.needs_review).length;
    const avgAmount   = transactions.length
      ? transactions.reduce((s, t) => s + Math.abs(t.amount ?? 0), 0) / transactions.length : 0;
    const topCategory = (() => {
      const map: Record<string, number> = {};
      transactions.forEach(t => { if (t.category) map[t.category] = (map[t.category] ?? 0) + 1; });
      return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';
    })();
    return { needsReview, avgAmount, topCategory, total: transactions.length };
  }, [transactions]);

  const items = [
    { label: 'Total',           value: stats.total.toLocaleString(), Icon: BarChart2,   color: '#00C851' },
    { label: 'Avg Transaction', value: `KES ${fmt(stats.avgAmount)}`, Icon: TrendingUp,  color: '#3b82f6' },
    { label: 'Top Category',    value: stats.topCategory,             Icon: Tag,         color: '#8b5cf6' },
    { label: 'Needs Review',    value: stats.needsReview.toString(),  Icon: AlertCircle, color: '#f59e0b' },
  ];
  return (
    <div className="pp-stats-grid">
      {items.map(({ label, value, Icon, color }) => (
        <div key={label} className="pp-stat-card">
          <span className="pp-stat-icon" style={{ background: `${color}18`, color }}>
            <Icon size={16} strokeWidth={2} />
          </span>
          <span className="pp-stat-value">{value}</span>
          <span className="pp-stat-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

// --- Smart Insights Card ------------------------------------------------------
function SmartInsightsCard({ transactions = [], cashFlow, debts = [], budgets = [], onNav }: any) {
  const signal = useMemo(() => {
    // 1. Budget signals
    const overBudgets = (budgets || []).filter((b: any) => {
      const spent = (transactions || [])
        .filter((t: any) => (t.category === b.category || t.category === 'other') && t.type !== 'received')
        .reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);
      return spent >= b.amount * 0.8;
    });

    if (overBudgets.length > 0) {
      const b = overBudgets[0];
      const spent = (transactions || [])
        .filter((t: any) => t.category === b.category && t.type !== 'received')
        .reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);
      const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
      return {
        title: 'Budget Alert',
        text: `You've used ${pct}% of your ${b.category} budget.`,
        color: '#f59e0b', icon: <Target size={18} />, action: 'Review'
      };
    }

    // 2. Meaningful Cash Flow gap (>10%)
    if (cashFlow && cashFlow.status !== 'healthy' && Array.isArray(cashFlow.days) && cashFlow.days.length > 0) {
      const avgIn  = cashFlow.days.reduce((s: number, d: any) => s + (d.inflow || 0), 0) / cashFlow.days.length;
      const avgOut = cashFlow.days.reduce((s: number, d: any) => s + (d.outflow || 0), 0) / cashFlow.days.length;
      const gap = avgOut - avgIn;
      if (avgIn > 0 && gap > avgIn * 0.1) {
        return {
          title: 'Cash Flow Notice',
          text: `Outflows exceed inflows by ${Math.round((gap/avgIn)*100)}% this week.`,
          color: '#ef4444', icon: <TrendingDown size={18} />, action: 'View'
        };
      }
    }

    // 3. Debt signals
    const activeDebts = (debts || []).filter((d: any) => d.status === 'active');
    if (activeDebts.length > 0) {
      const total = activeDebts.reduce((s: number, d: any) => s + (d.amount || 0), 0);
      return {
        title: 'Outstanding Debts',
        text: `You have ${activeDebts.length} unpaid items totalling KES ${total.toLocaleString()}.`,
        color: '#3b82f6', icon: <AlertCircle size={18} />, action: 'Review'
      };
    }

    // Default: Healthy pulse
    return {
      title: 'Finance Pulse',
      text: 'Your spending is stable. Keep syncing those SMS messages!',
      color: '#10b981', icon: <Check size={18} />, action: 'Sync'
    };
  }, [transactions, cashFlow, debts, budgets]);

  return (
    <div style={{
      background: `${signal.color}12`,
      border: `1px solid ${signal.color}30`,
      borderRadius: 18, padding: '14px 16px', marginBottom: 16,
      display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer'
    }} onClick={() => onNav('transactions')}>
      <div style={{
        width: 38, height: 38, borderRadius: 12, background: `${signal.color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {(React.cloneElement(signal.icon as React.ReactElement<any>, { color: signal.color }) as React.ReactElement)}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', margin: 0 }}>{signal.title}</p>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3, lineHeight: 1.4 }}>{signal.text}</p>
      </div>
      <ChevronRight size={14} color="#475569" />
    </div>
  );
}

// --- Header actions ----------------------------------------------------------
function HeaderActions({ onSearch, onMenu }: {
  onSearch: () => void;
  onMenu: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button className="pp-icon-btn" aria-label="Search" onClick={onSearch}><Search size={20} /></button>
      <button className="pp-icon-btn" aria-label="More" onClick={onMenu}><MoreVertical size={20} /></button>
    </div>
  );
}

// --- Static nav data ---------------------------------------------------------
const WALLET_SERVICES = [
  { label: 'Bill Manager',  Icon: FileText  },
  { label: 'Loans & Saves', Icon: PiggyBank },
  { label: 'Advance',       Icon: RefreshCw },
  { label: 'Global',        Icon: Globe     },
  { label: 'Account',       Icon: User      },
] as const;

const HOME_FEATURES = [
  { label: 'Transactions', Icon: BarChart2,   page: 'transactions' as const, desc: 'View full history',  emoji: "\u{1F4C8}", feature: ''          },
  { label: 'Import SMS',   Icon: Phone,       page: 'import'       as const, desc: 'Sync M-PESA SMS',    emoji: "\u{1F4F1}", feature: ''          },
  { label: 'Chama Groups', Icon: ShoppingBag, page: 'chama'        as const, desc: 'Group savings circle', emoji: "\u{1F465}", feature: 'chama'     },
  { label: 'Campaigns',    Icon: Gift,        page: 'campaigns'    as const, desc: 'Active fundraisings', emoji: "\u{1F381}", feature: 'campaigns' },
] as const;

const BOTTOM_NAV = [
  { id: 'home'     as NavTab, label: 'Home',     Icon: Home,       },
  { id: 'wallet'   as NavTab, label: 'Wallet',   Icon: CreditCard, },
  { id: 'fab'                                                        },
  { id: 'discover' as NavTab, label: 'Discover', Icon: Compass,    },
  { id: 'account'  as NavTab, label: 'Account',  Icon: User,       },
] as const;

// --- Budget Engine -------------------------------------------------------------
function BudgetEngine({ transactions = [], businessId, fmt, onOpenSetup }: { transactions: ParsedTransaction[], businessId: string | null, fmt: (n: number) => string, onOpenSetup: () => void }) {
  const { budgets = [] } = useBudgets(businessId);

  const budgetData = useMemo(() => {
    const map: Record<string, { spent: number; last?: ParsedTransaction }> = {};
    const txns = transactions || [];

    // Process transactions in chronological order to find the "last" one for each category
    const sorted = [...txns].sort((a, b) => {
      const da = a.date ? new Date(`${a.date} ${a.time ?? ''}`).getTime() : 0;
      const db = b.date ? new Date(`${b.date} ${b.time ?? ''}`).getTime() : 0;
      return db - da; // Descending
    });

    txns.forEach(t => {
      if (t.amount && t.type !== 'received' && t.type !== 'deposit' && t.type !== 'balance_check') {
        const cat = t.category || 'other';
        if (!map[cat]) map[cat] = { spent: 0 };
        map[cat].spent += Math.abs(t.amount);
      }
    });

    // Pick the most recent one for each cat
    Object.keys(map).forEach(cat => {
      map[cat].last = sorted.find(t => t.category === cat);
    });

    return map;
  }, [transactions]);

  const now = new Date();
  const dayOfMonth = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  if (!budgets || budgets.length === 0) {
    return (
      <div
        onClick={onOpenSetup}
        style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 18,
          border: '1px dashed rgba(255,255,255,0.15)', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'
        }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Target size={18} color="#10b981" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', margin: 0 }}>Smart Budget Engine</p>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Set monthly limits for food, rent, etc.</p>
        </div>
        <Plus size={16} color="#64748b" />
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 18, border: '1px solid rgba(255,255,255,0.07)', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={18} color="#10b981" />
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>Monthly Budgets</h3>
        </div>
        <button
          onClick={onOpenSetup}
          style={{ background: 'none', border: 'none', color: '#10b981', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
        >
          Edit
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {budgets.map(b => {
          const stats = budgetData[b.category] || { spent: 0 };
          const spent = stats.spent;
          const limit = b.amount || 1; // Prevent div by zero
          const pct = Math.min(Math.round((spent / limit) * 100), 100);
          const color = pct >= 90 ? '#ef4444' : pct >= 75 ? '#f59e0b' : '#10b981';

          const projectedSpend = (spent / dayOfMonth) * daysInMonth;
          const projectedOverrun = projectedSpend - b.amount;

          return (
            <div key={b.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', textTransform: 'capitalize' }}>{b.category}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{fmt(spent)} / {fmt(b.amount)}</span>
              </div>

              <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 10, transition: 'width 0.5s ease' }} />
              </div>

              {/* Context line: Last transaction */}
              {stats.last && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <Clock size={10} color="#64748b" />
                  <span style={{ fontSize: 10, color: '#64748b' }}>
                    Last: {stats.last.name || stats.last.business || 'Unknown'} Â· {fmt(stats.last.amount || 0)} Â· {stats.last.date === now.toISOString().split('T')[0] ? 'Today' : stats.last.date}
                  </span>
                </div>
              )}

              {/* Predictive line */}
              {projectedOverrun > 0 && dayOfMonth > 2 && (
                <p style={{ fontSize: 10, color: '#ef4444', marginTop: 4, fontWeight: 700 }}>
                  {"\u{26A0}\u{FE0F}"} At this pace, you'll overspend by {fmt(projectedOverrun)}
                </p>
              )}
              {pct >= 80 && projectedOverrun <= 0 && (
                <p style={{ fontSize: 10, color: color, marginTop: 4, fontWeight: 700 }}>
                  {"\u{26A0}\u{FE0F}"} {pct >= 100 ? 'Budget Exceeded' : 'Approaching limit'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Budget Setup Modal --------------------------------------------------------
function BudgetSetupModal({ businessId, onClose }: { businessId: string | null, onClose: () => void }) {
  const { budgets, saveBudget } = useBudgets(businessId);
  const [editing, setEditing] = useState<Record<string, { amount: string, rollover: boolean }>>({});

  useEffect(() => {
    const initial: Record<string, { amount: string, rollover: boolean }> = {};
    budgets.forEach(b => {
      initial[b.category] = { amount: b.amount.toString(), rollover: b.rollover };
    });
    setEditing(initial);
  }, [budgets]);

  const categories = ['food', 'rent', 'transport', 'shopping', 'utilities', 'healthcare', 'education', 'savings', 'other'];

  return (
    <div style={{ padding: 24 }}>
      <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Set Monthly Budgets</h3>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>How much do you want to spend per month?</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {categories.map(cat => (
          <div key={cat}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <label style={{ flex: 1, fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{cat}</label>
              <div style={{ position: 'relative', width: 120 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#64748b' }}>KES</span>
                <input
                  type="number"
                  placeholder="0"
                  value={editing[cat]?.amount || ''}
                  onChange={e => setEditing({ ...editing, [cat]: { ...editing[cat], amount: e.target.value } })}
                  onBlur={() => {
                    const val = parseFloat(editing[cat]?.amount || '0');
                    saveBudget(cat, val, editing[cat]?.rollover || false);
                  }}
                  style={{ width: '100%', padding: '10px 10px 10px 40px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 14, textAlign: 'right' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
              <input
                type="checkbox"
                checked={editing[cat]?.rollover || false}
                onChange={e => {
                  const r = e.target.checked;
                  setEditing({ ...editing, [cat]: { ...editing[cat], rollover: r } });
                  saveBudget(cat, parseFloat(editing[cat]?.amount || '0'), r);
                }}
              />
              <span style={{ fontSize: 11, color: '#64748b' }}>Rollover unspent amount to next month</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onClose}
        style={{ width: '100%', marginTop: 24, padding: 14, background: '#10b981', border: 'none', borderRadius: 12, color: '#022c22', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
      >
        Done
      </button>
    </div>
  );
}

// --- Net Worth Tracker --------------------------------------------------------
function NetWorthWidget() {
  const { data, isLoading } = useNetWorth();
  if (isLoading || !data) return null;

  return (
    <div style={{ background: '#1A1F1B', borderRadius: 20, padding: 18, border: '1px solid rgba(255,255,255,0.07)', marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Estimated Net Worth</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: '#00A651', margin: 0 }}>KES {data.total.toLocaleString('en-KE')}</h2>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>M-PESA</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{data.mpesa.toLocaleString()}</p>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>Assets/SACCO</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{(data.total - data.mpesa).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

// --- Goal Jars ----------------------------------------------------------------
function GoalJars() {
  const { data: goals } = useSavingsGoals();
  if (!goals || goals.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <p className="pp-section-label">Savings Jars</p>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {goals.map(goal => {
          const pct = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100);
          return (
            <div key={goal.id} style={{ minWidth: 140, background: '#1A1F1B', borderRadius: 16, padding: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{goal.emoji}</div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', margin: 0 }}>{goal.name}</p>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, margin: '10px 0 6px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: goal.color, borderRadius: 2 }} />
              </div>
              <p style={{ fontSize: 11, fontWeight: 700, color: goal.color }}>{pct}% saved</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Recurring Alert ---------------------------------------------------------
function RecurringAlerts() {
  const { data: payments } = useRecurringPayments();
  if (!payments || payments.length === 0) return null;

  return (
    <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 16, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <Zap size={20} color="#3b82f6" />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Upcoming Debit</p>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
          {payments[0].merchant} (KES {payments[0].amount.toLocaleString()}) expected {payments[0].next_expected_date}
        </p>
      </div>
    </div>
  );
}

// --- Main Component ----------------------------------------------------------
export default function DashboardPage({
  transactions: allTransactions = [],
  username     = 'User',
  mfaEnabled   = false,
  plan         = 'basic',
  onSignOut,
  onNavigate,
  onUpgrade,
}: Props) {
  const profile: { role?: string } | null = null; // TODO: fetch from useAuth when wired
  const screen = useScreen();
  const {
    businesses, currentBusiness, currentBusinessId,
    switchBusiness, createBusiness, deleteBusiness, generateMentorLink, loading: bizLoading
  } = useBusinesses();

  const transactions = useMemo(() => {
    if (!currentBusinessId) return allTransactions.filter(t => !t.business_id);
    return allTransactions.filter(t => t.business_id === currentBusinessId);
  }, [allTransactions, currentBusinessId]);

  const data   = useDashboardData(transactions);
  const { config: planConfig, isLocked, canAccess } = usePlan(plan);
  const { result: cashFlowWarning } = useCashFlowWarning(currentBusinessId);
  const { debts = [], summary: debtSummary } = useDebts(currentBusinessId);
  const { budgets = [] } = useBudgets(currentBusinessId);

  const [tab,            setTab           ] = useState<NavTab>('home');
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [modal,          setModal         ] = useState<Modal | 'business_selector' | 'add_business' | 'budget_setup'>(null);
  const [supportOpen,    setSupportOpen   ] = useState(false);
  const [newBizName,     setNewBizName    ] = useState('');

  const isLaptop    = screen === 'laptop';

  const closeModal  = () => setModal(null);
  const openSupport = () => { setModal(null); setSupportOpen(true); };
  const openPlans   = () => { setModal('plans'); setSupportOpen(false); };

  const handleNav = (page?: 'transactions' | 'campaigns' | 'import' | 'chama') => {
    if (page) onNavigate?.(page);
  };
  const handleUpgrade = (newPlan: Plan) => { onUpgrade?.(newPlan); setModal(null); };

  const greetingText = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  })();

  return (
    <div className="pp-shell">

      {isLaptop && (
        <aside className="pp-sidebar">
          <div className="pp-sidebar-logo">
            <span className="pp-logo-icon">{"\u{1F4B3}"}</span>
            <span className="pp-logo-text">PesaPro</span>
          </div>
          <div style={{ padding: '8px 20px 14px' }}>
            <PlanBadge plan={plan} />
          </div>
          <nav className="pp-sidebar-nav">
            {([
              { id: 'home',         label: 'Home',        Icon: Home,        emoji: '\u{1F3E0}', feature: ''          },
              { id: 'transactions', label: 'Transactions', Icon: BarChart2,   emoji: '\u{1F4C8}', feature: ''          },
              { id: 'campaigns',    label: 'Campaigns',    Icon: Gift,        emoji: '\u{1F381}', feature: 'campaigns' },
              { id: 'import',       label: 'Import SMS',   Icon: Phone,       emoji: '\u{1F4F1}', feature: ''          },
              { id: 'chama',        label: 'Chama',        Icon: ShoppingBag, emoji: '\u{1F465}', feature: 'chama'     },
            ] as const).map(({ id, label, Icon, emoji, feature }) => {
              const locked = feature ? isLocked(feature) : false;
              return (
                <button key={id}
                  className={`pp-sidebar-item ${id === 'home' ? 'active' : ''} ${locked ? 'locked' : ''}`}
                  onClick={() => locked ? openPlans() : id !== 'home' && handleNav(id as never)}>
                  <span style={{ fontSize: 16 }}>{emoji}</span>
                  <Icon size={18} strokeWidth={1.75} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {locked && <Crown size={13} style={{ color: '#f59e0b' }} />}
                </button>
              );
            })}
            <button className="pp-sidebar-item" onClick={openSupport}>
              <span style={{ fontSize: 16 }}>{"\u{1F4AC}"}</span>
              <HelpCircle size={18} strokeWidth={1.75} />
              <span>Support</span>
            </button>
            <button className="pp-sidebar-item" onClick={openPlans}
              style={{ color: planConfig.color }}>
              <span style={{ fontSize: 16 }}>{planConfig.emoji}</span>
              <Star size={18} strokeWidth={1.75} />
              <span>Upgrade Plan</span>
            </button>
          </nav>
          <button className="pp-sidebar-signout" onClick={onSignOut}>
            <LogOut size={16} /> Sign out
          </button>
        </aside>
      )}

      <div className="pp-main">

        {supportOpen && (
          <>
            <header className="pp-wallet-header">
              <span className="pp-wallet-title">Support</span>
              <button className="pp-icon-btn" onClick={() => setSupportOpen(false)} aria-label="Back">
                <X size={20} />
              </button>
            </header>
            <SupportPage onBack={() => setSupportOpen(false)} plan={plan} />
          </>
        )}

        {!supportOpen && tab === 'home' && (
          <>
            <header className="pp-header">
              <div className="pp-header-topbar">
                {mfaEnabled && <span className="pp-mfa-badge">MFA</span>}
                <PlanBadge plan={plan} />

                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                </div>

                <HeaderActions
                  onSearch={() => setModal('search')}
                  onMenu  ={() => setModal('menu')}
                />
              </div>
              <div className="pp-header-body">
                <p className="pp-header-sub">{greetingText}</p>
                <h1 className="pp-header-name">{username}</h1>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 }}>
                  <button className="pp-cta-pill" onClick={() => handleNav('transactions')}>
                    View Balances
                  </button>
                  <button onClick={() => setBalanceVisible(v => !v)} style={S.eyePill}
                    aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}>
                    {balanceVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </header>

            <main className="pp-body">
              <NetWorthWidget />
              <RecurringAlerts />
              <SmartInsightsCard
                transactions={transactions}
                cashFlow={cashFlowWarning}
                debts={debts}
                budgets={budgets}
                onNav={handleNav}
              />
              <GoalJars />

              <UpgradeNudge plan={plan} onUpgrade={openPlans} />

              <div className="pp-two-col">
                <div className="pp-promo-banner">
                  <div className="pp-promo-bubble pp-promo-bubble--lg" />
                  <div className="pp-promo-bubble pp-promo-bubble--sm" />
                  <div className="pp-promo-content">
                    <p className="pp-promo-eyebrow">PesaPro</p>
                    <h3 className="pp-promo-headline">Smart Savings Mode</h3>
                    <button className="pp-promo-link">Explore Deals</button>
                  </div>
                </div>
                <div className="pp-helper-stack">
                  <button className="pp-helper-card" onClick={openSupport}>
                    <span style={{ fontSize: 20 }}>{"\u{1F198}"}</span>
                    <div>
                      <p className="pp-helper-title">Get Help</p>
                      <p className="pp-helper-sub">{plan === 'premium' ? 'Priority support' : 'Chat & support'}</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="pp-feature-grid">
                {HOME_FEATURES.map(({ label, Icon, page, desc, emoji, feature }) => {
                  const locked = feature ? isLocked(feature) : false;
                  return (
                    <button key={label}
                      className={`pp-feature-card ${locked ? 'pp-feature-card--locked' : ''}`}
                      onClick={() => locked ? openPlans() : handleNav(page)}>
                      <span className="pp-feature-icon">
                        <span style={{ fontSize: 18 }}>{emoji}</span>
                      </span>
                      <div className="pp-feature-text">
                        <p className="pp-feature-title">
                          {label}{locked && <Crown size={11} style={{ color: '#f59e0b', marginLeft: 3, display: 'inline' }} />}
                        </p>
                        <p className="pp-feature-desc">{locked ? 'Upgrade to unlock' : desc}</p>
                      </div>
                    </button>
                  );
                })}
                <button className="pp-feature-card" onClick={openSupport}>
                  <span className="pp-feature-icon"><span style={{ fontSize: 18 }}>{"\u{1F4AC}"}</span></span>
                  <div className="pp-feature-text">
                    <p className="pp-feature-title">Support</p>
                    <p className="pp-feature-desc">{plan === 'premium' ? 'Priority 24/7' : "We're here"}</p>
                  </div>
                </button>
              </div>

              <div className="pp-section-label">Business Health</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="pp-card" style={{ padding: '14px' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Owed to You</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#00C851', marginTop: 4 }}>KES {fmt(debtSummary.totalOwedToUs)}</p>
                </div>
                <div className="pp-card" style={{ padding: '14px' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Owed by You</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>KES {fmt(debtSummary.totalOwedByUs)}</p>
                </div>
              </div>

              <div className="pp-section-label">Analytics</div>

              <div className="pp-balance-card">
                <p className="pp-balance-eyebrow">NET BALANCE</p>
                <p className={`pp-balance-amount ${data.net < 0 ? 'neg' : 'pos'}`}>
                  {balanceVisible
                    ? `KES ${data.net < 0 ? '-' : ''}${fmt(Math.abs(data.net))}`
                    : '••••••'}
                </p>
                <div className="pp-balance-row">
                  <div className="pp-balance-item">
                    <span className="pp-arrow pp-arrow--in">?</span><span>Inflow</span>
                    <strong>{balanceVisible ? `KES ${fmt(data.totalIn)}` : '••••••'}</strong>
                  </div>
                  <div className="pp-balance-item">
                    <span className="pp-arrow pp-arrow--out">?</span><span>Outflow</span>
                    <strong>{balanceVisible ? `KES ${fmt(data.totalOut)}` : '••••••'}</strong>
                  </div>
                </div>
              </div>

              <QuickStats transactions={transactions} />

              <BudgetEngine transactions={transactions} businessId={currentBusinessId} fmt={fmt} onOpenSetup={() => setModal('budget_setup')} />

              <LockedGate feature="charts" plan={plan} onUpgrade={openPlans}>
                <div className={screen === 'laptop' ? 'pp-chart-row' : 'pp-chart-stack'}>
                  <div className={screen === 'laptop' ? 'pp-chart-wide' : ''}>
                    <CashFlowChart data={data.cashFlow} screen={screen} />
                  </div>
                  <div className={screen === 'laptop' ? 'pp-chart-narrow' : ''}>
                    <SpendChart data={data.spendByCategory} total={data.totalSpend} screen={screen} />
                  </div>
                </div>
              </LockedGate>

              {canAccess('aiInsights') && <AIInsightsCard />}
              {isLocked('aiInsights') && (
                <div onClick={openPlans} style={{
                  background: 'linear-gradient(135deg,#1e1b4b,#312e81)',
                  borderRadius: 18, padding: '16px 18px',
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                }}>
                  <Sparkles size={22} style={{ color: '#a78bfa', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>AI Spending Insights</p>
                    <p style={{ fontSize: 11, color: '#a78bfa', marginTop: 2 }}>Premium only - tap to upgrade</p>
                  </div>
                  <ChevronRight size={16} style={{ color: '#a78bfa' }} />
                </div>
              )}
            </main>
          </>
        )}

        {!supportOpen && tab === 'wallet' && (
          <>
            <header className="pp-wallet-header">
              <span className="pp-wallet-title">My Wallet</span>
              <HeaderActions onSearch={() => setModal('search')}
                onMenu={() => setModal('menu')} />
            </header>
            <main className="pp-body">
              <button className="pp-balance-pill" onClick={() => setBalanceVisible(v => !v)}>
                {balanceVisible ? `Net: KES ${fmt(Math.abs(data.net))}` : 'Tap to reveal balance'}
              </button>
              <div className="pp-service-grid">
                {WALLET_SERVICES.map(({ label, Icon }) => (
                  <button key={label} className="pp-service-card">
                    <span className="pp-service-icon"><Icon size={24} strokeWidth={1.5} /></span>
                    <span className="pp-service-label">{label}</span>
                  </button>
                ))}
              </div>
              <LockedGate feature="statement" plan={plan} onUpgrade={openPlans}>
                <button className="pp-statement-pill" onClick={() => handleNav('transactions')}>
                  <FileText size={16} style={{ color: '#00C851' }} />
                  <span>PESA STATEMENT</span>
                </button>
              </LockedGate>
              <LockedGate feature="qr" plan={plan} onUpgrade={openPlans}>
                <button className="pp-scan-qr"><QrCode size={20} /><span>SCAN QR CODE</span></button>
              </LockedGate>
              <p className="pp-section-label" style={{ marginTop: 20 }}>New &amp; Featured</p>
              <div className="pp-hscroll">
                {[
                  { label: 'Import SMS',   Icon: Phone,       page: 'import'    as const, badge: '',    feature: ''          },
                  { label: 'Chama Groups', Icon: ShoppingBag, page: 'chama'     as const, badge: 'NEW', feature: 'chama'     },
                  { label: 'Campaigns',    Icon: Gift,        page: 'campaigns' as const, badge: 'NEW', feature: 'campaigns' },
                ].map(({ label, Icon, page, badge, feature }) => {
                  const locked = feature ? isLocked(feature) : false;
                  return (
                    <button key={label} className="pp-hscroll-card"
                      onClick={() => locked ? openPlans() : handleNav(page)}>
                      {badge && !locked && <span className="pp-badge">{badge}</span>}
                      {locked && <span className="pp-badge" style={{ background: '#f59e0b' }}>PRO</span>}
                      <span className="pp-hscroll-icon"><Icon size={22} strokeWidth={1.5} /></span>
                      <span className="pp-hscroll-label">{label}</span>
                      <span className="pp-hscroll-sub">{locked ? 'Upgrade to unlock' : 'Tap to open'}</span>
                    </button>
                  );
                })}
              </div>
              <p className="pp-section-label" style={{ marginTop: 20 }}>Analytics</p>
              <QuickStats transactions={transactions} />
              <BudgetEngine transactions={transactions} businessId={currentBusinessId} fmt={fmt} onOpenSetup={() => setModal('budget_setup')} />
              <LockedGate feature="charts" plan={plan} onUpgrade={openPlans}>
                <div style={{ marginTop: 12 }}>
                  <CashFlowChart data={data.cashFlow} screen={screen} />
                </div>
                <div style={{ marginTop: 12, marginBottom: 80 }}>
                  <SpendChart data={data.spendByCategory} total={data.totalSpend} screen={screen} />
                </div>
              </LockedGate>
            </main>
          </>
        )}

        {!supportOpen && tab === 'discover' && (
          <>
            <header className="pp-wallet-header">
              <span className="pp-wallet-title">Discover</span>
              <HeaderActions onSearch={() => setModal('search')}
                onMenu={() => setModal('menu')} />
            </header>
            <main className="pp-body">
              <div className="pp-promo-banner" style={{ minHeight: 130 }}>
                <div className="pp-promo-bubble pp-promo-bubble--lg" />
                <div className="pp-promo-bubble pp-promo-bubble--sm" />
                <div className="pp-promo-content">
                  <p className="pp-promo-eyebrow">Hot Deals</p>
                  <h3 className="pp-promo-headline">Exclusive Offers Just For You</h3>
                  <button className="pp-promo-link">Browse All</button>
                </div>
              </div>
              <LockedGate feature="campaigns" plan={plan} onUpgrade={openPlans}>
                <>
                  <p className="pp-section-label">Active Offers</p>
                  {[
                    { emoji: "\u{1F6D2}", title: 'Supermarket Cashback', sub: 'Get 5% back on groceries',  tag: 'Ends in 2 days' },
                    { emoji: "\u26FD", title: 'Fuel Discount',         sub: 'Save KES 10/L at partners', tag: 'Ongoing'        },
                    { emoji: "\u{1F4FA}", title: 'Streaming Bundle',      sub: 'Free 1-month with Fuliza',  tag: 'Limited'        },
                  ].map(({ emoji, title, sub, tag }) => (
                    <div key={title} className="pp-helper-card" style={{ borderRadius: 14 }}>
                      <div className="pp-helper-icon" style={{ fontSize: 22, width: 44, height: 44 }}>{emoji}</div>
                      <div style={{ flex: 1 }}>
                        <p className="pp-helper-title">{title}</p>
                        <p className="pp-helper-sub">{sub}</p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#e8fdf0', color: '#00C851', padding: '4px 10px', borderRadius: 20 }}>{tag}</span>
                    </div>
                  ))}
                  <button className="pp-cta-pill-green" onClick={() => handleNav('campaigns')}>
                    View All Campaigns
                  </button>
                </>
              </LockedGate>
            </main>
          </>
        )}

        {!supportOpen && tab === 'account' && (
          <>
            <header className="pp-wallet-header">
              <span className="pp-wallet-title">My Account</span>
              <HeaderActions onSearch={() => setModal('search')}
                onMenu={() => setModal('menu')} />
            </header>
            <main className="pp-body">
              <div style={S.profileCard}>
                <div style={S.profileAvatar}>{username.slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{username}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', marginTop: 3 }}>0712 345 678</p>
                  <div style={{ marginTop: 6 }}><PlanBadge plan={plan} /></div>
                </div>
              </div>

              <div style={{
                background: planConfig.gradient, borderRadius: 16,
                padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12,
                cursor: plan === 'premium' ? 'default' : 'pointer',
              }} onClick={() => plan !== 'premium' && openPlans()}>
                <span style={{ fontSize: 28 }}>{planConfig.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{planConfig.name} Plan</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>
                    {plan === 'premium'
                      ? 'Full access to all features'
                      : `Upgrade for more - ${PLANS.find(p => p.id !== plan && p.id !== 'basic')?.price ?? PLANS[1].price}`}
                  </p>
                </div>
                {plan !== 'premium' && <ChevronRight size={18} style={{ color: '#fff' }} />}
              </div>

              <p className="pp-section-label">Account Settings</p>
              {[
                { emoji: '??', label: 'Profile',       sub: 'Edit your details'  },
                { emoji: '??', label: 'Security',       sub: 'PIN & biometrics'   },
                { emoji: '??', label: 'Linked Cards',   sub: 'M-PESA & bank'     },
              ].map(({ emoji, label, sub }) => (
                <div key={label} className="pp-helper-card" style={{ borderRadius: 12 }}>
                  <div className="pp-helper-icon" style={{ fontSize: 18 }}>{emoji}</div>
                  <div style={{ flex: 1 }}>
                    <p className="pp-helper-title">{label}</p>
                    <p className="pp-helper-sub">{sub}</p>
                  </div>
                  <ChevronRight size={16} style={{ color: '#cbd5e1' }} />
                </div>
              ))}

              <button className="pp-helper-card" style={{ borderRadius: 12 }} onClick={openPlans}>
                <div className="pp-helper-icon" style={{ fontSize: 18, background: '#fef3c7', color: '#f59e0b' }}>{"\u2B50"}</div>
                <div style={{ flex: 1 }}>
                  <p className="pp-helper-title">Manage Plan</p>
                  <p className="pp-helper-sub">Currently on {planConfig.name}</p>
                </div>
                <ChevronRight size={16} style={{ color: '#cbd5e1' }} />
              </button>

              <button className="pp-helper-card" style={{ borderRadius: 12 }} onClick={openSupport}>
                <div className="pp-helper-icon" style={{ fontSize: 18 }}>{"\u{1F4AC}"}</div>
                <div style={{ flex: 1 }}>
                  <p className="pp-helper-title">Help &amp; Support</p>
                  <p className="pp-helper-sub">{plan === 'premium' ? 'Priority support' : 'WhatsApp, email & more'}</p>
                </div>
                <ChevronRight size={16} style={{ color: '#cbd5e1' }} />
              </button>

              <button className="pp-cta-pill-green"
                style={{ background: '#fee2e2', color: '#ef4444', boxShadow: 'none' }}
                onClick={onSignOut}>
                Sign Out
              </button>
            </main>
          </>
        )}

        {!isLaptop && (
          <nav className="pp-bottom-nav">
            {BOTTOM_NAV.map((item) => {
              if (!('id' in item) || item.id === 'fab') {
                return (
                  <button key="fab" className="pp-fab" aria-label="Quick access"
                    onClick={() => handleNav('transactions')}>
                    <Zap size={22} strokeWidth={2} />
                  </button>
                );
              }
              const navId    = item.id as NavTab;
              const isActive = !supportOpen && tab === navId;
              return (
                <button key={navId}
                  className={`pp-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => { setSupportOpen(false); setTab(navId); }}>
                  <item.Icon size={21} strokeWidth={isActive ? 2.25 : 1.75} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {modal === 'search'        && <SearchModal        onClose={closeModal} />}
      {modal === 'budget_setup'   && (
        <div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:480,width:'90%',maxHeight:'80vh',overflowY:'auto'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><h2 style={{fontSize:18,fontWeight:700}}>Budgeting</h2><button onClick={closeModal} style={{background:'none',border:'none',cursor:'pointer',fontSize:20}}>×</button></div>
          <BudgetSetupModal businessId={currentBusinessId} onClose={closeModal} />
        </div></div>
      )}
      {modal === 'menu'          && (
        <MenuModal
          onClose={closeModal}
          onSupport={openSupport}
          onPlans={openPlans}
          onSignOut={onSignOut}
          onNavigate={(path) => {
            closeModal();
            onNavigate?.(path as any);  // handles /settings, /mfa via App.tsx
          }}
          onSwitchBusiness={() => setModal('business_selector')}
          isAdmin={profile?.role === 'admin'}
        />
      )}
      {modal === 'plans'         && <PlansModal currentPlan={plan} onClose={closeModal} onSelect={handleUpgrade} />}

      {modal === 'business_selector' && (
        <BottomSheet title="Switch Business" onClose={closeModal}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {businesses.map(b => (
              <button
                key={b.id}
                onClick={() => { switchBusiness(b.id); closeModal(); }}
                style={{
                  ...S.menuItem,
                  background: b.id === currentBusinessId ? '#e8fdf0' : 'transparent',
                  color: b.id === currentBusinessId ? '#00C851' : '#0f172a',
                  padding: '12px 16px', borderRadius: 12, border: 'none'
                }}
              >
                <Building2 size={18} style={{ marginRight: 10 }} />
                <span style={{ flex: 1 }}>{b.name}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const token = await generateMentorLink(b.id);
                      if (token) {
                        const url = `${window.location.origin}/mentor/${token}`;
                        await navigator.clipboard.writeText(url);
                        alert('Mentor link copied to clipboard!\n\nThis link will allow someone to view your business health for 30 days.');
                      } else {
                        alert('Failed to generate mentor link. Please try again.');
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: '#64748b', padding: 4, cursor: 'pointer' }}
                    title="Copy Mentor Link"
                  >
                    <Share2 size={16} />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`Are you sure you want to delete "${b.name}"? All transactions assigned to it will return to Personal.`)) {
                        await deleteBusiness(b.id);
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: '#ef4444', padding: 4, cursor: 'pointer' }}
                    title="Delete Business"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {b.id === currentBusinessId && <Check size={16} />}
              </button>
            ))}
            <button
              onClick={() => setModal('add_business')}
              style={{
                ...S.menuItem, color: '#00C851', border: '1px dashed #00C851',
                padding: '12px 16px', borderRadius: 12, marginTop: 10, justifyContent: 'center'
              }}
            >
              <Plus size={18} style={{ marginRight: 8 }} />
              <span>Add New Business</span>
            </button>
          </div>
        </BottomSheet>
      )}

      {modal === 'add_business' && (
        <BottomSheet title="Add Business" onClose={() => setModal('business_selector')}>
          <div style={{ padding: '10px 0' }}>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>Enter your business name to start tracking it separately.</p>
            <input
              autoFocus
              value={newBizName}
              onChange={e => setNewBizName(e.target.value)}
              placeholder="e.g. My Shop, Consulting, etc."
              style={S.searchInput}
            />
            <button
              disabled={!newBizName.trim()}
              onClick={async () => {
                await createBusiness(newBizName);
                setNewBizName('');
                closeModal();
              }}
              className="pp-cta-pill-green"
              style={{ opacity: newBizName.trim() ? 1 : 0.5 }}
            >
              Create Business
            </button>
          </div>
        </BottomSheet>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .pp-shell{display:flex;height:100dvh;background:#f3f6f2;font-family:'Sora',system-ui,sans-serif;overflow:hidden;}
        .pp-sidebar{width:240px;flex-shrink:0;background:#fff;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;padding:24px 0;}
        .pp-sidebar-logo{display:flex;align-items:center;gap:10px;padding:0 20px 16px;border-bottom:1px solid #f1f5f9;}
        .pp-logo-icon{width:38px;height:38px;background:#00C851;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:18px;}
        .pp-logo-text{font-size:18px;font-weight:800;color:#0f172a;}
        .pp-sidebar-nav{flex:1;display:flex;flex-direction:column;gap:2px;padding:16px 12px;}
        .pp-sidebar-item{display:flex;align-items:center;gap:8px;padding:11px 14px;border-radius:11px;background:transparent;border:none;color:#64748b;cursor:pointer;font-size:14px;font-weight:600;text-align:left;transition:background .15s,color .15s;width:100%;font-family:'Sora',sans-serif;}
        .pp-sidebar-item:hover{background:#f1f5f9;color:#0f172a;}
        .pp-sidebar-item.active{background:#e8fdf0;color:#00C851;}
        .pp-sidebar-item.locked{opacity:.6;}
        .pp-sidebar-signout{display:flex;align-items:center;gap:8px;margin:0 12px;padding:11px 14px;background:transparent;border:1px solid #e2e8f0;border-radius:11px;color:#94a3b8;cursor:pointer;font-size:14px;font-weight:600;transition:background .15s;font-family:'Sora',sans-serif;}
        .pp-sidebar-signout:hover{background:#fef2f2;color:#ef4444;border-color:#fecaca;}
        .pp-main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
        .pp-header{background:linear-gradient(145deg,#00C851 0%,#008e40 60%,#005c28 100%);flex-shrink:0;}
        .pp-header-topbar{display:flex;align-items:center;gap:6px;padding:14px 16px 8px;}
        .pp-mfa-badge{font-size:11px;font-weight:700;background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:20px;padding:4px 10px;}
        .pp-icon-btn{background:rgba(255,255,255,.18);border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;transition:background .15s;}
        .pp-icon-btn:hover{background:rgba(255,255,255,.28);}
        .pp-header-body{padding:4px 16px 24px;text-align:center;}
        .pp-header-sub{color:rgba(255,255,255,.8);font-size:13px;font-weight:500;}
        .pp-header-name{color:#fff;font-size:26px;font-weight:900;margin:2px 0 0;}
        .pp-cta-pill{display:inline-flex;align-items:center;background:#fff;color:#00C851;font-size:14px;font-weight:700;padding:10px 28px;border-radius:50px;border:none;box-shadow:0 4px 14px rgba(0,0,0,.12);cursor:pointer;transition:transform .15s;font-family:'Sora',sans-serif;}
        .pp-cta-pill:hover{transform:translateY(-1px);}
        .pp-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 14px 90px;display:flex;flex-direction:column;gap:12px;}
        .pp-body::-webkit-scrollbar{width:3px;}
        .pp-body::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:2px;}
        .pp-section-label{font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.06em;text-transform:uppercase;}
        .pp-two-col{display:grid;grid-template-columns:1.2fr 1fr;gap:10px;}
        .pp-promo-banner{background:linear-gradient(135deg,#00C851 0%,#007a32 100%);border-radius:16px;padding:18px 16px;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;min-height:130px;}
        .pp-promo-bubble{position:absolute;border-radius:50%;background:rgba(255,255,255,.12);}
        .pp-promo-bubble--lg{width:100px;height:100px;top:-20px;right:-20px;}
        .pp-promo-bubble--sm{width:55px;height:55px;top:20px;right:50px;}
        .pp-promo-content{position:relative;z-index:1;}
        .pp-promo-eyebrow{font-size:10px;font-weight:700;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.06em;}
        .pp-promo-headline{font-size:14px;font-weight:800;color:#fff;margin:3px 0 8px;line-height:1.3;}
        .pp-promo-link{background:transparent;border:none;color:rgba(255,255,255,.85);font-size:12px;font-weight:700;cursor:pointer;padding:0;font-family:'Sora',sans-serif;}
        .pp-helper-stack{display:flex;flex-direction:column;gap:10px;}
        .pp-helper-card{background:#fff;border:1px solid #f1f5f9;border-radius:14px;padding:12px 14px;flex:1;display:flex;align-items:center;gap:10px;cursor:pointer;text-align:left;transition:box-shadow .15s,transform .15s;box-shadow:0 1px 3px rgba(0,0,0,.06);width:100%;}
        .pp-helper-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.08);transform:translateY(-1px);}
        .pp-helper-icon{color:#00C851;flex-shrink:0;width:36px;height:36px;border-radius:10px;background:#e8fdf0;display:flex;align-items:center;justify-content:center;font-size:18px;}
        .pp-helper-title{font-size:13px;font-weight:700;color:#0f172a;}
        .pp-helper-sub{font-size:11px;color:#94a3b8;margin-top:1px;}
        .pp-feature-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
        .pp-feature-card{background:#fff;border:1px solid #f1f5f9;border-radius:14px;padding:14px;display:flex;align-items:center;gap:12px;cursor:pointer;text-align:left;box-shadow:0 1px 3px rgba(0,0,0,.05);transition:box-shadow .15s,transform .15s;}
        .pp-feature-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.08);transform:translateY(-1px);}
        .pp-feature-card:active{transform:scale(.97);}
        .pp-feature-card--locked{background:#fafafa;opacity:.8;}
        .pp-feature-icon{width:40px;height:40px;border-radius:12px;background:#e8fdf0;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .pp-feature-text{min-width:0;}
        .pp-feature-title{font-size:13px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .pp-feature-desc{font-size:11px;color:#94a3b8;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .pp-balance-card{background:linear-gradient(135deg,#00C851 0%,#005c24 100%);border-radius:18px;padding:20px;}
        .pp-balance-eyebrow{font-size:10px;font-weight:700;color:rgba(255,255,255,.7);letter-spacing:.1em;}
        .pp-balance-amount{font-size:clamp(26px,7vw,40px);font-weight:900;color:#fff;margin:6px 0 14px;line-height:1;}
        .pp-balance-amount.neg{color:#fca5a5;}
        .pp-balance-amount.pos{color:#d1fae5;}
        .pp-balance-row{display:flex;gap:24px;flex-wrap:wrap;}
        .pp-balance-item{display:flex;flex-direction:column;gap:3px;font-size:13px;color:rgba(255,255,255,.75);}
        .pp-balance-item strong{color:#fff;font-size:14px;}
        .pp-arrow{font-size:14px;}
        .pp-arrow--in{color:#4ade80;}
        .pp-arrow--out{color:#f87171;}
        .pp-stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}
        .pp-stat-card{background:#fff;border:1px solid #f1f5f9;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:5px;box-shadow:0 1px 3px rgba(0,0,0,.05);}
        .pp-stat-icon{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;}
        .pp-stat-value{font-size:15px;font-weight:800;color:#0f172a;}
        .pp-stat-label{font-size:11px;color:#94a3b8;}
        .pp-card{background:#fff;border:1px solid #f1f5f9;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.05);}
        .pp-chart-title{font-size:15px;font-weight:700;color:#0f172a;}
        .pp-chart-sub{font-size:12px;color:#94a3b8;margin:2px 0 10px;}
        .pp-chart-row{display:grid;grid-template-columns:2fr 1fr;gap:12px;}
        .pp-chart-stack{display:flex;flex-direction:column;gap:12px;}
        .pp-wallet-header{background:linear-gradient(145deg,#00C851 0%,#00943c 100%);display:flex;align-items:center;justify-content:space-between;padding:16px;flex-shrink:0;}
        .pp-wallet-title{font-size:18px;font-weight:800;color:#fff;}
        .pp-balance-pill{display:block;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:50px;padding:13px 24px;font-size:14px;font-weight:700;color:#00C851;cursor:pointer;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.07);transition:box-shadow .15s;font-family:'Sora',sans-serif;}
        .pp-balance-pill:hover{box-shadow:0 3px 10px rgba(0,0,0,.1);}
        .pp-service-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
        .pp-service-card{background:#fff;border:1px solid #f1f5f9;border-radius:14px;padding:16px 8px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.05);transition:box-shadow .15s,transform .15s;}
        .pp-service-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.08);transform:translateY(-1px);}
        .pp-service-card:active{transform:scale(.96);}
        .pp-service-icon{color:#00C851;}
        .pp-service-label{font-size:11px;font-weight:600;color:#334155;text-align:center;line-height:1.3;}
        .pp-statement-pill{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;border-radius:50px;background:#fff;border:1px solid #e2e8f0;font-size:13px;font-weight:800;color:#334155;letter-spacing:.04em;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.06);transition:box-shadow .15s;font-family:'Sora',sans-serif;}
        .pp-statement-pill:hover{box-shadow:0 3px 10px rgba(0,0,0,.1);}
        .pp-scan-qr{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px;border-radius:50px;background:#c0392b;border:none;font-size:14px;font-weight:800;color:#fff;letter-spacing:.06em;cursor:pointer;box-shadow:0 3px 12px rgba(192,57,43,.35);transition:box-shadow .15s,transform .15s;font-family:'Sora',sans-serif;}
        .pp-scan-qr:hover{box-shadow:0 5px 18px rgba(192,57,43,.45);transform:translateY(-1px);}
        .pp-hscroll{display:flex;gap:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:6px;}
        .pp-hscroll::-webkit-scrollbar{height:0;}
        .pp-hscroll-card{flex-shrink:0;width:130px;background:#fff;border:1px solid #f1f5f9;border-radius:14px;padding:14px 12px;display:flex;flex-direction:column;align-items:flex-start;gap:6px;cursor:pointer;position:relative;box-shadow:0 1px 3px rgba(0,0,0,.05);transition:box-shadow .15s,transform .15s;}
        .pp-hscroll-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.08);transform:translateY(-1px);}
        .pp-badge{position:absolute;top:10px;right:10px;background:#00C851;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;}
        .pp-hscroll-icon{color:#00C851;}
        .pp-hscroll-label{font-size:13px;font-weight:700;color:#0f172a;}
        .pp-hscroll-sub{font-size:11px;color:#94a3b8;}
        .pp-cta-pill-green{display:block;width:100%;padding:13px 28px;border-radius:50px;background:#00C851;color:#fff;border:none;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(0,200,81,.3);transition:transform .15s;font-family:'Sora',sans-serif;text-align:center;}
        .pp-cta-pill-green:hover{transform:translateY(-1px);}
        .pp-bottom-nav{position:fixed;bottom:0;left:0;right:0;z-index:50;background:#fff;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-around;padding:6px 8px 18px;box-shadow:0 -4px 20px rgba(0,0,0,.06);}
        .pp-nav-item{display:flex;flex-direction:column;align-items:center;gap:3px;background:transparent;border:none;cursor:pointer;color:#94a3b8;font-size:10px;font-weight:600;padding:4px 12px;border-radius:10px;transition:color .15s;font-family:'Sora',sans-serif;}
        .pp-nav-item.active{color:#00C851;}
        .pp-fab{width:54px;height:54px;border-radius:50%;background:#00C851;color:#fff;border:4px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,200,81,.45);cursor:pointer;margin-top:-22px;transition:transform .15s,box-shadow .15s;}
        .pp-fab:hover{transform:scale(1.08);box-shadow:0 6px 22px rgba(0,200,81,.55);}
        .pp-fab:active{transform:scale(.95);}
      `}</style>
    </div>
  );
}

// --- Inline styles -----------------------------------------------------------
const S = {
  overlay: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,.45)',
    zIndex: 300, display: 'flex', flexDirection: 'column' as const, justifyContent: 'flex-end',
  },
  sheet: {
    background: '#fff', borderRadius: '24px 24px 0 0',
    padding: '20px 18px 40px', maxHeight: '80vh',
    overflowY: 'auto' as const, position: 'relative' as const,
  },
  sheetHandle: { width: 40, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '0 auto 18px' },
  sheetTitle:  { fontSize: 17, fontWeight: 800, color: '#0f172a' },
  sheetClose: {
    width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b',
  },
  searchInput: {
    width: '100%', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: 50,
    fontSize: 14, fontFamily: "'Sora', sans-serif", color: '#0f172a',
    background: '#f8fafc', outline: 'none', marginBottom: 14,
  },
  searchRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9' },
  searchRowIcon: {
    width: 36, height: 36, borderRadius: 10, background: '#e8fdf0',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
  },
  notifRow: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9' },
  notifDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 5 },
  unreadPip: { width: 8, height: 8, borderRadius: '50%', background: '#00C851', flexShrink: 0, marginTop: 5 },
  notifBadge: {
    position: 'absolute' as const, top: -2, right: -2, width: 16, height: 16,
    borderRadius: '50%', background: '#FF3B5C', color: '#fff',
    fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1.5px solid #fff',
  },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0',
    borderBottom: '1px solid #f1f5f9', borderLeft: 'none', borderRight: 'none', borderTop: 'none',
    fontSize: 14, fontWeight: 600, color: '#0f172a', cursor: 'pointer', background: 'transparent',
    fontFamily: "'Sora', sans-serif", width: '100%', textAlign: 'left' as const,
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10, background: '#e8fdf0', color: '#00C851',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  eyePill: {
    width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.2)',
    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', cursor: 'pointer',
  },
  supportHero: {
    background: 'linear-gradient(145deg,#00C851,#005c28)', borderRadius: 18,
    padding: '24px 20px', position: 'relative' as const,
    overflow: 'hidden' as const, marginBottom: 4,
  },
  supportHeroBubble: {
    position: 'absolute' as const, width: 120, height: 120, borderRadius: '50%',
    background: 'rgba(255,255,255,.08)', top: -30, right: -20,
  },
  supportCard: {
    background: '#fff', border: '1px solid #f1f5f9', borderRadius: 16,
    padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 14,
    transition: 'box-shadow .15s, transform .15s', cursor: 'pointer',
  },
  supportCardIcon: {
    width: 48, height: 48, borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  faqItem: {
    background: '#fff', border: '1px solid #f1f5f9', borderRadius: 12,
    padding: '14px 16px', display: 'flex', alignItems: 'center',
    gap: 10, marginBottom: 8, cursor: 'pointer',
  },
  profileCard: {
    background: 'linear-gradient(145deg,#00C851,#005c28)',
    borderRadius: 18, padding: '20px', display: 'flex', alignItems: 'center', gap: 14,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 800, color: '#fff', flexShrink: 0,
  },
  lockedWrap: {
    position: 'relative' as const, borderRadius: 16,
    overflow: 'hidden' as const, cursor: 'pointer',
  },
  lockedBlur: {
    filter: 'blur(3px)', pointerEvents: 'none' as const,
    userSelect: 'none' as const, opacity: 0.5,
  },
  lockedOverlay: {
    position: 'absolute' as const, inset: 0, background: 'rgba(15,23,42,.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16,
  },
  lockedBadge: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'linear-gradient(135deg,#f59e0b,#b45309)',
    color: '#fff', fontSize: 13, fontWeight: 800,
    padding: '10px 20px', borderRadius: 50, boxShadow: '0 4px 16px rgba(0,0,0,.3)',
  },
} as const;

