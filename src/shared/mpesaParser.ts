// src/shared/mpesaParser.ts
// Comprehensive M-Pesa SMS parser – all known formats + service-layer adapter
// ─────────────────────────────────────────────────────────────────────────────

export type TransactionType =
  | 'send_money'
  | 'paybill'
  | 'till'
  | 'received'
  | 'withdrawal'
  | 'reversal'
  | 'airtime'
  | 'balance_check'
  | 'deposit'
  | 'fuliza'
  | 'pochi'
  | 'loan'
  | 'unknown';

export interface ParsedTransaction {
  // Core identity
  transaction_code: string | null;   // M-Pesa 10-char ref (maps to DB txn_id)
  type:             TransactionType;
  amount:           number | null;

  // Parties
  name:             string | null;   // recipient / sender display name
  phone:            string | null;

  // Business payments
  account:          string | null;   // paybill account number
  business:         string | null;   // business / till name
  paybill:          string | null;
  till:             string | null;

  // Financials
  balance:          number | null;
  transaction_cost: number | null;   // fee

  // Temporal
  date:             string | null;
  time:             string | null;

  // Meta
  category:         string;
  raw_text:         string;
  confidence:       number;          // 0–1
  needs_review:     boolean;
}

// ─── Category keywords ────────────────────────────────────────────────────────
const CATEGORY_MAP: Record<string, string[]> = {
  food:        ['java', 'kfc', 'chicken', 'restaurant', 'food', 'pizza', 'burger', 'cafe', 'canteen'],
  transport:   ['uber', 'bolt', 'matatu', 'bus', 'fare', 'parking', 'fuel', 'petrol', 'expressway'],
  shopping:    ['supermarket', 'naivas', 'quickmart', 'carrefour', 'shop', 'store', 'mall', 'jumia'],
  utilities:   ['kplc', 'kenya power', 'water', 'nairobi water', 'electricity', 'bill'],
  healthcare:  ['hospital', 'clinic', 'pharmacy', 'chemist', 'medical', 'health', 'doctor', 'lab'],
  education:   ['school', 'college', 'university', 'tuition', 'fees', 'exam', 'kcse'],
  airtime:     ['airtime', 'data bundle', 'bundle', 'safaricom data', 'telkom', 'airtel'],
  charity:     ['church', 'tithe', 'offering', 'harambee', 'donation', 'charity'],
  banking:     ['equity', 'kcb', 'cooperative', 'barclays', 'stanbic', 'absa', 'dtb', 'family bank'],
  salary:      ['salary', 'payroll', 'wages', 'stipend', 'allowance'],
  rent:        ['rent', 'landlord', 'caretaker', 'deposit'],
  insurance:   ['nhif', 'nssf', 'insurance', 'jubilee', 'britam'],
};

function inferCategory(text: string, extra?: string | null): string {
  const hay = (text + ' ' + (extra ?? '')).toLowerCase();
  for (const [cat, kws] of Object.entries(CATEGORY_MAP)) {
    if (kws.some(k => hay.includes(k))) return cat;
  }
  return 'other';
}

