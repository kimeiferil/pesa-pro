// src/pages/ImportMessage.tsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { parseMpesa, parseMpesaBatch, extractAllTxnIds } from '../shared/mpesaParser';
import type { ParsedTransaction, TransactionType } from '../shared/mpesaParser';
import {
  saveTransaction,
  getTransactionByCode,
  getExistingTransactionCodes,
} from '../features/transactions/transactionService';
import { getMemberByPhone } from '../features/members/memberService';
import { getActiveCampaigns, addContributionToCampaign } from '../features/campaigns/campaignService';
import {
  ArrowLeft, AlertCircle, RefreshCw, Target, Smartphone,
  Loader2, CheckCircle2, Layers, Zap, Copy, Trash2, Save, Filter,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { addToSyncQueue } from '../lib/syncQueue';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type Mode = 'single' | 'bulk';
type SmsPermission = 'unknown' | 'granted' | 'denied';

interface BulkResult {
  index:            number;
  transaction_code: string | null;
  amount:           number | null;
  name:             string | null;
  status:           'pending' | 'saved' | 'duplicate' | 'error';
  error?:           string;
}

// â”€â”€â”€ Design tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const C = {
  bg:      '#080d1a',
  surface: '#0f1729',
  border:  'rgba(255,255,255,0.06)',
  text:    '#f8fafc',
  muted:   '#64748b',
  sub:     '#94a3b8',
  primary: '#10b981',
  blue:    '#3b82f6',
  red:     '#ef4444',
  amber:   '#f59e0b',
};

