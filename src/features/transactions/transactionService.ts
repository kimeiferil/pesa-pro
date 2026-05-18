// src/features/transactions/transactionService.ts
import { supabase, handleSupabaseError } from '@/lib/supabase';
import type { ParsedTransaction } from '../../shared/mpesaParser';

// ─── DB row shape ─────────────────────────────────────────────────────────────
export interface TransactionRow {
  id:               number;
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

// ─── Get current user ID (throws if not logged in) ───────────────────────────
async function getCurrentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Not authenticated — please log in again.');
  return user.id;
}

// ─── Save a single transaction ────────────────────────────────────────────────
export async function saveTransaction(
  transaction: ParsedTransaction,
  campaignId?: number,
): Promise<TransactionRow[]> {
  const user_id = await getCurrentUserId();

  const row = {
    user_id,                                          // ← fixes NULL user_id
    amount:           transaction.amount ?? 0,
    name:             transaction.name ?? 'Unknown',
    phone:            transaction.phone ?? '',
    transaction_code: transaction.transaction_code,
    txn_id:           transaction.transaction_code,   // new schema column
    raw_text:         transaction.raw_text ?? '',
    type:             transaction.type,
    event_id:         campaignId ?? null,
    category:         transaction.category ?? 'other',
    needs_review:     transaction.needs_review ?? false,
    balance:          transaction.balance ?? null,
    transaction_cost: transaction.transaction_cost ?? null,
    business:         transaction.business ?? null,
    paybill:          transaction.paybill ?? null,
    account:          transaction.account ?? null,
    till:             transaction.till ?? null,
    txn_date:         transaction.date ?? null,
    txn_time:         transaction.time ?? null,
    confidence:       transaction.confidence ?? 0,
    created_at:       new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('transactions')
    .insert([row])
    .select();

  if (error) throw handleSupabaseError(error);
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

  if (error) throw handleSupabaseError(error);
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

  if (error) throw handleSupabaseError(error);
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

  if (error) throw handleSupabaseError(error);
  return (data ?? []) as TransactionRow[];
}

// ─── Delete a transaction ─────────────────────────────────────────────────────
export async function deleteTransaction(id: number): Promise<true> {
  const user_id = await getCurrentUserId();

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user_id);     // prevent deleting other users' rows

  if (error) throw handleSupabaseError(error);
  return true;
}

// ─── Update category ──────────────────────────────────────────────────────────
export async function updateTransactionCategory(
  id: number,
  category: string,
): Promise<void> {
  const user_id = await getCurrentUserId();

  const { error } = await supabase
    .from('transactions')
    .update({ category })
    .eq('id', id)
    .eq('user_id', user_id);

  if (error) throw handleSupabaseError(error);
}