// ─── Amount helpers ───────────────────────────────────────────────────────────
function parseAmount(raw: string): number | null {
  const clean = raw.replace(/,/g, '');
  const m = clean.match(/[\d]+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function extractFirstAmount(text: string): number | null {
  const m = text.match(/(?:K[Ss][Hh]|KES)\s?([\d,]+\.?\d*)/i);
  return m ? parseAmount(m[1]) : null;
}

// ─── Transaction ID ───────────────────────────────────────────────────────────
export function extractTxnId(text: string): string | null {
  const m = text.match(/\b([A-Z0-9]{10})\b/);
  return m ? m[1] : null;
}

/** Extract ALL txn IDs from a blob (used for batch duplicate checks) */
export function extractAllTxnIds(blob: string): string[] {
  const matches = [...blob.matchAll(/\b([A-Z0-9]{10})\b/g)];
  return [...new Set(matches.map(m => m[1]))];
}

// ─── Phone ────────────────────────────────────────────────────────────────────
function extractPhone(text: string): string | null {
  const m = text.match(/(?:\+?254|0)(7\d{8}|1\d{8})/);
  if (!m) return null;
  return '0' + m[1];
}

// ─── Date & Time ──────────────────────────────────────────────────────────────
function extractDateTime(text: string): { date: string | null; time: string | null } {
  const dateRe = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{1,2}\s+\w{3,9}\s+\d{2,4})/i;
  const timeRe = /(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)/i;
  return {
    date: text.match(dateRe)?.[0]?.trim() ?? null,
    time: text.match(timeRe)?.[0]?.trim() ?? null,
  };
}

// ─── Balance & Fees ───────────────────────────────────────────────────────────
function extractBalance(text: string): number | null {
  const m = text.match(/(?:balance|M-PESA balance)[^K]*(K[Ss][Hh]|KES)\s*([\d,]+\.?\d*)/i);
  return m ? parseAmount(m[2]) : null;
}

function extractFees(text: string): number | null {
  const m = text.match(/(?:Transaction cost|Charge|Fee)[^K]*(K[Ss][Hh]|KES)\s*([\d,]+\.?\d*)/i);
  return m ? parseAmount(m[2]) : null;
}

// ─── Type detection ───────────────────────────────────────────────────────────
interface TypeResult { type: TransactionType; confidence: number }

function detectType(text: string): TypeResult {
  if (/pochi\s+la\s+biashara/i.test(text))
    return { type: 'pochi',         confidence: 0.99 };
  if (/fuliza/i.test(text))
    return { type: 'fuliza',        confidence: 0.99 };
  if (/reversal/i.test(text))
    return { type: 'reversal',      confidence: 0.99 };
  if (/airtime|data\s+bundle/i.test(text))
    return { type: 'airtime',       confidence: 0.98 };
  if (/you\s+have\s+received|money\s+you\s+have\s+received|received\s+from/i.test(text))
    return { type: 'received',      confidence: 0.98 };
  if (/withdraw(?:al)?.*agent|agent.*cash\s+point|agent.*withdraw/i.test(text))
    return { type: 'withdrawal',    confidence: 0.97 };
  if (/pay\s*bill|paybill|business\s+no\.?|paid\s+to.*paybill/i.test(text))
    return { type: 'paybill',       confidence: 0.97 };
  if (/buy\s+goods|till\s+no\.?|merchant|paid\s+to.*till/i.test(text))
    return { type: 'till',          confidence: 0.97 };
  if (/m-?shwari|kcb\s+m-?pesa|loan\s+of|loan\s+repay/i.test(text))
    return { type: 'loan',          confidence: 0.96 };
  if (/deposited\s+at|deposit/i.test(text))
    return { type: 'deposit',       confidence: 0.95 };
  if (/balance\s+inquiry|your\s+m-?pesa\s+balance\s+is/i.test(text))
    return { type: 'balance_check', confidence: 0.97 };
  if (/sent\s+to|you\s+have\s+sent|send\s+money/i.test(text))
    return { type: 'send_money',    confidence: 0.94 };

  // Directional fallbacks
  if (/\+K[Ss][Hh]/i.test(text)) return { type: 'received',  confidence: 0.70 };
  if (/\-K[Ss][Hh]/i.test(text)) return { type: 'send_money', confidence: 0.70 };

  return { type: 'unknown', confidence: 0.30 };
}

// ─── Name extraction ──────────────────────────────────────────────────────────
function extractName(text: string, type: TransactionType): string | null {
  const patterns: RegExp[] = [];

  if (type === 'send_money') {
    patterns.push(
      /sent\s+to\s+([A-Z][A-Za-z\s]{2,40}?)\s+(?:\d{10,12}|on\s|\.|,)/i,
      /to\s+([A-Z][A-Z\s]{2,35}?)\s+(?:07|01|\d{10})/i,
    );
  }
  if (type === 'received') {
    patterns.push(
      /from\s+([A-Z][A-Za-z\s]{2,40}?)\s+(?:\d{10,12}|on\s|\.|,)/i,
      /received\s+from\s+([A-Z][A-Za-z\s]{2,35}?)(?:\s+0[71]|\s+on|\.|,)/i,
    );
  }
  if (type === 'paybill') {
    patterns.push(/paid\s+to\s+([A-Z][A-Za-z\s&\-]{2,40}?)\s+(?:Paybill|Business|on\s)/i);
  }
  if (type === 'till') {
    patterns.push(/paid\s+to\s+([A-Z][A-Za-z\s&\-]{2,40}?)\s+(?:Till|on\s)/i);
  }
  if (type === 'withdrawal') {
    patterns.push(/(?:from|at)\s+([A-Z][A-Za-z\s&\-]{2,40}?)\s+(?:agent|new|on\s)/i);
  }

  // Generic fallbacks
  patterns.push(
    /(?:to|from)\s+([A-Z][A-Z\s]{2,35}?)(?:\s+07|\s+01|\s+Ksh|\s+on\s|\.|,)/i,
    /([A-Z]{2,}(?:\s[A-Z]{2,}){1,3})\s+(?:07|01)/,
  );

  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]?.trim().length > 1) return m[1].trim();
  }
  return null;
}

