import { supabase } from '../../lib/supabase';
// src/features/transactions/transactionService.ts
import type { ParsedTransaction } from '../../shared/mpesaParser';

// ─── DB row shape ─────────────────────────────────────────────────────────────
export interface TransactionRow {
  id:               string;
  transaction_code: string | null;
  amount:           number;
  name:             string;
  phone:            string;
  type:             string;
  category:         string;
  raw_text:         string;
  event_id:         number | null;
  needs_review:     boolean;
  balance:          number | null;
  transaction_cost: number | null;
  created_at:       string;
  user_id:          string | null;
}

// ─── Get current user ID (returns 'local' if not logged in) ──────────────────
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? 'local-user';
}

// ─── Save a single transaction ────────────────────────────────────────────────
export async function saveTransaction(
  transaction: ParsedTransaction,
  campaignId?: number,
): Promise<TransactionRow[]> {
  const user_id = await getCurrentUserId();

  const row = {
    user_id:          user_id === 'local-user' ? null : user_id,
    amount:           transaction.amount ?? 0,
    name:             transaction.name ?? 'Unknown',
    phone:            transaction.phone ?? '',
    transaction_code: transaction.transaction_code,
    txn_id:           transaction.transaction_code,
    raw_text:         transaction.raw_text ?? '',
    type:             transaction.type,
    direction:        transaction.direction,
    event_id:         campaignId ?? null,
    category:         transaction.category ?? 'other',
    needs_review:     transaction.needs_review ?? false,
    balance:          transaction.balance ?? null,
    transaction_cost: transaction.transaction_cost ?? null,
    business:         transaction.business ?? null,
    paybill:          transaction.paybill ?? null,
    account:          transaction.account ?? null,
    till:             transaction.till ?? null,
    business_id:      (transaction.business_id && transaction.business_id !== '') ? transaction.business_id : null,
    fuliza_fee:       transaction.fuliza_fee ?? null,
    fuliza_total_due: transaction.fuliza_total_due ?? null,
    txn_date:         transaction.date ?? null,
    txn_time:         transaction.time ?? null,
    confidence:       transaction.confidence ?? 0,
    created_at:       new Date().toISOString(),
  };

  // If local user, we save only to the sync queue for now
  // This effectively acts as local storage until they log in
  if (user_id === 'local-user') {
    const localId = crypto.randomUUID();
    const localRow: TransactionRow = {
      ...row,
      id: localId,
      user_id: 'local-user',
      created_at: new Date().toISOString(),
    } as any;

    // Use the existing sync queue logic to store it locally
    const { addToSyncQueue } = await import('../../lib/syncQueue');
    addToSyncQueue(transaction, campaignId);

    return [localRow];
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert([row])
    .select();

  if (error) throw new Error(String((error as any)?.message ?? error));
  return (data ?? []) as TransactionRow[];
}

// ─── Look up a single transaction by code ────────────────────────────────────
export async function getTransactionByCode(
  transactionCode: string,
): Promise<TransactionRow | null> {
  const user_id = await getCurrentUserId();

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('transaction_code', transactionCode)
    .eq('user_id', user_id)       // scope to current user
    .maybeSingle();

  if (error) throw new Error(String((error as any)?.message ?? error));
  return data as TransactionRow | null;
}

// ─── Batch duplicate check ────────────────────────────────────────────────────
// Returns the subset of `codes` that already exist in the DB for this user.
export async function getExistingTransactionCodes(
  codes: string[],
): Promise<Set<string>> {
  if (!codes.length) return new Set();

  const user_id = await getCurrentUserId();

  const { data, error } = await supabase
    .from('transactions')
    .select('transaction_code')
    .eq('user_id', user_id)       // scope to current user
    .in('transaction_code', codes);

  if (error) throw new Error(String((error as any)?.message ?? error));
  return new Set(
    (data ?? [])
      .map((r: { transaction_code: string | null }) => r.transaction_code)
      .filter((c): c is string => c !== null),
  );
}

// ─── Get all transactions for current user ────────────────────────────────────
export async function getTransactions(): Promise<TransactionRow[]> {
  const user_id = await getCurrentUserId();

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user_id)       // scope to current user
    .order('created_at', { ascending: false });

  if (error) throw new Error(String((error as any)?.message ?? error));
  return (data ?? []) as TransactionRow[];
}

// ─── Delete a transaction ─────────────────────────────────────────────────────
export async function deleteTransaction(id: string): Promise<true> {
  const user_id = await getCurrentUserId();

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user_id);     // prevent deleting other users' rows

  if (error) throw new Error(String((error as any)?.message ?? error));
  return true;
}