export default function ImportMessage() {
  const navigate = useNavigate();

  // â”€â”€ Mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [mode, setMode] = useState<Mode>('single');

  // â”€â”€ Single mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [text, setText]                           = useState('');
  const [parsed, setParsed]                       = useState<ParsedTransaction | null>(null);
  const [saving, setSaving]                       = useState(false);
  const [error, setError]                         = useState<string | null>(null);
  const [success, setSuccess]                     = useState(false);
  const [duplicateTransaction, setDuplicateTxn]   = useState<unknown>(null);
  const [matchedMember, setMatchedMember]         = useState<unknown>(null);
  const [campaigns, setCampaigns]                 = useState<{ id: number; title: string }[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);

  // â”€â”€ Bulk mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [bulkText, setBulkText]       = useState('');
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkParsed, setBulkParsed]   = useState<ParsedTransaction[]>([]);
  const [bulkSaving, setBulkSaving]   = useState(false);
  const [bulkDone, setBulkDone]       = useState(false);
  const [bulkCampaignId, setBulkCampaignId] = useState<number | null>(null);
  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterMinAmount, setFilterMinAmount] = useState<string>('');
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>('');
  const [filterDateFrom,  setFilterDateFrom]  = useState<string>('');
  const [filterDateTo,    setFilterDateTo]    = useState<string>('');
  const [filterTypes,     setFilterTypes]     = useState<Set<TransactionType>>(new Set());

  // â”€â”€ Native SMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [isNative]                    = useState(Capacitor.isNativePlatform());
  const [syncing, setSyncing]         = useState(false);
  const [smsPermission, setSmsPermission] = useState<SmsPermission>('unknown');
  const [smsCount, setSmsCount]       = useState(0);

  useEffect(() => {
    getActiveCampaigns()
      .then(d => setCampaigns(d || []))
      .catch(console.error);
  }, []);

  // â”€â”€ Native SMS sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleNativeSync = useCallback(async (fetchAll = false) => {
    if (!isNative) { setError('Auto-sync only works in the Android APK.'); return; }
    setSyncing(true);
    setError(null);

    try {
      const SmsPlugin = (window as { SMS?: { listSMS: (opts: unknown, ok: (msgs: { body: string }[]) => void, err: (e: unknown) => void) => void } }).SMS;
      if (!SmsPlugin?.listSMS) throw new Error('SMS plugin not available. Make sure you are using the Pesa Pro APK.');

      SmsPlugin.listSMS(
        { box: 'inbox', address: 'MPESA', indexFrom: 0, maxCount: fetchAll ? 200 : 30 },
        (messages) => {
          setSmsPermission('granted');
          if (!messages?.length) {
            setError('No M-Pesa SMS found in your inbox.');
            setSyncing(false);
            return;
          }
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
        () => {
          setSmsPermission('denied');
          setError('SMS permission denied. Please allow in Android Settings → Apps → Pesa Pro → Permissions.');
          setSyncing(false);
        }
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
      setSyncing(false);
    }
  }, [isNative]);

  // â”€â”€ Single parse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleParse = async (overrideText?: string) => {
    const input = overrideText ?? text;
    if (!input.trim()) { setError('Paste or sync an M-Pesa message first.'); return; }

    setError(null);
    setDuplicateTxn(null);
    setMatchedMember(null);
    setParsed(null);

    try {
      const result = parseMpesa(input);
      setParsed(result);

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

  // â”€â”€ Single save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true);
    setError(null);
    try {
      if (!navigator.onLine) {
        addToSyncQueue(parsed, selectedCampaignId ?? undefined);
        setSuccess(true);
        setError("Working offline: Transaction saved locally and will sync when internet returns.");
        setTimeout(() => {
          navigate(selectedCampaignId ? `/campaigns/${selectedCampaignId}?tab=contributions` : '/transactions');
        }, 3000);
        return;
      }

      await saveTransaction(parsed, selectedCampaignId ?? undefined);
      if (selectedCampaignId && parsed.amount) {
        await addContributionToCampaign(
          selectedCampaignId,
          parsed.amount,
          parsed.name ?? (matchedMember as { name?: string } | null)?.name ?? 'Anonymous',
          parsed.phone ?? '',
          parsed.transaction_code ?? '',
        );
      }
      setSuccess(true);
      setTimeout(() => {
        navigate(selectedCampaignId ? `/campaigns/${selectedCampaignId}?tab=contributions` : '/transactions');
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving transaction.');
    } finally {
      setSaving(false);
    }
  };

  // â”€â”€ Bulk parse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleBulkParse = (overrideText?: string) => {
    const input = overrideText ?? bulkText;
    if (!input.trim()) { setError('Paste multiple M-Pesa SMS messages.'); return; }
    setError(null);
    setBulkDone(false);

    const results = parseMpesaBatch(input);
    setBulkParsed(results);
    setBulkResults(results.map((t, i) => ({
      index:            i,
      transaction_code: t.transaction_code,
      amount:           t.amount,
      name:             t.name,
      status:           'pending',
    })));
  };

  // â”€â”€ Bulk save â€” batch duplicate check upfront â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleBulkSave = async () => {
    if (!bulkParsed.length) return;
    setBulkSaving(true);
    setError(null);

    // 1. Collect all codes and check DB in a single query
    const allCodes = bulkParsed
      .map(t => t.transaction_code)
      .filter((c): c is string => c !== null);
    const existingCodes = await getExistingTransactionCodes(allCodes).catch(() => new Set<string>());

    const updated: BulkResult[] = bulkParsed.map((t, i) => ({
      index:            i,
      transaction_code: t.transaction_code,
      amount:           t.amount,
      name:             t.name,
      status:           (t.transaction_code && existingCodes.has(t.transaction_code))
                          ? 'duplicate'
                          : 'pending',
    }));

    // 2. Save only non-duplicates that pass active filters
    const visibleIndices = new Set(
      bulkParsed
        .map((t, i) => {
          const min = parseFloat(filterMinAmount) || 0;
          const max = parseFloat(filterMaxAmount) || Infinity;
          if (t.amount !== null && (t.amount < min || t.amount > max)) return -1;
          if (filterDateFrom && t.date && t.date < filterDateFrom) return -1;
          if (filterDateTo   && t.date && t.date > filterDateTo)   return -1;
          if (filterTypes.size > 0 && !filterTypes.has(t.type))    return -1;
          return i;
        })
        .filter(i => i >= 0)
    );

    if (!navigator.onLine) {
      for (let i = 0; i < bulkParsed.length; i++) {
        if (updated[i].status === 'duplicate') continue;
        if (!visibleIndices.has(i)) continue;
        const t = bulkParsed[i];
        addToSyncQueue(t, bulkCampaignId ?? undefined);
        updated[i] = { ...updated[i], status: 'saved' };
        setBulkResults([...updated]);
      }
      setError("Working offline: Transactions saved locally and will sync when internet returns.");
      setBulkSaving(false);
      setBulkDone(true);
      return;
    }

    // (original loop below)
    for (let i = 0; i < bulkParsed.length; i++) {
      if (updated[i].status === 'duplicate') continue;
      if (!visibleIndices.has(i)) continue;
      const t = bulkParsed[i];
      try {
        await saveTransaction(t, bulkCampaignId ?? undefined);
        if (bulkCampaignId && t.amount) {
          await addContributionToCampaign(
            bulkCampaignId,
            t.amount,
            t.name ?? 'Anonymous',
            t.phone ?? '',
            t.transaction_code ?? '',
          );
        }
        updated[i] = { ...updated[i], status: 'saved' };
      } catch (err: unknown) {
        updated[i] = { ...updated[i], status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
      }
      setBulkResults([...updated]);
    }

    setBulkSaving(false);
    setBulkDone(true);
  };

  const bulkSaved  = bulkResults.filter(r => r.status === 'saved').length;
  const bulkDupe   = bulkResults.filter(r => r.status === 'duplicate').length;
  const bulkErrors = bulkResults.filter(r => r.status === 'error').length;
  // ── Derived filter helpers ─────────────────────────────────────────────────
  const visibleResults = bulkResults.filter(r => {
    const parsed = bulkParsed[r.index];
    if (!parsed) return true;
    const min = parseFloat(filterMinAmount) || 0;
    const max = parseFloat(filterMaxAmount) || Infinity;
    if (parsed.amount !== null && (parsed.amount < min || parsed.amount > max)) return false;
    if (filterDateFrom && parsed.date && parsed.date < filterDateFrom) return false;
    if (filterDateTo   && parsed.date && parsed.date > filterDateTo)   return false;
    if (filterTypes.size > 0 && !filterTypes.has(parsed.type)) return false;
    return true;
  });

  const activeFilterCount =
    (filterMinAmount ? 1 : 0) +
    (filterMaxAmount ? 1 : 0) +
    (filterDateFrom  ? 1 : 0) +
    (filterDateTo    ? 1 : 0) +
    (filterTypes.size > 0 ? 1 : 0);

  const uniqueParsedTypes = [...new Set(bulkParsed.map(t => t.type))];

  const toggleFilterType = (t: TransactionType) => {
    setFilterTypes(prev => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  const clearFilters = () => {
    setFilterMinAmount('');
    setFilterMaxAmount('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterTypes(new Set());
  };

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.9s linear infinite; }
        textarea:focus { outline: none; border-color: rgba(59,130,246,0.5) !important; }
        select option { background: #0f1729; }
      `}</style>

      {/* â”€â”€ Header â”€â”€ */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(8,13,26,0.92)', backdropFilter: 'blur(18px)', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeft size={15} />
          </button>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, flex: 1 }}>Import M-Pesa</h1>

          {/* Mode toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, gap: 2 }}>
            {(['single', 'bulk'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                style={{
                  padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700,
                  background: mode === m ? C.primary : 'transparent',
                  color: mode === m ? '#022c22' : C.muted,
                  transition: 'all 0.15s', textTransform: 'capitalize',
                }}
              >
                {m === 'bulk' ? 'âš¡ Bulk' : 'Single'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 80px' }}>

        {/* â”€â”€ Native sync banner â”€â”€ */}
        {isNative && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: 20, padding: '14px 18px', background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(59,130,246,0.08))', border: `1px solid rgba(16,185,129,0.2)`, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Smartphone size={20} color={C.primary} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>Auto SMS Reading</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>
                {smsPermission === 'denied'
                  ? 'Permission denied â€” enable in Android Settings'
                  : smsCount > 0
                  ? `${smsCount} M-Pesa messages found`
                  : 'Reads directly from your inbox'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => void handleNativeSync(false)}
                disabled={syncing}
                style={{ padding: '8px 14px', background: C.primary, color: '#022c22', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {syncing ? <Loader2 size={13} className="spin" /> : <Zap size={13} />}
                {syncing ? 'Syncingâ€¦' : 'Latest'}
              </button>
              <button
                onClick={() => void handleNativeSync(true)}
                disabled={syncing}
                title="Import last 200 messages"
                style={{ padding: '8px 12px', background: 'rgba(59,130,246,0.15)', color: C.blue, border: `1px solid rgba(59,130,246,0.2)`, borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Layers size={13} />
                All
              </button>
            </div>
          </motion.div>
        )}

        {/* â”€â”€ Error banner â”€â”€ */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, color: '#fca5a5', fontSize: 13 }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{error}</span>
              <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}><RefreshCw size={13} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* SINGLE MODE                                                        */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {mode === 'single' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 10 }}>
                M-Pesa Confirmation SMS
              </label>
              <textarea
                placeholder={isNative ? 'Tap "Latest" above to auto-fill, or paste manuallyâ€¦' : 'Paste your M-Pesa SMS hereâ€¦\n\ne.g. QA52HJKL12 Confirmed. Ksh500.00 sent to JOHN DOEâ€¦'}
                rows={5}
                value={text}
                onChange={e => { setText(e.target.value); setParsed(null); setError(null); }}
                style={{ width: '100%', padding: '12px 14px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 13, lineHeight: 1.65, resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                <button
                  onClick={() => void handleParse()}
                  style={{ flex: 1, padding: '13px', background: C.text, color: '#0a0f1e', border: 'none', borderRadius: 11, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                >
                  PARSE MESSAGE
                </button>
                <button
                  onClick={() => { setText(''); setParsed(null); setError(null); setDuplicateTxn(null); }}
                  title="Clear"
                  style={{ padding: '13px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 11, color: C.muted, cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {parsed && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {success && (
                    <div style={{ padding: '14px', background: 'rgba(16,185,129,0.1)', border: `1px solid rgba(16,185,129,0.2)`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: C.primary, fontWeight: 700 }}>
                      <CheckCircle2 size={18} />
                      {selectedCampaignId ? 'Saved! Opening contributionsâ€¦' : 'Saved! Redirectingâ€¦'}
                    </div>
                  )}

                  {duplicateTransaction && (
                    <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: `1px solid rgba(245,158,11,0.2)`, borderRadius: 12, fontSize: 13, color: '#fcd34d', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <AlertCircle size={15} /> This transaction is already saved.
                    </div>
                  )}

                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.primary}`, borderRadius: 18, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                      <div>
                        <p style={{ margin: '0 0 4px', fontSize: 12, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parsed Transaction</p>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', color: C.primary, textTransform: 'uppercase' }}>
                          {parsed.type}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.primary }}>
                          KES {parsed.amount?.toLocaleString() ?? 'â€”'}
                        </p>
                        {parsed.transaction_cost && (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>Fee: KES {parsed.transaction_cost}</p>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 20, fontSize: 13 }}>
                      <Detail label="Name"           value={parsed.name ?? 'Unknown'}               />
                      <Detail label="Phone"          value={parsed.phone ?? 'â€”'}                    />
                      <Detail label="Ref Code"       value={parsed.transaction_code ?? 'â€”'} mono    />
                      <Detail label="Category"       value={parsed.category}             capitalize />
                      {parsed.date    && <Detail label="Date"    value={`${parsed.date}${parsed.time ? ' ' + parsed.time : ''}`} />}
                      {parsed.balance && <Detail label="Balance" value={`KES ${parsed.balance.toLocaleString()}`}                />}
                      {parsed.needs_review && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: C.amber }}>
                            âš  Needs Review â€” confidence {Math.round(parsed.confidence * 100)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {campaigns.length > 0 && (
                      <div style={{ marginBottom: 18 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <Target size={11} /> Link to Campaign (optional)
                        </label>
                        <select
                          onChange={e => setSelectedCampaignId(Number(e.target.value) || null)}
                          style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13 }}
                        >
                          <option value="">No Campaign</option>
                          {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                      </div>
                    )}

                    <button
                      onClick={() => void handleSave()}
                      disabled={saving || !!duplicateTransaction || success}
                      style={{
                        width: '100%', padding: '14px', border: 'none', borderRadius: 12,
                        fontWeight: 900, fontSize: 14,
                        cursor: saving || !!duplicateTransaction ? 'not-allowed' : 'pointer',
                        background: duplicateTransaction ? 'rgba(255,255,255,0.05)' : C.primary,
                        color: duplicateTransaction ? C.muted : '#022c22',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        opacity: saving ? 0.7 : 1,
                      }}
                    >
                      {saving          ? <><Loader2 size={16} className="spin" /> Savingâ€¦</>   :
                       duplicateTransaction ? 'Already Saved'                                  :
                       success         ? <><CheckCircle2 size={16} /> Saved!</>                :
                       <><Save size={16} /> Confirm & Save</>}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* BULK MODE                                                          */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {mode === 'bulk' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
                Multiple M-Pesa SMS
              </label>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 0, marginBottom: 12 }}>
                Paste multiple messages â€” the parser splits on transaction codes, blank lines, or "Confirmed." boundaries automatically.
              </p>
              <textarea
                placeholder={'QA52HJKL12 Confirmed. Ksh500.00 sent to JOHN DOEâ€¦\n\nQB12XYZABC Confirmed. You have received Ksh2,000.00â€¦'}
                rows={8}
                value={bulkText}
                onChange={e => { setBulkText(e.target.value); setBulkResults([]); setBulkDone(false); }}
                style={{ width: '100%', padding: '12px 14px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 12, lineHeight: 1.65, resize: 'vertical', fontFamily: 'monospace' }}
              />

              {campaigns.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Target size={11} /> Link all to Campaign (optional)
                  </label>
                  <select
                    value={bulkCampaignId ?? ''}
                    onChange={e => setBulkCampaignId(Number(e.target.value) || null)}
                    style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13 }}
                  >
                    <option value="">No Campaign</option>
                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              )}

              <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                <button
                  onClick={() => handleBulkParse()}
                  style={{ flex: 1, padding: '13px', background: C.text, color: '#0a0f1e', border: 'none', borderRadius: 11, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                >
                  PARSE ALL
                </button>
                <button
                  onClick={() => { setBulkText(''); setBulkResults([]); setBulkDone(false); setBulkCampaignId(null); }}
                  style={{ padding: '13px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 11, color: C.muted, cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {bulkResults.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>

                {/* ── Filter panel ── */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: C.text }}>
                      <Filter size={14} color={C.muted} />
                      Filter results
                      {activeFilterCount > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(59,130,246,0.15)', color: C.blue }}>
                          {activeFilterCount} active
                        </span>
                      )}
                    </span>
                    <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                      Clear all
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    {([
                      { label: 'Min amount (KES)', val: filterMinAmount, set: setFilterMinAmount },
                      { label: 'Max amount (KES)', val: filterMaxAmount, set: setFilterMaxAmount },
                    ] as { label: string; val: string; set: (v: string) => void }[]).map(({ label, val, set }) => (
                      <div key={label}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</p>
                        <input
                          type="number" min="0" placeholder="Any" value={val}
                          onChange={e => set(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, color: C.text, fontSize: 13 }}
                        />
                      </div>
                    ))}
                    {([
                      { label: 'From date', val: filterDateFrom, set: setFilterDateFrom },
                      { label: 'To date',   val: filterDateTo,   set: setFilterDateTo   },
                    ] as { label: string; val: string; set: (v: string) => void }[]).map(({ label, val, set }) => (
                      <div key={label}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</p>
                        <input
                          type="date" value={val}
                          onChange={e => set(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, color: C.text, fontSize: 12 }}
                        />
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>Transaction type</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {uniqueParsedTypes.map(t => {
                      const on = filterTypes.has(t);
                      return (
                        <button key={t} onClick={() => toggleFilterType(t)}
                          style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${on ? C.blue : C.border}`, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: on ? 'rgba(59,130,246,0.15)' : 'transparent', color: on ? C.blue : C.muted, transition: 'all 0.12s' }}
                        >
                          {t.replace(/_/g, ' ')}
                        </button>
                      );
                    })}
                  </div>

                  {activeFilterCount > 0 && (
                    <p style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>
                      Showing {visibleResults.length} of {bulkResults.length} transactions
                      {' · '}KES {visibleResults.reduce((s, r) => s + (r.amount ?? 0), 0).toLocaleString()} total
                    </p>
                  )}
                </div>
                {/* ── Summary bar ── */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{bulkParsed.length} transactions parsed</span>
                  {bulkDone && (
                    <>
                      <Chip color={C.primary}>{bulkSaved} saved</Chip>
                      {bulkDupe   > 0 && <Chip color={C.amber}>{bulkDupe} duplicates</Chip>}
                      {bulkErrors > 0 && <Chip color={C.red}>{bulkErrors} errors</Chip>}
                    </>
                  )}
                  {!bulkDone && (
                    <button
                      onClick={() => void handleBulkSave()}
                      disabled={bulkSaving}
                      style={{ marginLeft: 'auto', padding: '8px 18px', background: C.primary, color: '#022c22', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {bulkSaving ? <><Loader2 size={14} className="spin" /> Savingâ€¦</> : <><Save size={14} /> Save All</>}
                    </button>
                  )}
                  {bulkDone && (
                    <button
                      onClick={() =>
                        navigate(bulkCampaignId
                          ? `/campaigns/${bulkCampaignId}?tab=contributions`
                          : '/transactions')
                      }
                      style={{ marginLeft: 'auto', padding: '8px 18px', background: C.primary, color: '#022c22', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                    >
                      {bulkCampaignId ? 'View Contributions →' : 'View Transactions →'}
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {visibleResults.length === 0 && activeFilterCount > 0 && (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: C.muted, fontSize: 13 }}>
                      <Filter size={22} style={{ display: 'block', margin: '0 auto 8px' }} />
                      No transactions match these filters
                    </div>
                  )}
                  {visibleResults.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        background: C.surface,
                        border: `1px solid ${
                          r.status === 'saved'     ? 'rgba(16,185,129,0.25)' :
                          r.status === 'duplicate' ? 'rgba(245,158,11,0.2)'  :
                          r.status === 'error'     ? 'rgba(239,68,68,0.2)'   : C.border
                        }`,
                        borderRadius: 12, padding: '12px 16px',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background:
                          r.status === 'saved'     ? 'rgba(16,185,129,0.12)' :
                          r.status === 'duplicate' ? 'rgba(245,158,11,0.1)'  :
                          r.status === 'error'     ? 'rgba(239,68,68,0.1)'   : 'rgba(255,255,255,0.04)',
                      }}>
                        {r.status === 'saved'     ? <CheckCircle2 size={15} color={C.primary} /> :
                         r.status === 'duplicate' ? <Copy        size={15} color={C.amber}   /> :
                         r.status === 'error'     ? <AlertCircle size={15} color={C.red}     /> :
                         bulkSaving               ? <Loader2     size={15} color={C.muted} className="spin" /> :
                         <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>{i + 1}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.name ?? 'Unknown'}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{r.transaction_code}</p>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.primary, flexShrink: 0 }}>
                        KES {r.amount?.toLocaleString() ?? 'â€”'}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// â”€â”€â”€ Small helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Detail({ label, value, mono, capitalize }: {
  label:      string;
  value:      string;
  mono?:      boolean;
  capitalize?: boolean;
}) {
  return (
    <div>
      <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#f1f5f9', fontFamily: mono ? 'monospace' : 'inherit', textTransform: capitalize ? 'capitalize' : 'none' }}>{value}</p>
    </div>
  );
}

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {children}
    </span>
  );
}