// ─── Business info ────────────────────────────────────────────────────────────
interface BizInfo {
  business: string | null;
  paybill:  string | null;
  account:  string | null;
  till:     string | null;
}

function extractBusinessInfo(text: string): BizInfo {
  const paybillM = text.match(
    /paid\s+to\s+(.+?)\s+(?:PAYBILL|Business\s+No\.?)\s*(\d+)\s+Account\s+([A-Z0-9\s\-]+?)\s+on/i
  );
  if (paybillM) return { business: paybillM[1].trim(), paybill: paybillM[2].trim(), account: paybillM[3].trim(), till: null };

  const tillM = text.match(/paid\s+to\s+(.+?)\s+(?:TILL\s+No\.?|Buy\s+Goods)\s*(\d+)\s+on/i);
  if (tillM) return { business: tillM[1].trim(), paybill: null, account: null, till: tillM[2].trim() };

  return {
    business: text.match(/paid\s+to\s+([A-Z][A-Za-z\s&\-]{2,35}?)(?:\s+Business|\s+Paybill|\s+on|\s+Ksh|\.)/i)?.[1]?.trim() ?? null,
    paybill:  text.match(/(?:Business\s+No\.?|Paybill\s+No\.?)\s*(\d+)/i)?.[1]?.trim() ?? null,
    account:  text.match(/(?:Account\s+No\.?|Acc\.?)\s*([A-Z0-9\-\s]+?)(?:\s+on|\.|,|$)/i)?.[1]?.trim() ?? null,
    till:     text.match(/(?:Till\s+No\.?)\s*(\d+)/i)?.[1]?.trim() ?? null,
  };
}

// ─── Main parser ──────────────────────────────────────────────────────────────
export function parseMpesa(sms: string): ParsedTransaction {
  const text = sms?.trim() ?? '';
  const { type, confidence } = detectType(text);
  const { date, time } = extractDateTime(text);
  const biz   = extractBusinessInfo(text);
  const name  = extractName(text, type) ?? biz.business;
  const phone = extractPhone(text);

  let finalConf = confidence;
  const txnId  = extractTxnId(text);
  const amount = extractFirstAmount(text);
  if (txnId)  finalConf = Math.min(1, finalConf + 0.05);
  if (amount) finalConf = Math.min(1, finalConf + 0.04);
  if (date)   finalConf = Math.min(1, finalConf + 0.03);
  if (type === 'unknown') finalConf = Math.max(finalConf, 0.2);

  return {
    transaction_code: txnId,
    type,
    amount,
    name,
    phone,
    account:          biz.account,
    business:         biz.business,
    paybill:          biz.paybill,
    till:             biz.till,
    balance:          extractBalance(text),
    transaction_cost: extractFees(text),
    date,
    time,
    category:         inferCategory(text, biz.business ?? name),
    raw_text:         text,
    confidence:       Math.round(finalConf * 100) / 100,
    needs_review:     finalConf < 0.8 || !txnId,
  };
}

