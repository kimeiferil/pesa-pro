/**
 * TransactionsPage.tsx – PesaPro
 * v2 fixes:
 *  - TYPE_COLORS: fuliza_draw / fuliza_repay keys match TransactionType (not 'fuliza')
 *  - TYPE_ICONS: same fix, plus pochi_la_biashara alias
 *  - isCredit: fuliza_repay removed (it's an outgoing repayment)
 *  - VirtualList: key uses index alone to avoid duplicate-key crash when
 *    transaction_code is null for multiple rows
 *  - VirtualList ResizeObserver also sets initial height via getBoundingClientRect
 *    so the list isn't blank before first resize event
 *  - exportToPDF: consistent dynamic-import unwrapping that works with
 *    jspdf ≥2.5 (named export) and older bundled versions
 *  - DetailSheet: fuliza_fee + fuliza_total_due rows added
 *  - DetailSheet: Escape handler uses `{ once: true }` so it never leaks
 *  - SummaryBar: balance_check excluded from moneyOut (was silently included)
 *  - toggleSort: no longer calls setSortDir inside setSortKey updater
 *    (avoids React batching issues in concurrent mode)
 *  - onBack falls back to window.history.back() when prop is undefined
 *  - Minor: aria-labels on sort buttons, export button title always accurate
 */

import React, {
  useState, useMemo, useCallback,
  useRef, useEffect, Component, ErrorInfo, ReactNode
} from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, Building2, Calendar, CheckCircle,
  ChevronRight, Clock, CreditCard, Download, FileText, FileUp, Filter,
  Hash, Info, Lock, LockIcon, Phone, Plus, Search, ShieldAlert,
  Tag, Trash2, TrendingDown, TrendingUp, Unlock, X, Zap
} from 'lucide-react';
import type { ParsedTransaction } from '../shared/mpesaParser';
import jsPDF from 'jspdf';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { extractTextFromPDF, parseMpesaStatement } from '../utils/mpesaStatementParser';
import { batchSaveTransactions } from '../features/transactions/transactionService';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  transactions:    ParsedTransaction[];
  businessName?:   string | null;
  onDelete?:       (txnId: string | null, index: number) => void;
  onRecategorise?: (txnId: string | null, index: number) => void;
  onClearAll?:     () => void;
  onBack?:         () => void;
}

type SortKey = 'date' | 'amount' | 'type';
type SortDir = 'asc' | 'desc';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROW_HEIGHT = 104;
const OVERSCAN   = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function safeAmount(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return `KES ${fmt(n)}`;
}

function safeDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    const p = new Date(d);
    if (isNaN(p.getTime())) return d;
    return p.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return d; }
}

// Fix: keys now match TransactionType values exactly
const TYPE_COLORS: Record<string, string> = {
  received:      '#00C851',
  send_money:    '#ef4444',
  paybill:       '#f59e0b',
  till:          '#f59e0b',
  withdrawal:    '#f97316',
  reversal:      '#a78bfa',
  airtime:       '#38bdf8',
  balance_check: '#94a3b8',
  deposit:       '#4ade80',
  fuliza_draw:   '#fb7185',   // was 'fuliza' — never matched
  fuliza_repay:  '#34d399',   // was missing
  pochi:         '#06b6d4',
  loan:          '#c084fc',
  unknown:       '#64748b'
};

const TYPE_ICONS: Record<string, string> = {
  received:      '↙',
  send_money:    '↗',
  paybill:       '🏦',
  till:          '🛒',
  withdrawal:    '🏧',
  reversal:      '↩',
  airtime:       '📱',
  balance_check: '👁',
  deposit:       '💰',
  fuliza_draw:   '⚡',    // was 'fuliza'
  fuliza_repay:  '✅',    // was missing
  pochi:         '🤝',
  loan:          '📋',
  unknown:       '❓'
};

