// src/pages/ImportMessage.tsx
// v4 – Bug fixes: stale closure in visibleResults memo, progress counter lag,
//       campaign-id-0 bug, handleBulkParse hoisting, missing bulkParsed dep.
//       UX: cleaner filter panel, export buttons always visible in bulk mode,
//       error dismissal X is keyboard-accessible, offline badge in progress bar.

import { usePlanGate } from '../hooks/usePlanGate';
import { useUserPlan  } from '../hooks/useUserPlan';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  parseMpesa,
  parseMpesaBatch,
  inferCategoryAI,
  summarizeBatch,
  exportToCSV,
  exportToExcel,
  normalizeCode,
} from '../shared/mpesaParser';
import type { ParsedTransaction, TransactionType, BatchSummary } from '../shared/mpesaParser';
import {
  saveTransaction,
  saveTransactionWithSplits,
  getTransactionByCode,
  getExistingTransactionCodes,
} from '../features/transactions/transactionService';
import { getMemberByPhone } from '../features/members/memberService';
import { getActiveCampaigns, addContributionToCampaign } from '../features/campaigns/campaignService';
import { addToSyncQueue } from '../lib/syncQueue';
import { Capacitor } from '@capacitor/core';
import { useBusinesses } from '../hooks/useBusinesses';
import { useSmsMatcher, MatchResult } from '../hooks/useSmsMatcher';
import { AlertCircle, ArrowLeft, Banknote, Building2, CheckCircle2, ChevronDown, ChevronUp, Download, FileSpreadsheet, Filter, Layers, Loader2, Save, Search, Settings, Smartphone, Sparkles, Target, Trash2, TrendingDown, TrendingUp, User, UserPlus, X, Zap } from 'lucide-react';

import { notificationService } from '../services/notificationService';
import { PLAN_LIMITS          } from '../config/planLimits';
import { supabase } from '../lib/supabase';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Mode = 'single' | 'bulk';
type SmsPermission = 'unknown' | 'granted' | 'denied';

interface BulkResult {
  index:            number;
  transaction_code: string | null;
  amount:           number | null;
  name:             string | null;
  type:             TransactionType;
  category:         string;
  date:             string | null;
  status:           'pending' | 'saved' | 'duplicate' | 'error';
  error?:           string;
}

// ─── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:       '#060c18',
  surface:  '#0d1526',
  surface2: '#111d33',
  border:   'rgba(255,255,255,0.07)',
  border2:  'rgba(255,255,255,0.12)',
  text:     '#f1f5f9',
  muted:    '#64748b',
  sub:      '#94a3b8',
  primary:  '#10b981',
  blue:     '#3b82f6',
  red:      '#ef4444',
  amber:    '#f59e0b',
  purple:   '#a855f7',
} as const;

const TYPE_COLOR: Record<string, string> = {
  send_money:    C.blue,
  paybill:       '#06b6d4',
  till:          '#8b5cf6',
  received:      C.primary,
  withdrawal:    C.amber,
  reversal:      '#ec4899',
  airtime:       '#f97316',
  balance_check: C.muted,
  deposit:       C.primary,
  fuliza_draw:   C.red,
  fuliza_repay:  '#10b981',
  pochi:         '#06b6d4',
  loan:          '#a855f7',
  unknown:       C.muted,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('en-KE', { maximumFractionDigits: 2 });
}

function Detail({
  label, value, mono, capitalize,
}: {
  label: string; value: string; mono?: boolean; capitalize?: boolean;
}) {
  return (
    <div>
      <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </p>
      <p style={{
        margin: 0, fontSize: 13, fontWeight: 600, color: C.text,
        fontFamily: mono ? 'monospace' : 'inherit',
        textTransform: capitalize ? 'capitalize' : 'none',
        wordBreak: 'break-all',
      }}>
        {value}
      </p>
    </div>
  );
}