// ─── Batch parser ─────────────────────────────────────────────────────────────
export function parseMpesaBatch(blob: string): ParsedTransaction[] {
  if (!blob?.trim()) return [];
  const raw = blob.trim();
  let segments: string[] = [];

  // Strategy 1: split on 10-char transaction codes
  const codeMatches = [...raw.matchAll(/\b([A-Z0-9]{10})\b/g)];
  if (codeMatches.length > 1) {
    const indices = codeMatches.map(m => m.index!);
    segments = indices.map((start, i) =>
      raw.slice(start, indices[i + 1] ?? raw.length).trim()
    );
  }

  // Strategy 2: blank line separation
  if (segments.length < 2) {
    segments = raw.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  }

  // Strategy 3: split on Confirmed. / Completed.
  if (segments.length < 2) {
    segments = raw
      .split(/(?<=(?:Confirmed|Completed)\.)/i)
      .map(s => s.trim())
      .filter(s => s.length > 20);
  }

  if (!segments.length) segments = [raw];

  const results = segments
    .map(s => parseMpesa(s))
    .filter(p => p.type !== 'unknown' || p.amount !== null);

  // Deduplicate by transaction_code
  const seen = new Set<string>();
  return results.filter(p => {
    if (!p.transaction_code) return true;
    if (seen.has(p.transaction_code)) return false;
    seen.add(p.transaction_code);
    return true;
  });
}