// ─── Clear transactions ───────────────────────────────────────────────────────
export async function clearTransactions(businessId?: string | null): Promise<void> {
  const user_id = await getCurrentUserId();

  let query = supabase
    .from('transactions')
    .delete()
    .eq('user_id', user_id);

  if (businessId === undefined) {
    // nuclear option: delete ALL transactions for this user across all businesses
  } else if (businessId === null) {
    // personal only
    query = query.is('business_id', null);
  } else {
    // specific business
    query = query.eq('business_id', businessId);
  }

  const { error } = await query;
  if (error) throw new Error(String((error as any)?.message ?? error));
}

// ─── Save with splits ────────────────────────────────────────────────────────
export async function saveTransactionWithSplits(
  transaction: ParsedTransaction,
  splits: { type: string, amount: number, note?: string }[],
  groupId?: string,
): Promise<void> {
  const user_id = await getCurrentUserId();

  // 1. Save main transaction
  const { data: txn, error: txnErr } = await supabase
    .from('transactions')
    .insert([{
      user_id:          user_id === 'local-user' ? null : user_id,
      amount:           transaction.amount ?? 0,
      name:             transaction.name ?? 'Unknown',
      phone:            transaction.phone ?? '',
      transaction_code: transaction.transaction_code,
      txn_id:           transaction.transaction_code,
      raw_text:         transaction.raw_text ?? '',
      type:             transaction.type,
      direction:        transaction.direction,
      business_id:      groupId ?? null,
      category:         transaction.category ?? 'other',
      txn_date:         transaction.date ?? null,
      txn_time:         transaction.time ?? null,
    }])
    .select()
    .single();

  if (txnErr) throw new Error(String((txnErr as any)?.message ?? txnErr));

  // 2. Save splits
  if (splits.length > 0) {
    const { error: splitErr } = await supabase
      .from('transaction_splits')
      .insert(splits.map(s => ({
        transaction_id: txn.id,
        type:           s.type,
        amount:         s.amount,
        note:           s.note,
      })));

    if (splitErr) throw new Error(String((splitErr as any)?.message ?? splitErr));
  }
}

// ─── Batch save transactions ──────────────────────────────────────────────────
export async function batchSaveTransactions(
  transactions: ParsedTransaction[],
  onProgress?: (progress: number) => void
): Promise<{ saved: number; skipped: number }> {
  const user_id = await getCurrentUserId();
  const CHUNK_SIZE = 50;
  let savedCount = 0;
  let skippedCount = 0;

  // 1. Get all codes to check for duplicates
  const codes = transactions.map(t => t.transaction_code).filter(Boolean) as string[];
  const existingCodes = await getExistingTransactionCodes(codes);

  const toSave = transactions.filter(t => !t.transaction_code || !existingCodes.has(t.transaction_code));
  skippedCount = transactions.length - toSave.length;

  if (toSave.length === 0) return { saved: 0, skipped: skippedCount };

  // 2. Prepare rows
  const rows = toSave.map(t => ({
    user_id,
    amount:           t.amount ?? 0,
    name:             t.name ?? 'Unknown',
    phone:            t.phone ?? '',
    transaction_code: t.transaction_code,
    txn_id:           t.transaction_code,
    raw_text:         t.raw_text ?? '',
    type:             t.type,
    direction:        t.direction,
    category:         t.category ?? 'other',
    needs_review:     t.needs_review ?? false,
    balance:          t.balance ?? null,
    transaction_cost: t.transaction_cost ?? null,
    business:         t.business ?? null,
    paybill:          t.paybill ?? null,
    account:          t.account ?? null,
    till:             t.till ?? null,
    business_id:      (t.business_id && t.business_id !== '') ? t.business_id : null,
    fuliza_fee:       t.fuliza_fee ?? null,
    fuliza_total_due: t.fuliza_total_due ?? null,
    txn_date:         t.date ?? null,
    txn_time:         t.time ?? null,
    confidence:       t.confidence ?? 0,
    created_at:       new Date().toISOString(),
  }));

  // 3. Insert in chunks
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('transactions').insert(chunk);
    if (error) throw new Error(String((error as any)?.message ?? error));

    savedCount += chunk.length;
    if (onProgress) onProgress(Math.min(100, Math.round(((i + chunk.length) / rows.length) * 100)));
  }

  return { saved: savedCount, skipped: skippedCount };
}