function StatCard({
  label, value, sub, color, icon,
}: {
  label: string; value: string; sub?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
      background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${color}18`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ margin: '3px 0 0', fontSize: 10, color: C.muted }}>{sub}</p>}
      </div>
    </div>
  );
}

function ProgressBar({ value, total, offline }: { value: number; total: number; offline?: boolean }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: C.sub }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {offline
            ? <span style={{ color: C.amber, fontWeight: 700 }}>⚡ Queued offline</span>
            : 'Saving transactions…'}
        </span>
        <span style={{ fontWeight: 700, color: C.text }}>{value} / {total} ({pct}%)</span>
      </div>
      <div style={{ height: 6, background: C.border2, borderRadius: 99, overflow: 'hidden' }}>
        <motion.div
          style={{
            height: '100%',
            background: offline
              ? `linear-gradient(90deg, ${C.amber}, ${C.red})`
              : `linear-gradient(90deg, ${C.primary}, ${C.blue})`,
            borderRadius: 99,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ ease: 'easeOut', duration: 0.3 }}
        />
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────
export default function ImportMessage() {
  const navigate = useNavigate();
  const { businesses, currentBusinessId, switchBusiness } = useBusinesses();
  const { matchTransaction } = useSmsMatcher();

  // ── Plan gating ────────────────────────────────────────────────────────
  const [_authUser, setAuthUser] = useState<string | undefined>(undefined);
  useEffect(() => {
    import('../lib/supabase').then(({ supabase }) =>
      supabase.auth.getUser().then(({ data }) => setAuthUser(data.user?.id))
    );
  }, []);
  const { plan }              = useUserPlan(_authUser);
  const { gate, check, closeGate } = usePlanGate(plan);
  // ────────────────────────────────────────────────────────────────────────

  // ── Mode ───────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('single');
  const [match, setMatch] = useState<MatchResult | null>(null);

  // ── Single mode ────────────────────────────────────────────────────────────
  const [text, setText]                         = useState('');
  const [parsed, setParsed]                     = useState<ParsedTransaction | null>(null);
  const [saving, setSaving]                     = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [success, setSuccess]                   = useState(false);
  const [duplicateTxn, setDuplicateTxn]         = useState<unknown>(null);
  const [matchedMember, setMatchedMember]       = useState<unknown>(null);
  const [campaigns, setCampaigns]               = useState<{ id: number; title: string }[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);

  // ── Splitting ──────────────────────────────────────────────────────────────
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splits, setSplits] = useState<{ type: string; amount: number; note: string }[]>([
    { type: 'contribution', amount: 0, note: '' }
  ]);

  const addSplit = () => setSplits([...splits, { type: 'fine', amount: 0, note: '' }]);
  const removeSplit = (i: number) => setSplits(splits.filter((_, idx) => idx !== i));
  const updateSplit = (i: number, field: string, val: any) => {
    const next = [...splits];
    (next[i] as any)[field] = field === 'amount' ? parseFloat(val) || 0 : val;
    setSplits(next);
  };

  const splitTotal = useMemo(() => splits.reduce((acc, curr) => acc + curr.amount, 0), [splits]);
  const isSplitValid = useMemo(() => parsed && Math.abs(splitTotal - (parsed.amount || 0)) < 0.01, [parsed, splitTotal]);

  // ── Bulk mode ──────────────────────────────────────────────────────────────
  const [bulkText, setBulkText]         = useState('');
  const [bulkResults, setBulkResults]   = useState<BulkResult[]>([]);
  const [bulkParsed, setBulkParsed]     = useState<ParsedTransaction[]>([]);
  const [bulkSaving, setBulkSaving]     = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkDone, setBulkDone]         = useState(false);
  const [bulkCampaignId, setBulkCampaignId] = useState<number | null>(null);
  const [aiCategorizing, setAiCategorizing] = useState(false);
  const [summary, setSummary]           = useState<BatchSummary | null>(null);
  const [showSummary, setShowSummary]   = useState(true);
  const [isOfflineSave, setIsOfflineSave] = useState(false);

  // ── Filters & search ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]         = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');
  const [filterDateFrom, setFilterDateFrom]   = useState('');
  const [filterDateTo, setFilterDateTo]       = useState('');
  const [filterTypes, setFilterTypes]         = useState<Set<TransactionType>>(new Set());
  const [showFilters, setShowFilters]         = useState(false);

  // ── Native SMS ─────────────────────────────────────────────────────────────
  const [isNative]                        = useState(Capacitor.isNativePlatform());
  const [syncing, setSyncing]             = useState(false);
  const [smsPermission, setSmsPermission] = useState<SmsPermission>('unknown');
  const [smsCount, setSmsCount]           = useState(0);

  useEffect(() => {
    getActiveCampaigns().then(d => setCampaigns(d || [])).catch(console.error);
  }, []);

  // ── Bulk parse (defined before handleNativeSync so it can be referenced) ──
  const handleBulkParse = useCallback((override?: string) => {
    if (!check('autoSMSParsing', { reason: 'Auto SMS parsing requires the Pro plan. Enter transactions manually or upgrade.' })) return;
    const input = override ?? bulkText;
    if (!input.trim()) { setError('Paste multiple M-Pesa SMS messages.'); return; }
    setError(null); setBulkDone(false); setBulkProgress(0); setSummary(null); setSearchQuery('');

    const results = parseMpesaBatch(input);
    setBulkParsed(results);
    setBulkResults(results.map((t, i) => ({
      index: i, transaction_code: t.transaction_code, amount: t.amount,
      name: t.name, type: t.type, category: t.category, date: t.date, status: 'pending',
    })));
    setSummary(summarizeBatch(results));
    setShowSummary(true);
  }, [bulkText]);

  // ── Native sync ────────────────────────────────────────────────────────────
  const handleNativeSync = useCallback(async (fetchAll = false) => {
    if (!isNative) { setError('Auto-sync only works in the Android APK.'); return; }
    setSyncing(true); setError(null);
    try {
      const SmsPlugin = (window as {
        SMS?: { listSMS: (o: unknown, ok: (m: { body: string }[]) => void, err: (e: unknown) => void) => void };
      }).SMS;
      if (!SmsPlugin?.listSMS) throw new Error('SMS plugin not available.');

      SmsPlugin.listSMS(
        { box: 'inbox', address: 'MPESA', indexFrom: 0, maxCount: fetchAll ? 200 : 30 },
        (messages) => {
          setSmsPermission('granted');
          if (!messages?.length) { setError('No M-Pesa SMS found.'); setSyncing(false); return; }
          setSmsCount(messages.length);

          if (fetchAll || messages.length > 1) {
            const joined = messages.map(m => m.body).join('\n\n');
            setBulkText(joined);
            setMode('bulk');
            handleBulkParse(joined);
          } else {
            setText(messages[0].body);
            setMode('single');
            void handleParse(messages[0].body);
          }
          setSyncing(false);
        },
        () => { setSmsPermission('denied'); setError('SMS permission denied.'); setSyncing(false); },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
      setSyncing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative, handleBulkParse]);

  // ── Single parse ───────────────────────────────────────────────────────────
  const handleParse = async (override?: string) => {
    const input = override ?? text;
    if (!input.trim()) { setError('Paste or sync an M-Pesa message first.'); return; }
    setError(null); setDuplicateTxn(null); setMatchedMember(null); setParsed(null);
    try {
      const result = parseMpesa(input);
      setParsed(result);

      // Auto-match
      const matchResult = await matchTransaction(result, currentBusinessId);
      setMatch(matchResult);

      if (result.transaction_code) {
        const existing = await getTransactionByCode(result.transaction_code);
        setDuplicateTxn(existing);
      }
      if (result.phone) {
        const member = await getMemberByPhone(result.phone);
        setMatchedMember(member);
      }
    } catch {
      setError('Could not parse this message. Make sure it is an M-Pesa confirmation SMS.');
    }
  };

  // ── Single save ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true); setError(null);
    const txnToSave = { ...parsed, business_id: currentBusinessId };

    try {
      if (!navigator.onLine) {
        addToSyncQueue(txnToSave, selectedCampaignId ?? undefined);
        setSuccess(true);
        setError('Offline: saved locally, will sync when connected.');
        setTimeout(
          () => navigate(selectedCampaignId != null ? `/campaigns/${selectedCampaignId}?tab=contributions` : '/transactions'),
          3000,
        );
        return;
      }

      if (showSplitModal && splits.length > 0) {
        await saveTransactionWithSplits(txnToSave, splits, currentBusinessId ?? undefined);
      } else {
        await saveTransaction(txnToSave, selectedCampaignId ?? undefined);
        if (selectedCampaignId != null && parsed.amount) {
          await addContributionToCampaign(
            selectedCampaignId,
            parsed.amount,
            parsed.name ?? (matchedMember as { name?: string } | null)?.name ?? 'Anonymous',
            parsed.phone ?? '',
            parsed.transaction_code ?? '',
          );
        }
      }

      // Check for budget alerts
      if (parsed.amount && parsed.category !== 'other') {
        const { data: budget } = await supabase
          .from('budgets')
          .select('amount')
          .eq('category', parsed.category)
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .maybeSingle();

        if (budget) {
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0,0,0,0);

          const { data: txns } = await supabase
            .from('transactions')
            .select('amount')
            .eq('category', parsed.category)
            .gte('txn_date', startOfMonth.toISOString().split('T')[0]);

          const totalSpent = (txns || []).reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0);
          const pct = Math.round((totalSpent / budget.amount) * 100);

          if (pct >= 80) {
            notificationService.sendBudgetAlert(parsed.category, pct, Math.max(0, budget.amount - totalSpent));
          }
        }
      }

      setSuccess(true);
      setShowSplitModal(false);
      setTimeout(
        () => navigate(selectedCampaignId != null ? `/campaigns/${selectedCampaignId}?tab=contributions` : '/transactions'),
        1200,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving transaction.');
    } finally {
      setSaving(false);
    }
  };

  // ── AI Categorize ──────────────────────────────────────────────────────────
  const handleAICategorize = async () => {
    if (!bulkParsed.length) return;
    setAiCategorizing(true);
    try {
      const recategorized = await inferCategoryAI(bulkParsed);
      setBulkParsed(recategorized);
      setBulkResults(prev => prev.map((r, i) => ({
        ...r,
        category: recategorized[i]?.category ?? r.category,
      })));
      setSummary(summarizeBatch(recategorized));
    } catch {
      setError('AI categorization failed. Keyword categories kept.');
    } finally {
      setAiCategorizing(false);
    }
  };

  // ── Bulk save ──────────────────────────────────────────────────────────────
  const handleBulkSave = async () => {
    if (!bulkParsed.length) return;
    if (!check('maxTransactionsImport', {
      currentCount: bulkParsed.length,
      reason: 'You have reached the import limit for your plan. Upgrade for unlimited imports.',
    })) return;
    setBulkSaving(true); setError(null); setBulkProgress(0); setIsOfflineSave(false);

    // 1. Batch duplicate check
    const allCodes   = bulkParsed.map(t => t.transaction_code).filter((c): c is string => c !== null);
    const existingRaw = await getExistingTransactionCodes(allCodes).catch(() => new Set<string>());
    const existingCodes = new Set([...existingRaw].map(normalizeCode));

    // Capture current filter state for this save run (avoids stale-closure issues)
    const currentVisible = new Set(computeVisibleIndices(bulkParsed, bulkResults, {
      filterMinAmount, filterMaxAmount, filterDateFrom, filterDateTo, filterTypes, searchQuery,
    }));

    const updated: BulkResult[] = bulkParsed.map((t, i) => ({
      index: i,
      transaction_code: t.transaction_code,
      amount: t.amount,
      name: t.name,
      type: t.type,
      category: t.category,
      date: t.date,
      // Fix: normalizeCode is now null-safe
      status: (t.transaction_code && existingCodes.has(normalizeCode(t.transaction_code)))
        ? 'duplicate'
        : 'pending',
    }));

    let saved = 0;
    const offline = !navigator.onLine;
    if (offline) setIsOfflineSave(true);

    for (let i = 0; i < bulkParsed.length; i++) {
      if (updated[i].status === 'duplicate') continue;
      if (!currentVisible.has(i)) continue;

      const t = { ...bulkParsed[i], business_id: currentBusinessId };
      try {
        if (offline) {
          addToSyncQueue(t, bulkCampaignId ?? undefined);
        } else {
          await saveTransaction(t, bulkCampaignId ?? undefined);
          if (bulkCampaignId != null && t.amount) {
            await addContributionToCampaign(
              bulkCampaignId, t.amount, t.name ?? 'Anonymous', t.phone ?? '', t.transaction_code ?? '',
            );
          }
        }
        updated[i] = { ...updated[i], status: 'saved' };
        // Fix: increment BEFORE setState so progress bar reflects the just-completed item
        saved++;
      } catch (err) {
        updated[i] = { ...updated[i], status: 'error', error: err instanceof Error ? err.message : 'Unknown' };
      }

      setBulkProgress(saved);
      setBulkResults([...updated]);
    }

    if (offline) setError('Offline: transactions queued and will sync when connected.');
    setBulkSaving(false);
    setBulkDone(true);
  };

  // ── Filter/search helpers ──────────────────────────────────────────────────

  /**
   * Pure function — extracted from render so useMemo can list it as a dep
   * without causing stale closures.
   */
  function computeVisibleIndices(
    parsed: ParsedTransaction[],
    results: BulkResult[],
    filters: {
      filterMinAmount: string;
      filterMaxAmount: string;
      filterDateFrom:  string;
      filterDateTo:    string;
      filterTypes:     Set<TransactionType>;
      searchQuery:     string;
    },
  ): number[] {
    const min = parseFloat(filters.filterMinAmount) || 0;
    const max = parseFloat(filters.filterMaxAmount) || Infinity;
    const q   = filters.searchQuery.trim().toLowerCase();

    return results
      .map((r, i) => {
        const t = parsed[i];
        if (!t) return -1;
        if (t.amount !== null && (t.amount < min || t.amount > max)) return -1;
        if (filters.filterDateFrom && t.date && t.date < filters.filterDateFrom) return -1;
        if (filters.filterDateTo   && t.date && t.date > filters.filterDateTo)   return -1;
        if (filters.filterTypes.size > 0 && !filters.filterTypes.has(t.type))    return -1;
        if (q) {
          const match =
            r.name?.toLowerCase().includes(q) ||
            r.transaction_code?.toLowerCase().includes(q) ||
            r.category?.toLowerCase().includes(q) ||
            r.type?.toLowerCase().includes(q);
          if (!match) return -1;
        }
        return i;
      })
      .filter((i): i is number => i >= 0);
  }

  // Plan-limit: cap how many parsed results are shown / saveable
  const { maxTransactionsView } = PLAN_LIMITS[plan];

  // Fix: bulkParsed added to dep array; filter state all included
  const visibleResults = useMemo(() => {
    const visibleSet = new Set(computeVisibleIndices(bulkParsed, bulkResults, {
      filterMinAmount, filterMaxAmount, filterDateFrom, filterDateTo, filterTypes, searchQuery,
    }));
    const all = bulkResults.filter((_, i) => visibleSet.has(i));
    if (maxTransactionsView !== -1 && all.length > maxTransactionsView) {
      return all.slice(0, maxTransactionsView);
    }
    return all;
  }, [bulkResults, bulkParsed, filterMinAmount, filterMaxAmount, filterDateFrom, filterDateTo, filterTypes, searchQuery, maxTransactionsView]);

  const activeFilterCount =
    (filterMinAmount ? 1 : 0) + (filterMaxAmount ? 1 : 0) +
    (filterDateFrom  ? 1 : 0) + (filterDateTo   ? 1 : 0) +
    (filterTypes.size > 0 ? 1 : 0);

  const uniqueParsedTypes = [...new Set(bulkParsed.map(t => t.type))];

  const toggleFilterType = (t: TransactionType) =>
    setFilterTypes(prev => {
      const n = new Set(prev);
      n.has(t) ? n.delete(t) : n.add(t);
      return n;
    });

  const clearFilters = () => {
    setFilterMinAmount(''); setFilterMaxAmount('');
    setFilterDateFrom('');  setFilterDateTo('');
    setFilterTypes(new Set()); setSearchQuery('');
  };

  const bulkSaved  = bulkResults.filter(r => r.status === 'saved').length;
  const bulkDupe   = bulkResults.filter(r => r.status === 'duplicate').length;
  const bulkErrors = bulkResults.filter(r => r.status === 'error').length;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.9s linear infinite; display: inline-flex; }
        textarea:focus, input:focus {
          outline: none !important;
          border-color: rgba(59,130,246,0.45) !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.08);
        }
        select option { background: #0d1526; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        * { box-sizing: border-box; }
        button:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(6,12,24,0.94)', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          maxWidth: 740, margin: '0 auto', padding: '0 16px',
          height: 54, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.muted, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <ArrowLeft size={14} />
          </button>
          <h1 style={{ fontSize: 15, fontWeight: 800, margin: 0, flex: 1, letterSpacing: '-0.02em' }}>
            Import M-Pesa
          </h1>

          {/* Mode toggle */}
          <div style={{
            display: 'flex', background: 'rgba(255,255,255,0.05)',
            borderRadius: 10, padding: 3, gap: 2,
          }}>
            {(['single', 'bulk'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                style={{
                  padding: '5px 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700,
                  background: mode === m ? C.primary : 'transparent',
                  color: mode === m ? '#022c22' : C.muted,
                  transition: 'all 0.15s', textTransform: 'capitalize',
                }}
              >
                {m === 'bulk' ? '⚡ Bulk' : 'Single'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 740, margin: '0 auto', padding: '18px 16px 100px' }}>

        {/* ── Native sync banner ── */}
        {isNative && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            style={{
              marginBottom: 16, padding: '12px 16px',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.07))',
              border: `1px solid rgba(16,185,129,0.18)`, borderRadius: 14,
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(16,185,129,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Smartphone size={18} color={C.primary} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Auto SMS Reading</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>
                {smsPermission === 'denied'
                  ? 'Permission denied – enable in Android Settings'
                  : smsCount > 0
                  ? `${smsCount} M-Pesa messages found`
                  : 'Reads directly from your inbox'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => void handleNativeSync(false)}
                disabled={syncing}
                style={{
                  padding: '7px 13px', background: C.primary, color: '#022c22',
                  border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12,
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {syncing ? <Loader2 size={12} className="spin" /> : <Zap size={12} />}
                {syncing ? 'Syncing…' : 'Latest'}
              </button>
              <button
                onClick={() => void handleNativeSync(true)}
                disabled={syncing}
                title="Last 200 messages"
                style={{
                  padding: '7px 11px',
                  background: 'rgba(59,130,246,0.12)', color: C.blue,
                  border: `1px solid rgba(59,130,246,0.2)`,
                  borderRadius: 9, fontWeight: 700, fontSize: 12,
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Layers size={12} /> All
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Error banner ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 14 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              style={{
                padding: '11px 14px',
                background: 'rgba(239,68,68,0.07)', border: `1px solid rgba(239,68,68,0.18)`,
                borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
                color: '#fca5a5', fontSize: 13, overflow: 'hidden',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{error}</span>
              <button
                onClick={() => setError(null)}
                aria-label="Dismiss error"
                style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 2, lineHeight: 0 }}
              >
                <X size={13} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ════════════════════════════════════════════ */}
        {/* SINGLE MODE                                  */}
        {/* ════════════════════════════════════════════ */}
        {(mode as string) === 'single' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 16, padding: 18, marginBottom: 14,
            }}>
              <label style={{
                fontSize: 10, fontWeight: 700, color: C.muted,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                display: 'block', marginBottom: 8,
              }}>
                M-Pesa Confirmation SMS
              </label>
              <textarea
                placeholder={
                  isNative
                    ? 'Tap "Latest" above to auto-fill, or paste manually…'
                    : 'Paste your M-Pesa SMS here…\n\ne.g. QA52HJKL12 Confirmed. Ksh500.00 sent to JOHN DOE…'
                }
                rows={5}
                value={text}
                onChange={e => { setText(e.target.value); setParsed(null); setError(null); setSuccess(false); }}
                style={{
                  width: '100%', padding: '12px 13px',
                  background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${C.border}`,
                  borderRadius: 11, color: C.text, fontSize: 13, lineHeight: 1.65,
                  resize: 'vertical', fontFamily: 'inherit',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
              />
              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <button
                  onClick={() => void handleParse()}
                  style={{
                    flex: 1, padding: '12px', background: C.text, color: '#060c18',
                    border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13,
                    cursor: 'pointer', letterSpacing: '-0.01em',
                  }}
                >
                  PARSE MESSAGE
                </button>
                <button
                  onClick={() => { setText(''); setParsed(null); setError(null); setDuplicateTxn(null); setSuccess(false); }}
                  title="Clear"
                  aria-label="Clear input"
                  style={{
                    padding: '12px 13px',
                    background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                    borderRadius: 10, color: C.muted, cursor: 'pointer',
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {parsed && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {success && (
                    <div style={{
                      padding: '13px 16px',
                      background: 'rgba(16,185,129,0.09)', border: `1px solid rgba(16,185,129,0.2)`,
                      borderRadius: 13, display: 'flex', alignItems: 'center', gap: 10,
                      marginBottom: 12, color: C.primary, fontWeight: 700, fontSize: 14,
                    }}>
                      <CheckCircle2 size={17} />
                      {selectedCampaignId != null ? 'Saved! Opening contributions…' : 'Saved! Redirecting…'}
                    </div>
                  )}
                  {duplicateTxn && (
                    <div style={{
                      padding: '11px 15px',
                      background: 'rgba(245,158,11,0.07)', border: `1px solid rgba(245,158,11,0.18)`,
                      borderRadius: 12, fontSize: 13, color: '#fcd34d',
                      marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center',
                    }}>
                      <AlertCircle size={14} /> This transaction is already saved.
                    </div>
                  )}

                  <div style={{
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${TYPE_COLOR[parsed.type] ?? C.primary}`,
                    borderRadius: 16, padding: 18,
                  }}>
                    {/* Header row */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'flex-start', marginBottom: 16, gap: 12,
                    }}>
                      <div>
                        <p style={{ margin: '0 0 6px', fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Parsed Transaction
                        </p>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                          background: `${TYPE_COLOR[parsed.type] ?? C.primary}18`,
                          color: TYPE_COLOR[parsed.type] ?? C.primary,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>
                          {parsed.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{
                          margin: 0, fontSize: 24, fontWeight: 900,
                          color: TYPE_COLOR[parsed.type] ?? C.primary,
                          lineHeight: 1, letterSpacing: '-0.02em',
                        }}>
                          KES {parsed.amount != null ? fmt(parsed.amount) : '—'}
                        </p>
                        {parsed.transaction_cost && (
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: C.muted }}>
                            Fee: KES {parsed.transaction_cost}
                          </p>
                        )}
                        {parsed.fuliza_fee && (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.red }}>
                            Fuliza fee: KES {parsed.fuliza_fee}
                          </p>
                        )}
                        {parsed.fuliza_total_due && (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.red }}>
                            Fuliza Due: KES {fmt(parsed.fuliza_total_due)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Detail grid */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr',
                      gap: '12px 20px', marginBottom: 18, fontSize: 13,
                    }}>
                      <Detail label="Name"     value={parsed.name ?? 'Unknown'} />
                      <Detail label="Phone"    value={parsed.phone ?? '—'} />
                      <Detail label="Ref Code" value={parsed.transaction_code ?? '—'} mono />
                      <Detail label="Category" value={parsed.category} capitalize />
                      {parsed.date    && <Detail label="Date"    value={`${parsed.date}${parsed.time ? ' · ' + parsed.time : ''}`} />}
                      {parsed.balance && <Detail label="Balance" value={`KES ${fmt(parsed.balance)}`} />}
                      {parsed.paybill && <Detail label="Paybill" value={parsed.paybill} mono />}
                      {parsed.account && <Detail label="Account" value={parsed.account} mono />}

                      {match?.member && (
                        <div style={{ gridColumn: '1 / -1', background: 'rgba(16,185,129,0.08)', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <CheckCircle2 size={16} color={C.primary} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>Matched: {match.member.name}</span>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 800, background: match.confidence === 100 ? C.primary : C.amber, color: '#000', padding: '2px 6px', borderRadius: 4 }}>
                              {match.confidence}% Confidence
                            </span>
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: C.muted }}>{match.reason}</p>
                        </div>
                      )}

                      {!match?.member && parsed.phone && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <button style={{ background: 'none', border: `1px dashed ${C.muted}`, borderRadius: 8, padding: '8px 12px', color: C.muted, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <UserPlus size={14} /> Add "{parsed.name || parsed.phone}" as Group Member
                          </button>
                        </div>
                      )}

                      {parsed.needs_review && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 6,
                            background: 'rgba(245,158,11,0.09)', color: C.amber,
                            border: `1px solid rgba(245,158,11,0.2)`,
                          }}>
                            ⚠ Needs Review — confidence {Math.round(parsed.confidence * 100)}%
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                      <button
                        style={{ flex: 1, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '10px', color: C.blue, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', cursor: 'pointer' }}
                        onClick={() => {
                          setSplits([{ type: 'contribution', amount: parsed.amount || 0, note: '' }]);
                          setShowSplitModal(true);
                        }}
                      >
                        <Layers size={14} /> Split Payment
                      </button>
                    </div>

                    {/* Business selector */}
                    {businesses.length > 0 && (mode as string) === 'single' && (
                      <div style={{ marginBottom: 16 }}>
                        <label style={{
                          fontSize: 10, fontWeight: 700, color: C.muted,
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7,
                        }}>
                          <Building2 size={10} /> Assign to Business
                        </label>
                        <select
                          value={currentBusinessId ?? ''}
                          onChange={e => {
                            const val = e.target.value;
                            switchBusiness(val === '' ? null : val);
                          }}
                          style={{
                            width: '100%', padding: '10px 13px',
                            background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                            borderRadius: 10, color: C.text, fontSize: 13,
                          }}
                        >
                          <option value="">Personal (No Business)</option>
                          {businesses.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Business selector */}
                {businesses.length > 0 && (mode as string) === 'bulk' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{
                      fontSize: 10, fontWeight: 700, color: C.muted,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7,
                    }}>
                      <Building2 size={10} /> Assign all to Business
                    </label>
                    <select
                      value={currentBusinessId ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        switchBusiness(val === '' ? null : val);
                      }}
                      style={{
                        width: '100%', padding: '10px 13px',
                        background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                        borderRadius: 10, color: C.text, fontSize: 13,
                      }}
                    >
                      <option value="">Personal (No Business)</option>
                      {businesses.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Campaign selector */}
                    {campaigns.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <label style={{
                          fontSize: 10, fontWeight: 700, color: C.muted,
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7,
                        }}>
                          <Target size={10} /> Link to Campaign (optional)
                        </label>
                        <select
                          // Fix: use null for "no campaign" instead of 0 to avoid id=0 bug
                          onChange={e => setSelectedCampaignId(e.target.value ? Number(e.target.value) : null)}
                          style={{
                            width: '100%', padding: '10px 13px',
                            background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                            borderRadius: 10, color: C.text, fontSize: 13,
                          }}
                        >
                          <option value="">No Campaign</option>
                          {campaigns.map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Save button */}
                    <button
                      onClick={() => void handleSave()}
                      disabled={saving || !!duplicateTxn || success}
                      style={{
                        width: '100%', padding: '13px', border: 'none', borderRadius: 11,
                        fontWeight: 900, fontSize: 14,
                        cursor: saving || !!duplicateTxn ? 'not-allowed' : 'pointer',
                        background: duplicateTxn
                          ? 'rgba(255,255,255,0.05)'
                          : success
                          ? 'rgba(16,185,129,0.15)'
                          : C.primary,
                        color: duplicateTxn ? C.muted : success ? C.primary : '#022c22',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        opacity: saving ? 0.75 : 1,
                        transition: 'all 0.2s', letterSpacing: '-0.01em',
                      }}
                    >
                      {saving
                        ? <><Loader2 size={15} className="spin" /> Saving…</>
                        : duplicateTxn
                        ? 'Already Saved'
                        : success
                        ? <><CheckCircle2 size={15} /> Saved!</>
                        : <><Save size={15} /> Confirm & Save</>}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════ */}
        {/* BULK MODE                                    */}
        {/* ════════════════════════════════════════════ */}
        {(mode as string) === 'bulk' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

            {/* Paste area */}
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 16, padding: 18, marginBottom: 14,
            }}>
              <label style={{
                fontSize: 10, fontWeight: 700, color: C.muted,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                display: 'block', marginBottom: 4,
              }}>
                Multiple M-Pesa SMS
              </label>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 0, marginBottom: 10 }}>
                Paste multiple messages — the parser splits on transaction codes, blank lines, or "Confirmed." boundaries.
              </p>
              <textarea
                placeholder={
                  'QA52HJKL12 Confirmed. Ksh500.00 sent to JOHN DOE…\n\nQB12XYZABC Confirmed. You have received Ksh2,000.00…'
                }
                rows={7}
                value={bulkText}
                onChange={e => {
                  setBulkText(e.target.value);
                  setBulkResults([]); setBulkDone(false); setSummary(null);
                }}
                style={{
                  width: '100%', padding: '12px 13px',
                  background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${C.border}`,
                  borderRadius: 11, color: C.text, fontSize: 13, lineHeight: 1.65,
                  resize: 'vertical', fontFamily: 'inherit',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
              />

              <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleBulkParse()}
                  style={{
                    flex: 1, minWidth: 140, padding: '12px',
                    background: C.text, color: '#060c18',
                    border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13,
                    cursor: 'pointer', letterSpacing: '-0.01em',
                  }}
                >
                  PARSE ALL
                </button>
                <button
                  onClick={handleAICategorize}
                  disabled={!bulkParsed.length || aiCategorizing}
                  title="Re-categorize using AI"
                  style={{
                    padding: '12px 14px',
                    background: aiCategorizing ? 'rgba(168,85,247,0.06)' : 'rgba(168,85,247,0.12)',
                    border: `1px solid rgba(168,85,247,0.22)`, borderRadius: 10,
                    color: C.purple, fontWeight: 700, fontSize: 12,
                    cursor: !bulkParsed.length || aiCategorizing ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {aiCategorizing
                    ? <><Loader2 size={13} className="spin" /> Categorizing…</>
                    : <><Sparkles size={13} /> AI Categorize</>}
                </button>
                {/* Export buttons — shown as soon as we have parsed results */}
                {bulkParsed.length > 0 && (
                  <>
                    <button
                      onClick={() => exportToCSV(bulkParsed)}
                      title="Download CSV"
                      style={{
                        padding: '12px 13px',
                        background: 'rgba(16,185,129,0.08)', border: `1px solid rgba(16,185,129,0.18)`,
                        borderRadius: 10, color: C.primary, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                      }}
                    >
                      <Download size={13} /> CSV
                    </button>
                    <button
                      onClick={() => exportToExcel(bulkParsed)}
                      title="Download Excel"
                      style={{
                        padding: '12px 13px',
                        background: 'rgba(59,130,246,0.08)', border: `1px solid rgba(59,130,246,0.18)`,
                        borderRadius: 10, color: C.blue, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                      }}
                    >
                      <FileSpreadsheet size={13} /> XLS
                    </button>
                  </>
                )}
                <button
                  onClick={() => { setBulkText(''); setBulkResults([]); setBulkDone(false); setSummary(null); }}
                  title="Clear all"
                  aria-label="Clear bulk input"
                  style={{
                    padding: '12px 13px',
                    background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                    borderRadius: 10, color: C.muted, cursor: 'pointer',
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Summary panel */}
            {summary && (
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 16, marginBottom: 14, overflow: 'hidden',
              }}>
                <button
                  onClick={() => setShowSummary(v => !v)}
                  style={{
                    width: '100%', padding: '13px 18px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    color: C.text,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Batch Summary — {summary.total} transactions
                  </span>
                  {showSummary ? <ChevronUp size={14} color={C.muted} /> : <ChevronDown size={14} color={C.muted} />}
                </button>

                <AnimatePresence>
                  {showSummary && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ padding: '0 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        <StatCard
                          label="Money In" value={`KES ${fmt(summary.totalIn)}`}
                          color={C.primary} icon={<TrendingUp size={16} color={C.primary} />}
                        />
                        <StatCard
                          label="Money Out" value={`KES ${fmt(summary.totalOut)}`}
                          color={C.red} icon={<TrendingDown size={16} color={C.red} />}
                        />
                        <StatCard
                          label="Fees" value={`KES ${fmt(summary.totalFees)}`}
                          color={C.amber} icon={<Banknote size={16} color={C.amber} />}
                        />
                        {summary.totalFuliza > 0 && (
                          <StatCard
                            label="Fuliza Used" value={`KES ${fmt(summary.totalFuliza)}`}
                            color={C.red} icon={<AlertCircle size={16} color={C.red} />}
                          />
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Filters */}
            {bulkParsed.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                {/* Search + filter toggle row */}
                <div style={{ display: 'flex', gap: 10, marginBottom: showFilters ? 10 : 0 }}>
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 10, padding: '8px 12px',
                  }}>
                    <Search size={13} color={C.muted} />
                    <input
                      placeholder="Search name, code, category…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{
                        background: 'none', border: 'none', color: C.text,
                        fontSize: 13, flex: 1, fontFamily: 'inherit',
                      }}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                        style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0, lineHeight: 0 }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFilters(v => !v)}
                    style={{
                      padding: '8px 14px',
                      background: activeFilterCount > 0 ? `rgba(59,130,246,0.12)` : C.surface,
                      border: `1px solid ${activeFilterCount > 0 ? 'rgba(59,130,246,0.3)' : C.border}`,
                      borderRadius: 10, color: activeFilterCount > 0 ? C.blue : C.muted,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 700,
                    }}
                  >
                    <Filter size={13} />
                    {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filter'}
                  </button>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.18)`,
                        borderRadius: 10, color: C.red, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      style={{
                        overflow: 'hidden', background: C.surface,
                        border: `1px solid ${C.border}`, borderRadius: 12, padding: 14,
                      }}
                    >
                      {/* Amount range */}
                      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Min Amount
                          </label>
                          <input
                            type="number" placeholder="0"
                            value={filterMinAmount}
                            onChange={e => setFilterMinAmount(e.target.value)}
                            style={{
                              width: '100%', padding: '8px 11px',
                              background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                              borderRadius: 8, color: C.text, fontSize: 13, fontFamily: 'inherit',
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Max Amount
                          </label>
                          <input
                            type="number" placeholder="∞"
                            value={filterMaxAmount}
                            onChange={e => setFilterMaxAmount(e.target.value)}
                            style={{
                              width: '100%', padding: '8px 11px',
                              background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                              borderRadius: 8, color: C.text, fontSize: 13, fontFamily: 'inherit',
                            }}
                          />
                        </div>
                      </div>

                      {/* Date range */}
                      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            From Date
                          </label>
                          <input
                            type="date"
                            value={filterDateFrom}
                            onChange={e => setFilterDateFrom(e.target.value)}
                            style={{
                              width: '100%', padding: '8px 11px',
                              background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                              borderRadius: 8, color: C.text, fontSize: 13, fontFamily: 'inherit',
                              colorScheme: 'dark',
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            To Date
                          </label>
                          <input
                            type="date"
                            value={filterDateTo}
                            onChange={e => setFilterDateTo(e.target.value)}
                            style={{
                              width: '100%', padding: '8px 11px',
                              background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                              borderRadius: 8, color: C.text, fontSize: 13, fontFamily: 'inherit',
                              colorScheme: 'dark',
                            }}
                          />
                        </div>
                      </div>

                      {/* Type chips */}
                      <div>
                        <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Transaction Type
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {uniqueParsedTypes.map(t => (
                            <button
                              key={t}
                              onClick={() => toggleFilterType(t)}
                              style={{
                                padding: '4px 11px', borderRadius: 20, border: 'none',
                                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                                background: filterTypes.has(t)
                                  ? `${TYPE_COLOR[t] ?? C.primary}25`
                                  : 'rgba(255,255,255,0.05)',
                                color: filterTypes.has(t)
                                  ? TYPE_COLOR[t] ?? C.primary
                                  : C.muted,
                                outline: filterTypes.has(t)
                                  ? `1px solid ${TYPE_COLOR[t] ?? C.primary}40`
                                  : '1px solid transparent',
                              }}
                            >
                              {t.replace(/_/g, ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Progress / save controls */}
            {bulkParsed.length > 0 && (
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: 18, marginBottom: 14,
              }}>
                {bulkSaving && (
                  <ProgressBar value={bulkProgress} total={visibleResults.length} offline={isOfflineSave} />
                )}

                {bulkDone && (
                  <div style={{
                    marginBottom: 12, padding: '10px 14px',
                    background: 'rgba(16,185,129,0.07)', border: `1px solid rgba(16,185,129,0.18)`,
                    borderRadius: 10, fontSize: 13, color: C.primary,
                    display: 'flex', gap: 12, flexWrap: 'wrap',
                  }}>
                    <span><CheckCircle2 size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />{bulkSaved} saved</span>
                    {bulkDupe   > 0 && <span style={{ color: C.amber }}>⊘ {bulkDupe} duplicates skipped</span>}
                    {bulkErrors > 0 && <span style={{ color: C.red }}>✕ {bulkErrors} errors</span>}
                  </div>
                )}

                {/* Business selector */}
                {businesses.length > 0 && (mode as string) === 'bulk' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{
                      fontSize: 10, fontWeight: 700, color: C.muted,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7,
                    }}>
                      <Building2 size={10} /> Assign all to Business
                    </label>
                    <select
                      value={currentBusinessId ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        switchBusiness(val === '' ? null : val);
                      }}
                      style={{
                        width: '100%', padding: '10px 13px',
                        background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                        borderRadius: 10, color: C.text, fontSize: 13,
                      }}
                    >
                      <option value="">Personal (No Business)</option>
                      {businesses.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Campaign selector */}
                {campaigns.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{
                      fontSize: 10, fontWeight: 700, color: C.muted,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7,
                    }}>
                      <Target size={10} /> Link all to Campaign (optional)
                    </label>
                    <select
                      onChange={e => setBulkCampaignId(e.target.value ? Number(e.target.value) : null)}
                      style={{
                        width: '100%', padding: '10px 13px',
                        background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                        borderRadius: 10, color: C.text, fontSize: 13,
                      }}
                    >
                      <option value="">No Campaign</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    onClick={() => void handleBulkSave()}
                    disabled={bulkSaving || !visibleResults.filter(r => r.status === 'pending').length}
                    style={{
                      flex: 1, padding: '13px',
                      background: bulkDone ? 'rgba(16,185,129,0.12)' : C.primary,
                      color: bulkDone ? C.primary : '#022c22',
                      border: 'none', borderRadius: 11, fontWeight: 900, fontSize: 14,
                      cursor: bulkSaving ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: bulkSaving ? 0.75 : 1, transition: 'all 0.2s',
                    }}
                  >
                    {bulkSaving
                      ? <><Loader2 size={15} className="spin" /> Saving {bulkProgress} / {visibleResults.length}…</>
                      : bulkDone
                      ? <><CheckCircle2 size={15} /> All Done</>
                      : <><Save size={15} /> Save {visibleResults.filter(r => r.status === 'pending').length} Transactions</>}
                  </button>
                </div>

                <p style={{ margin: '10px 0 0', fontSize: 11, color: C.muted, textAlign: 'center' }}>
                  {visibleResults.length} shown · {bulkParsed.length} total parsed
                  {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`}
                </p>
              </div>
            )}

            {/* Transaction list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleResults.map((r) => {
                const color = TYPE_COLOR[r.type] ?? C.primary;
                const statusColor =
                  r.status === 'saved'     ? C.primary :
                  r.status === 'duplicate' ? C.amber :
                  r.status === 'error'     ? C.red : C.muted;

                return (
                  <motion.div
                    key={r.index}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      background: C.surface2, borderRadius: 12,
                      border: `1px solid ${C.border}`,
                      borderLeft: `3px solid ${color}`,
                      padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                          background: `${color}18`, color,
                        }}>
                          {r.type.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>
                          {r.transaction_code ?? '—'}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.name ?? 'Unknown'}{r.amount != null ? ` · KES ${fmt(r.amount)}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {r.category} {r.date ? `· ${r.date}` : ''}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                        background: `${statusColor}18`, color: statusColor,
                        border: `1px solid ${statusColor}30`,
                        textTransform: 'capitalize',
                      }}>
                        {r.status}
                      </span>
                      {r.error && (
                        <p style={{ margin: '4px 0 0', fontSize: 10, color: C.red, maxWidth: 120, wordBreak: 'break-word' }}>
                          {r.error}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {bulkParsed.length > 0 && visibleResults.length === 0 && (
                <div style={{
                  padding: '32px 20px', textAlign: 'center',
                  color: C.muted, fontSize: 13, background: C.surface2,
                  borderRadius: 12, border: `1px solid ${C.border}`,
                }}>
                  No transactions match your current filters.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {showSplitModal && parsed && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Split Payment</h3>
              <button onClick={() => setShowSplitModal(false)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}><X size={20}/></button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12, marginBottom: 20, border: `1px solid ${C.border}` }}>
              <p style={{ margin: 0, fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total to Allocate</p>
              <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 900, color: C.primary }}>KES {fmt(parsed.amount || 0)}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              {splits.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <select
                      value={s.type}
                      onChange={e => updateSplit(i, 'type', e.target.value)}
                      style={{ width: '100%', padding: '10px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, marginBottom: 8 }}
                    >
                      <option value="contribution">Contribution</option>
                      <option value="fine">Fine / Penalty</option>
                      <option value="loan_repayment">Loan Repayment</option>
                      <option value="social_fund">Social Fund</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Amount"
                      value={s.amount || ''}
                      onChange={e => updateSplit(i, 'amount', e.target.value)}
                      style={{ width: '100%', padding: '10px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13 }}
                    />
                  </div>
                  {splits.length > 1 && (
                    <button onClick={() => removeSplit(i)} style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 10, color: C.red, cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button onClick={addSplit} style={{ width: '100%', padding: '10px', background: 'transparent', border: `1px dashed ${C.muted}`, borderRadius: 10, color: C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 24 }}>
              + Add Another Bucket
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: C.muted }}>Allocated: KES {fmt(splitTotal)}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: Math.abs(splitTotal - (parsed.amount || 0)) < 0.01 ? C.primary : C.red }}>
                  {Math.abs(splitTotal - (parsed.amount || 0)) < 0.01 ? '✓ Perfectly balanced' : `Remaining: KES ${fmt((parsed.amount || 0) - splitTotal)}`}
                </p>
              </div>
            </div>

            <button
              disabled={!isSplitValid || saving}
              onClick={handleSave}
              className="pp-cta-pill-green"
              style={{ width: '100%', opacity: isSplitValid ? 1 : 0.5 }}
            >
              {saving ? 'Saving...' : 'Confirm & Save Splits'}
            </button>
          </div>
        </div>
      )}
    </div>

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
            background: '#0d1526', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20, padding: 28, maxWidth: 380, width: '100%',
          }}
          onClick={e => e.stopPropagation()}
        >
          <p style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: '#f1f5f9' }}>
            {gate.requiredPlan === 'premium' ? '✨ Premium Feature' : '⚡ Pro Feature'}
          </p>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
            {gate.reason}
          </p>
          {gate.limitCount != null && (
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#f59e0b' }}>
              {gate.currentCount} / {gate.limitCount} used
            </p>
          )}
          <button
            onClick={closeGate}
            style={{
              width: '100%', padding: '12px', borderRadius: 11, border: 'none',
              background: gate.requiredPlan === 'premium' ? '#a855f7' : '#10b981',
              color: gate.requiredPlan === 'premium' ? '#fff' : '#022c22',
              fontWeight: 800, fontSize: 14, cursor: 'pointer',
            }}
          >
            Upgrade to {gate.requiredPlan === 'premium' ? 'Premium' : 'Pro'}
          </button>
        </div>
      </div>
    )}
    </>
  );
}