// ─── Unit test runner ─────────────────────────────────────────────────────────
// Call from dev console: import { runParserTests } from './mpesaParser'; runParserTests();
export function runParserTests(): void {
  const SAMPLES: { sms: string; expected: Partial<ParsedTransaction> }[] = [
    {
      sms: `QA52HJKL12 Confirmed. Ksh500.00 sent to JOHN DOE 0712345678 on 14/5/26 at 10:30 AM. New M-PESA balance is Ksh4,500.00. Transaction cost, Ksh10.00.`,
      expected: { type: 'send_money', amount: 500, phone: '0712345678' },
    },
    {
      sms: `QB12XYZABC Confirmed. You have received Ksh2,000.00 from JANE WANJIKU 0723456789 on 14/05/2026 at 2:15 PM. New M-PESA balance is Ksh6,500.00.`,
      expected: { type: 'received', amount: 2000, phone: '0723456789' },
    },
    {
      sms: `QC98LMNOPQ Confirmed. Ksh1,500.00 paid to KPLC PAYBILL 888880 Account 12345678 on 14/5/2026 at 8:00 AM. New M-PESA balance is Ksh3,000.00. Transaction cost, Ksh30.00.`,
      expected: { type: 'paybill', paybill: '888880', account: '12345678' },
    },
    {
      sms: `QD45ABCDEF Confirmed. Ksh750.00 paid to NAIVAS SUPERMARKET TILL No. 654321 on 13/5/26 at 4:20 PM. New M-PESA balance is Ksh2,250.00.`,
      expected: { type: 'till', till: '654321' },
    },
    {
      sms: `QE77PQRSTU Confirmed. Ksh5,000.00 withdrawn from JOHN AGENT 0700111222 New Agent: MOMBASA RD on 12/5/26 at 9:00 AM. New M-PESA balance is Ksh1,000.00. Transaction cost, Ksh110.00.`,
      expected: { type: 'withdrawal', amount: 5000 },
    },
    {
      sms: `QF23VWXYZA Confirmed. Your request for reversal of Ksh200.00 for transaction QA52HJKL12 has been fulfilled on 11/5/26. New M-PESA balance is Ksh4,700.00.`,
      expected: { type: 'reversal', amount: 200 },
    },
    {
      sms: `QG11BCDEFG Confirmed. You have bought airtime worth Ksh100.00 for 0712345678 on 10/5/26 at 11:45 AM. New M-PESA balance is Ksh400.00.`,
      expected: { type: 'airtime', amount: 100 },
    },
    {
      sms: `Your M-PESA balance as at 14/5/26 at 3:00 PM is Ksh8,750.00.`,
      expected: { type: 'balance_check', balance: 8750 },
    },
    {
      sms: `QH55GHIJKL Confirmed. Ksh3,000.00 deposited at M-PESA Agent by AGENT 0711222333 on 9/5/26. New M-PESA balance is Ksh9,000.00. Transaction cost, Ksh0.00.`,
      expected: { type: 'deposit', amount: 3000 },
    },
    {
      sms: `QI88MNOPQR Confirmed. Ksh250.00 paid to JAVA HOUSE TILL No. 112233 on 8/5/26 at 1:00 PM. New M-PESA balance is Ksh750.00.`,
      expected: { type: 'till', category: 'food' },
    },
    {
      sms: `QJ99STUVWX Confirmed. Ksh1,200.00 paid to NAIROBI WATER PAYBILL 444400 Account 98765432 on 7/5/26. New M-PESA balance is Ksh300.00.`,
      expected: { type: 'paybill', category: 'utilities' },
    },
    {
      sms: `QK33YZABCD Confirmed. You have received Ksh15,000.00 from EMPLOYER PAYROLL 0799887766 on 6/5/26 at 8:00 AM. New M-PESA balance is Ksh15,000.00.`,
      expected: { type: 'received', amount: 15000, category: 'salary' },
    },
    {
      sms: `QL44EFGHIJ Confirmed. Ksh400.00 sent to MARY NJOROGE 0745678901 on 5/5/26 at 6:30 PM. New M-PESA balance is Ksh600.00. Transaction cost, Ksh10.00.`,
      expected: { type: 'send_money', name: 'MARY NJOROGE' },
    },
    {
      sms: `QM22KLMNOP Confirmed. Ksh50,000.00 paid to KCB BANK PAYBILL 522522 Account 1234567890 on 4/5/26. New M-PESA balance is Ksh0.00. Transaction cost, Ksh105.00.`,
      expected: { type: 'paybill', amount: 50000, category: 'banking' },
    },
    {
      sms: `QN66QRSTUV You have received Ksh800.00 from POCHI LA BIASHARA merchant MAMA MBOGA on 3/5/26 at 10:10 AM.`,
      expected: { type: 'pochi' },
    },
    {
      sms: `QO77WXYZAB Confirmed. Ksh2,500.00 Fuliza loan repayment made on 2/5/26. New M-PESA balance is Ksh500.00.`,
      expected: { type: 'fuliza', amount: 2500 },
    },
    {
      sms: `QP11CDEFGH Confirmed. Ksh100.00 paid to SAFARICOM for Data Bundle on 1/5/26 at 7:00 AM.`,
      expected: { type: 'airtime', category: 'airtime' },
    },
    {
      sms: `QQ88IJKLMN Confirmed. Ksh10,000.00 withdrawn from EQUITY BANK AGENT 0780123456 on 30/4/26 at 2:45 PM. New M-PESA balance is Ksh2,000.00. Transaction cost, Ksh200.00.`,
      expected: { type: 'withdrawal', transaction_cost: 200 },
    },
    {
      sms: `QR22NOPQRS Confirmed. Ksh5,500.00 sent to PETER KAMAU 0756789012 on 29/4/26 at 9:15 AM. New M-PESA balance is Ksh500.00. Transaction cost, Ksh50.00.`,
      expected: { type: 'send_money', amount: 5500, transaction_cost: 50 },
    },
    {
      sms: `QS55STUVWX Confirmed. Ksh3,200.00 paid to NHIF PAYBILL 200400 Account ID123456 on 28/4/26. New M-PESA balance is Ksh1,800.00. Transaction cost, Ksh30.00.`,
      expected: { type: 'paybill', category: 'insurance', paybill: '200400' },
    },
  ];

  let passed = 0;
  let failed = 0;

  console.group('🧪 M-Pesa Parser Tests');
  SAMPLES.forEach(({ sms, expected }, i) => {
    const result = parseMpesa(sms);
    const mismatches: string[] = [];
    for (const [key, val] of Object.entries(expected)) {
      if ((result as unknown as Record<string, unknown>)[key] !== val) {
        mismatches.push(`  ${key}: expected "${val}", got "${(result as unknown as Record<string, unknown>)[key]}"`);
      }
    }
    if (mismatches.length === 0) {
      console.log(`✅ Test ${i + 1} (${result.type}) confidence=${result.confidence}`);
      passed++;
    } else {
      console.warn(`⚠️  Test ${i + 1} partial (${result.type}):\n${mismatches.join('\n')}`);
      failed++;
    }
  });
  console.log(`\n📊 Results: ${passed}/${SAMPLES.length} passed, ${failed} failed`);
  console.groupEnd();
}