// Fix: fuliza_repay is outgoing (repayment), not a credit
function isCredit(type: string) {
  return ['received', 'deposit', 'reversal'].includes(type);
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
async function exportToPDF(transactions: ParsedTransaction[]): Promise<void> {
// Static import — required for Capacitor Android WebView compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW  = doc.internal.pageSize.getWidth()  as number;
  const pageH  = doc.internal.pageSize.getHeight() as number;
  const margin = 14;
  const colW   = pageW - margin * 2;

  // Green header bar
  doc.setFillColor(0, 200, 81);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PesaPro', margin, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('M-PESA Transaction Statement', margin, 19);
  doc.text(
    new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }),
    pageW - margin, 19, { align: 'right' },
  );

  // Summary strip
  const totalIn  = transactions.filter(t => isCredit(t.type)).reduce((s, t) => s + (t.amount ?? 0), 0);
  const totalOut = transactions
    .filter(t => !isCredit(t.type) && t.type !== 'balance_check')
    .reduce((s, t) => s + (t.amount ?? 0), 0);
  const net = totalIn - totalOut;

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 28, pageW, 18, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('MONEY IN',  margin,         36);
  doc.text('MONEY OUT', pageW / 2 - 10, 36);
  doc.text('NET',       pageW - margin, 36, { align: 'right' });
  doc.setFontSize(10);
  doc.setTextColor(0, 200, 81);
  doc.text(`KES ${fmt(totalIn)}`,        margin,         42);
  doc.setTextColor(239, 68, 68);
  doc.text(`KES ${fmt(totalOut)}`,       pageW / 2 - 10, 42);
  doc.setTextColor(net >= 0 ? 0 : 239, net >= 0 ? 200 : 68, net >= 0 ? 81 : 68);
  doc.text(`KES ${fmt(Math.abs(net))}`,  pageW - margin, 42, { align: 'right' });

  // Table header
  let y = 54;
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, colW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');

  const cols = {
    date:   margin + 1,
    name:   margin + 24,
    type:   margin + 80,
    cat:    margin + 110,
    amount: pageW - margin - 1
  };
  doc.text('DATE',            cols.date,   y + 4.8);
  doc.text('NAME / BUSINESS', cols.name,   y + 4.8);
  doc.text('TYPE',            cols.type,   y + 4.8);
  doc.text('CATEGORY',        cols.cat,    y + 4.8);
  doc.text('AMOUNT',          cols.amount, y + 4.8, { align: 'right' });
  y += 7;

  // Rows
  doc.setFont('helvetica', 'normal');
  const rowH = 6.5;

  transactions.forEach((t, i) => {
    if (y + rowH > pageH - 16) { doc.addPage(); y = 16; }
    if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(margin, y, colW, rowH, 'F'); }

    const credit = isCredit(t.type);
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(safeDate(t.date), cols.date, y + 4.4);
    doc.setTextColor(15, 23, 42);
    doc.text((t.name ?? t.business ?? 'Unknown').slice(0, 36), cols.name, y + 4.4);
    doc.setTextColor(100, 116, 139);
    doc.text((t.type ?? '—').replace(/_/g, ' '), cols.type, y + 4.4);
    doc.text(t.category ?? '—', cols.cat, y + 4.4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(credit ? 0 : 239, credit ? 200 : 68, credit ? 81 : 68);
    doc.text(
      t.amount != null ? `${credit ? '+' : '-'}KES ${fmt(t.amount)}` : '—',
      cols.amount, y + 4.4, { align: 'right' },
    );
    doc.setFont('helvetica', 'normal');
    y += rowH;
  });

  // Page footers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pages = (doc.internal as any).getNumberOfPages() as number;
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `PesaPro · Generated ${new Date().toLocaleString('en-KE')} · Page ${p} of ${pages}`,
      pageW / 2, pageH - 6, { align: 'center' },
    );
  }

  const filename = `PesaPro_Statement_${new Date().toISOString().slice(0, 10)}.pdf`;

  if (Capacitor.isNativePlatform()) {
    // Native Export: Save to filesystem and share
    const pdfOutput = doc.output('datauristring');
    const base64Data = pdfOutput.split(',')[1];

    try {
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache
      });

      await Share.share({
        title: 'M-PESA Statement',
        text: 'Exported PesaPro Statement',
        url: savedFile.uri,
        dialogTitle: 'Share PDF Statement'
      });
    } catch (e) {
      console.error('Error sharing PDF:', e);
      throw new Error('Failed to share PDF statement.');
    }
  } else {
    // Web Export: Trigger browser download
    doc.save(filename);
  }
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────
function DetailSheet({
  txn, onClose, onDelete, onRecategorise, index
}: {
  txn:             ParsedTransaction;
  onClose:         () => void;
  onDelete?:       Props['onDelete'];
  onRecategorise?: Props['onRecategorise'];
  index:           number;
}) {
  const credit   = isCredit(txn.type);
  const color    = TYPE_COLORS[txn.type] ?? '#64748b';
  const icon     = TYPE_ICONS[txn.type]  ?? '❓';
  const amtColor = credit ? '#00C851' : '#ef4444';

  // Close on backdrop click
  const backdropRef = useRef<HTMLDivElement>(null);
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  // Fix: { once: true } prevents listener accumulation across re-renders
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler, { once: true });
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const rows: { icon: ReactNode; label: string; value: string; mono?: boolean }[] = [
    txn.transaction_code  ? { icon: <Hash size={14} />,        label: 'Transaction Code', value: txn.transaction_code, mono: true } : null,
    txn.phone             ? { icon: <Phone size={14} />,       label: 'Phone',            value: txn.phone } : null,
    txn.name              ? { icon: <Building2 size={14} />,   label: 'Name',             value: txn.name } : null,
    txn.business          ? { icon: <Building2 size={14} />,   label: 'Business',         value: txn.business } : null,
    txn.paybill           ? { icon: <CreditCard size={14} />,  label: 'Paybill No.',      value: txn.paybill } : null,
    txn.account           ? { icon: <Hash size={14} />,        label: 'Account No.',      value: txn.account, mono: true } : null,
    txn.till              ? { icon: <Hash size={14} />,        label: 'Till No.',         value: txn.till, mono: true } : null,
    txn.date              ? { icon: <Calendar size={14} />,    label: 'Date',             value: safeDate(txn.date) } : null,
    txn.time              ? { icon: <Clock size={14} />,       label: 'Time',             value: txn.time } : null,
    txn.category          ? { icon: <Tag size={14} />,         label: 'Category',         value: txn.category } : null,
    txn.balance           ? { icon: <CreditCard size={14} />,  label: 'M-PESA Balance',   value: safeAmount(txn.balance) } : null,
    txn.transaction_cost  ? { icon: <CreditCard size={14} />,  label: 'Transaction Fee',  value: safeAmount(txn.transaction_cost) } : null,
    // Fix: Fuliza fields were missing from the detail sheet
    txn.fuliza_fee        ? { icon: <Zap size={14} />,         label: 'Fuliza Access Fee',     value: safeAmount(txn.fuliza_fee) } : null,
    txn.fuliza_total_due  ? { icon: <Zap size={14} />,         label: 'Fuliza Outstanding',    value: safeAmount(txn.fuliza_total_due) } : null,
  ].filter(Boolean) as { icon: ReactNode; label: string; value: string; mono?: boolean }[];

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Transaction details"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end',
        animation: 'fadeIn 0.15s ease'
      }}
    >
      <div style={{
        width: '100%', maxWidth: 560, margin: '0 auto',
        background: '#fff', borderRadius: '24px 24px 0 0',
        overflow: 'hidden',
        animation: 'slideUp 0.25s cubic-bezier(0.32,0.72,0,1)',
        maxHeight: '90dvh', display: 'flex', flexDirection: 'column'
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
        </div>

        {/* Hero */}
        <div style={{
          padding: '16px 20px 20px',
          background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: `${color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
              }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {txn.type.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {txn.name ?? txn.business ?? 'Unknown'}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <X size={16} color="#64748b" />
            </button>
          </div>

          {/* Amount */}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: amtColor }}>{credit ? '+' : '-'}</span>
            <span style={{ fontSize: 32, fontWeight: 900, color: amtColor, letterSpacing: '-0.02em' }}>
              {txn.amount != null ? `KES ${fmt(txn.amount)}` : '—'}
            </span>
          </div>

          {/* Status chips */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${color}18`, color, border: `1px solid ${color}30` }}>
              {txn.type.replace(/_/g, ' ').toUpperCase()}
            </span>
            {txn.needs_review ? (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShieldAlert size={10} /> Needs Review
              </span>
            ) : (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={10} /> Verified {Math.round((txn.confidence ?? 0) * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* Detail rows */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {rows.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '13px 20px',
              borderBottom: i < rows.length - 1 ? '1px solid #f8fafc' : 'none'
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexShrink: 0 }}>
                {r.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{r.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginTop: 2, fontFamily: r.mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{r.value}</div>
              </div>
            </div>
          ))}

          {/* Raw SMS */}
          {txn.raw_text && (
            <div style={{ margin: '8px 20px 16px', padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Raw SMS</div>
              <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.6, fontFamily: 'monospace', wordBreak: 'break-word' }}>{txn.raw_text}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {(onDelete || onRecategorise) && (
          <div style={{ padding: '12px 20px 28px', display: 'flex', gap: 10, borderTop: '1px solid #f1f5f9' }}>
            {onRecategorise && (
              <button
                onClick={() => { onRecategorise(txn.transaction_code, index); onClose(); }}
                style={{ flex: 1, padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Tag size={14} /> Recategorise
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => { onDelete(txn.transaction_code, index); onClose(); }}
                style={{ flex: 1, padding: '12px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, color: '#e11d48', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <X size={14} /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
interface EBState { hasError: boolean; message: string }
class TxnErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, message: '' };
  static getDerivedStateFromError(e: Error): EBState { return { hasError: true, message: e.message }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[TransactionsPage]', error, info); }
  render() {
    if (this.state.hasError) return (
      <div className="tp-error">
        <span style={{ fontSize: 48 }}>⚠️</span>
        <h2>Something went wrong</h2>
        <p>{this.state.message || 'An unexpected error occurred.'}</p>
        <button onClick={() => this.setState({ hasError: false, message: '' })}>Try again</button>
      </div>
    );
    return this.props.children;
  }
}

// ─── Transaction Row ──────────────────────────────────────────────────────────
interface RowProps {
  txn:   ParsedTransaction;
  index: number;
  style: React.CSSProperties;
  onTap: (txn: ParsedTransaction, index: number) => void;
}

const TxnRow = React.memo(function TxnRow({ txn, index, style, onTap }: RowProps) {
  const credit   = isCredit(txn.type);
  const label    = txn.name ?? txn.business ?? 'Unknown';
  const typeStr  = (txn.type ?? 'unknown').replace(/_/g, ' ');
  const color    = TYPE_COLORS[txn.type] ?? '#64748b';
  const amtColor = credit ? '#00C851' : '#ef4444';

  return (
    <div className="tp-row" style={style} onClick={() => onTap(txn, index)}>
      <div className="tp-row__card">
        <div className="tp-row__accent" style={{ background: color }} />
        <div className="tp-row__body">
          <div className="tp-row__top">
            <div className="tp-row__left">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="tp-row__name">{label}</span>
                {txn.business_id ? (
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
                    Business
                  </span>
                ) : (
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
                    Personal
                  </span>
                )}
              </div>
              <span className="tp-row__code">{txn.transaction_code ?? `#${index + 1}`}</span>
            </div>
            <div className="tp-row__right">
              <span className="tp-row__amount" style={{ color: amtColor }}>
                {txn.amount != null ? `${credit ? '+' : '-'}KES ${fmt(txn.amount)}` : '—'}
              </span>
              <span className="tp-row__badge" style={{ background: `${color}18`, color }}>
                {typeStr}
              </span>
            </div>
          </div>
          <div className="tp-row__bottom">
            <span className="tp-row__date">{safeDate(txn.date)}</span>
            {txn.category && txn.category !== 'other' && (
              <span className="tp-row__cat">{txn.category}</span>
            )}
            {txn.needs_review && (
              <span className="tp-row__review">
                <AlertTriangle size={10} style={{ display: 'inline', marginRight: 3 }} />
                Review
              </span>
            )}
            <span className="tp-row__tap-hint">tap for details →</span>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Summary Bar ──────────────────────────────────────────────────────────────
const SummaryBar = React.memo(function SummaryBar({ transactions }: { transactions: ParsedTransaction[] }) {
  const { moneyIn, moneyOut, net } = useMemo(() => {
    let moneyIn = 0, moneyOut = 0;
    for (const t of transactions) {
      if (t.amount == null || isNaN(t.amount)) continue;
      // Fix: explicitly exclude balance_check from outgoing total
      if (isCredit(t.type)) {
        moneyIn += t.amount;
      } else if (t.type !== 'balance_check') {
        moneyOut += t.amount;
      }
    }
    return { moneyIn, moneyOut, net: moneyIn - moneyOut };
  }, [transactions]);

  return (
    <div className="tp-summary">
      <div className="tp-summary__pill">
        <TrendingUp size={14} style={{ color: '#00C851' }} />
        <div>
          <div className="tp-summary__label">Money In</div>
          <div className="tp-summary__value" style={{ color: '#00C851' }}>{safeAmount(moneyIn)}</div>
        </div>
      </div>
      <div className="tp-summary__divider" />
      <div className="tp-summary__pill">
        <TrendingDown size={14} style={{ color: '#ef4444' }} />
        <div>
          <div className="tp-summary__label">Money Out</div>
          <div className="tp-summary__value" style={{ color: '#ef4444' }}>{safeAmount(moneyOut)}</div>
        </div>
      </div>
      <div className="tp-summary__divider" />
      <div className="tp-summary__pill">
        <Activity size={14} style={{ color: net >= 0 ? '#00C851' : '#ef4444' }} />
        <div>
          <div className="tp-summary__label">Net</div>
          <div className="tp-summary__value" style={{ color: net >= 0 ? '#00C851' : '#ef4444' }}>{safeAmount(net)}</div>
        </div>
      </div>
    </div>
  );
});

// ─── Virtual List ─────────────────────────────────────────────────────────────
function VirtualList({ items, onTap, onDelete, onRecategorise }: {
  items:           ParsedTransaction[];
  onTap:           (txn: ParsedTransaction, index: number) => void;
  onDelete?:       Props['onDelete'];
  onRecategorise?: Props['onRecategorise'];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Fix: seed viewportH from getBoundingClientRect so first render isn't blank
    setViewportH(el.getBoundingClientRect().height || el.clientHeight);

    const ro = new ResizeObserver(([e]) => setViewportH(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.currentTarget as HTMLDivElement).scrollTop);
  }, []);

  const totalH   = items.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx   = Math.min(items.length - 1, Math.ceil((scrollTop + viewportH) / ROW_HEIGHT) + OVERSCAN);
  const visible  = items.slice(startIdx, endIdx + 1);

  return (
    <div ref={containerRef} className="tp-vlist" onScroll={onScroll}>
      <div style={{ height: totalH, position: 'relative' }}>
        {visible.map((txn, i) => {
          const realIndex = startIdx + i;
          return (
            <TxnRow
              // Fix: key is index-only — transaction_code can be null for multiple
              // rows, which caused duplicate key warnings and identity instability
              key={realIndex}
              txn={txn}
              index={realIndex}
              style={{ position: 'absolute', top: realIndex * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT }}
              onTap={onTap}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TransactionsPage({
  transactions = [],
  onDelete,
  onRecategorise,
  onClearAll,
  onBack,
  businessName = 'Personal'
}: Props) {
  const [search,      setSearch]      = useState('');
  const [sortKey,     setSortKey]     = useState<SortKey>('date');
  const [sortDir,     setSortDir]     = useState<SortDir>('desc');
  const [typeFilter,  setTypeFilter]  = useState('all');
  const [exporting,   setExporting]   = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [selected, setSelected] = useState<{ txn: ParsedTransaction; index: number } | null>(null);

  // --- Statement Import State ---
  const queryClient = useQueryClient();
  const [importingStatement, setImportingStatement] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [statementFile, setStatementFile] = useState<{ path: string; name: string } | null>(null);
  const [password, setPassword] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'reading' | 'parsing' | 'saving'>('idle');

  const handlePickStatement = useCallback(async () => {
    try {
      const result = await FilePicker.pickFiles({
        types: ['application/pdf']
      });

      if (result.files.length > 0) {
        const file = result.files[0];
        setStatementFile({ path: file.path!, name: file.name });
        setShowPasswordModal(true);
      }
    } catch (e) {
      console.error('File pick failed', e);
    }
  }, []);

  const handleProcessStatement = async () => {
    if (!statementFile || !password) return;

    setImportingStatement(true);
    setImportStatus('reading');
    setImportProgress(10);

    try {
      // 1. Read file
      const fileData = await Filesystem.readFile({
        path: statementFile.path
      });

      // Convert base64 to ArrayBuffer
      const binaryString = atob(fileData.data as string);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      setImportStatus('parsing');
      setImportProgress(30);

      // 2. Extract text with password
      let text = '';
      try {
        text = await extractTextFromPDF(bytes.buffer, password);
      } catch (err: any) {
        if (err.name === 'PasswordException') {
          toast.error('Incorrect ID number. Please try again.');
          setImportingStatement(false);
          return;
        }
        throw err;
      }

      // 3. Parse text
      const transactions = parseMpesaStatement(text);
      if (transactions.length === 0) {
        toast.error('No transactions found in this statement. Ensure it is an M-PESA statement.');
        setImportingStatement(false);
        setShowPasswordModal(false);
        return;
      }

      setImportStatus('saving');
      setImportProgress(50);

      // 4. Batch save
      const result = await batchSaveTransactions(transactions, (p) => {
        setImportProgress(50 + p / 2);
      });

      toast.success(`Imported ${result.saved} transactions (${result.skipped} skipped)`);

      // 5. Cleanup & Refresh
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setShowPasswordModal(false);
      setStatementFile(null);
      setPassword('');
    } catch (e) {
      console.error('Import failed', e);
      toast.error('Statement import failed. Please check the file and try again.');
    } finally {
      setImportingStatement(false);
      setImportStatus('idle');
      setImportProgress(0);
    }
  };

  const typeOptions = useMemo(() => {
    const types = new Set(transactions.map(t => t.type));
    return ['all', ...Array.from(types).sort()];
  }, [transactions]);

  const processed = useMemo(() => {
    let list = transactions.filter(t => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (!search) return true;
      const hay = [t.name, t.business, t.transaction_code, t.category, t.type, String(t.amount ?? '')]
        .join(' ').toLowerCase();
      return hay.includes(search.toLowerCase());
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if      (sortKey === 'amount') cmp = (a.amount ?? 0) - (b.amount ?? 0);
      else if (sortKey === 'type')   cmp = (a.type ?? '').localeCompare(b.type ?? '');
      else {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        cmp = da - db;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [transactions, search, sortKey, sortDir, typeFilter]);

  // Fix: don't call setSortDir inside setSortKey updater — causes batching issues
  const toggleSort = useCallback((key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }, [sortKey]);

  const handleExport = useCallback(async () => {
    if (exporting || processed.length === 0) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportToPDF(processed);
    } catch (e) {
      console.error('PDF export failed:', e);
      const msg = e instanceof Error ? e.message : String(e);
      setExportError(`PDF failed: ${msg}. Run: npm install jspdf`);
    } finally {
      setExporting(false);
    }
  }, [processed, exporting]);

  const handleTap = useCallback((txn: ParsedTransaction, index: number) => {
    setSelected({ txn, index });
  }, []);

  // Fix: graceful fallback when onBack prop is not provided
  const handleBack = useCallback(() => {
    if (onBack) onBack();
    else window.history.back();
  }, [onBack]);

  return (
    <TxnErrorBoundary>
      <div className="tp-shell">

        {/* ── Header ── */}
        <header className="tp-header">
          <button className="tp-header__back" onClick={handleBack} aria-label="Go back">
            <ArrowLeft size={18} />
          </button>
          <div className="tp-header__center">
            <h1 className="tp-header__title">Transactions</h1>
            <span className="tp-header__count">
              {businessName} · {processed.length.toLocaleString()} items
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {onClearAll && processed.length > 0 && (
              <button
                className="tp-header__export"
                onClick={() => setShowClearConfirm(true)}
                aria-label="Clear all transactions"
                style={{ background: 'rgba(239,68,68,0.2)' }}
                title="Clear all transactions"
              >
                <Trash2 size={18} color="#fff" />
              </button>
            )}
            <button
              className={`tp-header__export ${exporting ? 'tp-header__export--busy' : ''}`}
              onClick={handleExport}
              aria-label="Export PDF statement"
              disabled={exporting || processed.length === 0}
              title={
                processed.length === 0
                  ? 'No transactions to export'
                  : exporting
                  ? 'Generating PDF…'
                  : `Export ${processed.length} transactions as PDF`
              }
            >
              {exporting ? <Download size={18} className="tp-spin" /> : <FileText size={18} />}
            </button>
          </div>
        </header>

        {/* Clear all confirmation */}
        {showClearConfirm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 360, padding: 24, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <AlertTriangle size={28} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Clear all transactions?</h3>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5, marginBottom: 24 }}>
                This will permanently delete all {processed.length} transactions for <strong>{businessName}</strong>. This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  style={{ flex: 1, padding: '12px', background: '#f1f5f9', border: 'none', borderRadius: 12, color: '#64748b', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { onClearAll?.(); setShowClearConfirm(false); }}
                  style={{ flex: 1, padding: '12px', background: '#ef4444', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                >
                  Yes, Clear All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export error */}
        {exportError && (
          <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '8px 16px', fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{exportError}</span>
            <button onClick={() => setExportError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Summary ── */}
        <SummaryBar transactions={processed} />

        {/* ── Statement Import CTA ── */}
        <div style={{ padding: '0 14px 12px' }}>
          <button
            onClick={handlePickStatement}
            style={{
              width: '100%',
              padding: '16px',
              background: '#1A1F1B',
              border: '1px dashed rgba(0,166,81,0.3)',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,166,81,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00A651', flexShrink: 0 }}>
              <FileUp size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>Import Statement</p>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Load historical transactions instantly from an M-PESA PDF</p>
            </div>
            <ChevronRight size={16} color="#64748b" />
          </button>
        </div>

        {/* ── Controls ── */}
        <div className="tp-controls">
          <div className="tp-controls__search-wrap">
            <Search size={15} className="tp-controls__search-icon" />
            <input
              className="tp-controls__search"
              type="search"
              placeholder="Search name, code, category…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="tp-controls__row">
            <div className="tp-controls__filter-wrap">
              <Filter size={13} className="tp-controls__filter-icon" />
              <select
                className="tp-controls__filter"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                aria-label="Filter by type"
              >
                {typeOptions.map(t => (
                  <option key={t} value={t}>{t === 'all' ? 'All types' : t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="tp-controls__sort" role="group" aria-label="Sort transactions">
              {(['date', 'amount', 'type'] as SortKey[]).map(k => (
                <button
                  key={k}
                  className={`tp-sort-btn ${sortKey === k ? 'active' : ''}`}
                  onClick={() => toggleSort(k)}
                  aria-label={`Sort by ${k}${sortKey === k ? `, currently ${sortDir}ending` : ''}`}
                  aria-pressed={sortKey === k}
                >
                  {k}{sortKey === k && <span style={{ marginLeft: 3 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── List ── */}
        {processed.length === 0 ? (
          <div className="tp-empty">
            <Search size={40} style={{ color: '#94a3b8' }} />
            <p>{transactions.length === 0 ? 'No transactions imported yet.' : 'No transactions match your filters.'}</p>
          </div>
        ) : (
          <VirtualList
            items={processed}
            onTap={handleTap}
            onDelete={onDelete}
            onRecategorise={onRecategorise}
          />
        )}
      </div>

      {/* ── Detail Sheet ── */}
      {selected && (
        <DetailSheet
          txn={selected.txn}
          index={selected.index}
          onClose={() => setSelected(null)}
          onDelete={onDelete}
          onRecategorise={onRecategorise}
        />
      )}

      {/* ── Password Modal ── */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              style={{ background: '#1A1F1B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, width: '100%', maxWidth: 400, padding: 28, textAlign: 'center' }}
            >
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(0,166,81,0.1)', color: '#00A651', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <LockIcon size={28} />
              </div>

              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Statement Password</h3>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
                Safaricom statement PDFs are locked with your <strong>National ID Number</strong>. We never save this.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <input
                  type="password"
                  placeholder="Enter ID Number"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={importingStatement}
                  style={{
                    width: '100%', padding: '16px', background: '#111411', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12, color: '#fff', fontSize: 16, textAlign: 'center', outline: 'none'
                  }}
                />

                {importingStatement && (
                  <div style={{ margin: '10px 0' }}>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${importProgress}%` }}
                        style={{ height: '100%', background: '#00A651' }}
                      />
                    </div>
                    <p style={{ fontSize: 12, color: '#00A651', fontWeight: 700, textTransform: 'uppercase' }}>
                      {importStatus === 'reading' && 'Reading PDF...'}
                      {importStatus === 'parsing' && 'Extracting Data...'}
                      {importStatus === 'saving' && 'Saving Transactions...'}
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <button
                    onClick={() => { setShowPasswordModal(false); setStatementFile(null); }}
                    disabled={importingStatement}
                    style={{ flex: 1, padding: '14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#64748b', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleProcessStatement}
                    disabled={!password || importingStatement}
                    style={{ flex: 2, padding: '14px', background: '#00A651', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer', opacity: (!password || importingStatement) ? 0.5 : 1 }}
                  >
                    {importingStatement ? 'Processing...' : 'Unlock & Import'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .tp-shell {
          display: flex; flex-direction: column;
          height: 100dvh; background: #f1f5f9;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          overflow: hidden; color: #0f172a;
        }

        /* Header */
        .tp-header {
          display: flex; align-items: center; gap: 12px;
          padding: 0 16px; height: 64px;
          background: linear-gradient(160deg, #00C851 0%, #00943c 100%);
          flex-shrink: 0;
        }
        .tp-header__back, .tp-header__export {
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(255,255,255,0.18); border: none; color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.15s; flex-shrink: 0;
        }
        .tp-header__back:hover  { background: rgba(255,255,255,0.28); }
        .tp-header__export:hover:not(:disabled) { background: rgba(255,255,255,0.28); }
        .tp-header__export:disabled { opacity: 0.45; cursor: not-allowed; }
        .tp-header__export--busy { background: rgba(255,255,255,0.28); }
        .tp-header__center { flex: 1; display: flex; flex-direction: column; align-items: center; }
        .tp-header__title { font-size: 17px; font-weight: 800; color: #fff; line-height: 1; }
        .tp-header__count { font-size: 11px; color: rgba(255,255,255,0.75); margin-top: 2px; font-weight: 500; }

        @keyframes tp-spin { to { transform: rotate(360deg); } }
        .tp-spin { animation: tp-spin 1s linear infinite; }

        /* Summary */
        .tp-summary {
          display: flex; align-items: center;
          background: #fff; border-bottom: 1px solid #f1f5f9;
          padding: 0 16px; flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .tp-summary__pill { display: flex; align-items: center; gap: 8px; padding: 14px 0; flex: 1; }
        .tp-summary__divider { width: 1px; height: 32px; background: #f1f5f9; margin: 0 4px; }
        .tp-summary__label { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 0.05em; text-transform: uppercase; }
        .tp-summary__value { font-size: 13px; font-weight: 800; margin-top: 2px; white-space: nowrap; }

        /* Controls */
        .tp-controls {
          padding: 12px 14px 8px; display: flex; flex-direction: column;
          gap: 8px; flex-shrink: 0; background: #f1f5f9;
        }
        .tp-controls__search-wrap { position: relative; }
        .tp-controls__search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
        .tp-controls__search {
          width: 100%; background: #fff; border: 1px solid #e2e8f0;
          border-radius: 12px; color: #0f172a; padding: 10px 14px 10px 36px;
          font-size: 14px; font-family: inherit; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .tp-controls__search:focus { border-color: #00C851; box-shadow: 0 0 0 3px rgba(0,200,81,0.1); }
        .tp-controls__row { display: flex; gap: 8px; align-items: center; }
        .tp-controls__filter-wrap { position: relative; flex-shrink: 0; }
        .tp-controls__filter-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
        .tp-controls__filter {
          background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
          color: #0f172a; padding: 8px 10px 8px 28px;
          font-size: 13px; font-family: inherit; outline: none; cursor: pointer; appearance: none;
        }
        .tp-controls__sort { display: flex; gap: 6px; flex-wrap: wrap; }
        .tp-sort-btn {
          background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
          color: #64748b; padding: 7px 12px; font-size: 12px; font-weight: 600;
          font-family: inherit; cursor: pointer; text-transform: capitalize; transition: all 0.15s;
        }
        .tp-sort-btn.active { background: #00C851; border-color: #00C851; color: #fff; }
        .tp-sort-btn:not(.active):hover { border-color: #00C851; color: #00C851; }

        /* Virtual list */
        .tp-vlist {
          flex: 1; overflow-y: auto; overflow-x: hidden;
          -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
          padding: 4px 14px 20px; will-change: transform;
        }
        .tp-vlist::-webkit-scrollbar { width: 3px; }
        .tp-vlist::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }

        /* Row */
        .tp-row { box-sizing: border-box; padding: 4px 0; cursor: pointer; }
        .tp-row__card {
          background: #fff; border-radius: 14px; border: 1px solid #f1f5f9;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex;
          overflow: hidden; height: 96px;
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .tp-row__card:hover  { box-shadow: 0 4px 16px rgba(0,0,0,0.10); transform: translateY(-1px); }
        .tp-row__card:active { transform: scale(0.99); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .tp-row__accent { width: 4px; flex-shrink: 0; }
        .tp-row__body { flex: 1; padding: 10px 12px; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
        .tp-row__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .tp-row__left  { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .tp-row__right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
        .tp-row__name   { font-size: 14px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; }
        .tp-row__code   { font-size: 10px; color: #94a3b8; font-family: monospace; }
        .tp-row__amount { font-size: 14px; font-weight: 800; }
        .tp-row__badge  { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: capitalize; white-space: nowrap; }
        .tp-row__bottom { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .tp-row__date   { font-size: 11px; color: #94a3b8; }
        .tp-row__cat    { font-size: 10px; font-weight: 600; background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 20px; text-transform: capitalize; }
        .tp-row__review { font-size: 10px; font-weight: 700; color: #f59e0b; display: flex; align-items: center; }
        .tp-row__tap-hint { font-size: 10px; color: #cbd5e1; margin-left: auto; font-weight: 500; }

        /* Empty */
        .tp-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #94a3b8; font-size: 14px; font-weight: 500; }

        /* Error */
        .tp-error { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 16px; padding: 24px; color: #ef4444; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; text-align: center; }
        .tp-error h2 { font-size: 20px; font-weight: 800; color: #0f172a; }
        .tp-error p  { color: #94a3b8; font-size: 14px; max-width: 300px; }
        .tp-error button { margin-top: 8px; padding: 10px 24px; background: #00C851; color: #fff; border: none; border-radius: 50px; cursor: pointer; font-weight: 700; font-size: 14px; font-family: inherit; }

        /* Responsive */
        @media (min-width: 640px) {
          .tp-header   { padding: 0 24px; }
          .tp-controls { padding: 12px 24px 8px; }
          .tp-vlist    { padding: 4px 24px 24px; }
          .tp-row__name { max-width: 280px; }
        }
        @media (min-width: 1024px) {
          .tp-shell { max-width: 860px; margin: 0 auto; }
          .tp-row__name { max-width: 400px; }
        }
      `}</style>
    </TxnErrorBoundary>
  );
}
