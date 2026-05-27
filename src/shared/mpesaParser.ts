// src/shared/mpesaParser.ts
// ─────────────────────────────────────────────────────────────────────────────
// M-Pesa SMS Parser – v5
//
// Changes over v4:
//   • inferCategory: type-first routing before any keyword scan
//     - balance_check  → 'other'     (never transport)
//     - fuliza_draw    → 'fuliza'
//     - fuliza_repay   → 'fuliza'
//     - airtime        → 'airtime'
//     - withdrawal     → 'cash'  (new category)
//     - received       → defers to keyword scan (salary / charity / etc.)
//     - send_money     → defers to keyword scan
//     - paybill        → PAYBILL_MAP first, then keyword scan
//     - till           → keyword scan (shopping is now the till default)
//   • CATEGORY_MAP transport: drastically tightened — only explicit transport
//     merchants/keywords; removed 'oil', 'total', 'shell' (too generic)
//   • CATEGORY_MAP shopping: till default via type routing, not keyword fallback
//   • CATEGORY_MAP added 'cash' for ATM/agent withdrawals
//   • PAYBILL_MAP expanded with common Kenyan billers
//   • inferCategory: till type defaults to 'shopping' before keyword scan
//   • inferCategory: send_money with personal name defaults to 'transfer'
//     (new category) rather than 'other'
//   • inferCategoryAI: updated category list to include 'cash' and 'transfer'
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
  | 'fuliza_draw'
  | 'fuliza_repay'
  | 'pochi'
  | 'loan'
  | 'unknown';

export interface ParsedTransaction {
  transaction_code:  string | null;
  type:              TransactionType;
  amount:            number | null;
  name:              string | null;
  phone:             string | null;
  account:           string | null;
  business:          string | null;
  paybill:           string | null;
  till:              string | null;
  balance:           number | null;
  transaction_cost:  number | null;
  fuliza_fee:        number | null;
  fuliza_total_due:  number | null;
  date:              string | null;
  time:              string | null;
  category:          string;
  raw_text:          string;
  direction:         'credit' | 'debit';
  business_id?:      string | null;
  confidence:        number;
  needs_review:      boolean;
}

export interface BatchSummary {
  total:       number;
  totalIn:     number;
  totalOut:    number;
  totalFees:   number;
  totalFuliza: number;
  byType:      Record<string, number>;
  byCategory:  Record<string, number>;
}

// ─── Category keywords ────────────────────────────────────────────────────────
// IMPORTANT: these are only reached AFTER type-first routing in inferCategory.
// Keep each list tight — prefer specific merchant names over generic words.
const CATEGORY_MAP: Record<string, string[]> = {
  food: [
    'java', 'kfc', 'chicken inn', 'restaurant', 'food court', 'pizza', 'burger',
    'cafe', 'canteen', 'dining', 'bakery', 'snack', 'mama mboga', 'chips',
    'nyama choma', 'roast', 'grill', 'juice bar', 'milkshake', 'nairobi kitchen',
    'artcaffe', 'galito', 'steers', 'debonairs', 'eat out', 'kenchic',
    'samuel kamau butchery', 'carnivor', 'tamarind',
  ],

  // ── TRANSPORT: only explicit transport merchants/keywords ──────────────────
  // Removed: 'oil', 'total', 'shell', 'bus' (too generic/short)
  transport: [
    'uber', 'bolt ride', 'little cab', 'faras', 'swvl',
    'matatu', 'bus fare', 'stage fare',
    'parking', 'e-parking', 'nairobi parking',
    'fuel station', 'petrol station',
    'expressway', 'nairobi expressway', 'westlands expressway',
    'boda boda', 'boda',
    'taxi',
    'tuk tuk',
    'shuttle',
    'sgr', 'madaraka express',
    'train fare',
    'lake oil', 'total energies', 'total petrol',
    'shell petrol', 'rubis', 'kenol', 'vivo energy', 'hass petroleum',
    'nock', 'oilcom', 'gulf energy', 'africa oil',
  ],

  shopping: [
    'naivas', 'quickmart', 'carrefour', 'cleanshelf', 'tuskys', 'uchumi',
    'game store', 'choppies', 'eastmatt', 'market', 'supermarket',
    'jumia', 'kilimall', 'masoko', 'jiji',
    'hardware', 'wholesale', 'retail shop', 'vendor',
    'clothing', 'fashion', 'shoes', 'boutique', 'wear',
    'electronics', 'phone shop', 'accessories',
    'bookshop', 'stationery',
  ],

  utilities: [
    'kplc', 'kenya power', 'nairobi water', 'nwsc', 'nawasco',
    'mombasa water', 'stima', 'electricity token',
    'safaricom home', 'zuku', 'faiba', 'liquid telecom', 'jamii telecom',
    'dstv', 'gotv', 'startimes', 'azam',
    'ardhisasa', 'county bill', 'county rate', 'landlord',
    'co-operative bank',
  ],

  healthcare: [
    'hospital', 'clinic', 'pharmacy', 'chemist', 'medical centre',
    'health centre', 'doctor', 'lab', 'dispensary', 'nursing home',
    'dental', 'optical', 'nhif',
    'aga khan', 'gertrudes', 'nairobi hospital', 'm.p shah', 'avenue hospital',
    'kenyatta national', 'mater hospital', 'coptic', 'karen hospital',
    'mediplus', 'goodlife',
  ],

  education: [
    'school fees', 'college fees', 'university', 'tuition', 'exam fees',
    'kcse', 'kindergarten', 'nursery school', 'academy', 'institute', 'tvet', 'knec',
    'helb', 'bursary',
  ],

  airtime: [
    'airtime', 'data bundle', 'safaricom data', 'airtel data',
    'telkom data', 'faiba data',
  ],

  charity: [
    'church', 'tithe', 'offering', 'harambee', 'donation', 'charity',
    'mosque', 'temple', 'fundraising', 'sadaka', 'zakat', 'campaign',
  ],

  banking: [
    'equity bank', 'kcb', 'cooperative bank', 'co-op bank', 'barclays', 'absa',
    'stanbic', 'dtb', 'family bank', 'ncba', 'i&m bank', 'prime bank',
    'postbank', 'sidian', 'pesalink', 'ecobank', 'loop',
    'standard chartered', 'citibank', 'guardian bank',
  ],

  salary: [
    'salary', 'payroll', 'wages', 'stipend', 'allowance',
    'commission', 'bonus', 'overtime',
  ],

  rent: [
    'rent', 'caretaker', 'bedsitter', 'apartment rent',
    'service charge', 'plot rent', 'lease',
  ],

  insurance: [
    'nhif', 'nssf', 'jubilee insurance', 'britam', 'cic insurance',
    'aar insurance', 'resolution insurance', 'pioneer insurance',
    'madison insurance', 'heritage insurance', 'mayfair',
    'aon kenya', 'kenindia',
  ],

  savings: [
    'ziidi', 'mshwari', 'kcb mpesa', 'mali', 'chumz',
    'money market', 'mmf', 'sacco', 'table banking',
    'investment', 'lock savings',
  ],

  fuliza: ['fuliza'],

  // cash: ATM / agent withdrawals — populated via type routing, not keywords
  cash: [
    'atm', 'cash withdrawal', 'agent withdrawal', 'cash point',
  ],

  // transfer: person-to-person send money — populated via type routing
  transfer: [],
};

// ─── Paybill → category map ───────────────────────────────────────────────────
// Add any new paybill numbers here. These fire before keyword scanning.
const PAYBILL_MAP: Record<string, string> = {
  // ── Power / water ──
  '888880': 'utilities',   // KPLC Prepaid
  '888888': 'utilities',   // KPLC Postpaid
  '300300': 'utilities',   // Nairobi Water
  '303030': 'utilities',   // Nairobi Water (alt)
  '321321': 'utilities',   // Nawasco
  '320320': 'utilities',   // Zuku
  '329329': 'utilities',   // DStv
  '444400': 'utilities',   // GoTV
  '4045047': 'utilities',  // Startimes

  // ── Banks ──
  '400222': 'banking',     // Co-op Bank
  '200222': 'banking',     // NCBA
  '522522': 'banking',     // KCB
  '542542': 'banking',     // Equity
  '303303': 'banking',     // Equity alt
  '700500': 'banking',     // Family Bank
  '100400': 'banking',     // Standard Chartered
  '911911': 'banking',     // Stanbic

  // ── Insurance / govt ──
  '200100': 'insurance',   // NHIF
  '333300': 'insurance',   // NSSF
  '222222': 'utilities',   // eCitizen / Govt Services
  '206206': 'utilities',   // Huduma
  '400500': 'education',   // HELB

  // ── Telco ──
  '220220': 'utilities',   // Safaricom Home Fibre
  '100100': 'airtime',     // Airtel Money
};

// ─── Keyword category (sync) ──────────────────────────────────────────────────
export function inferCategory(
  text: string,
  extra?: string | null,
  paybill?: string | null,
  type?: TransactionType,
): string {
  // ── Step 1: Type-first routing (highest accuracy, no keyword needed) ───────
  if (type) {
    switch (type) {
      // These types have a definitive category regardless of merchant name
      case 'balance_check': return 'other';
      case 'fuliza_draw':   return 'fuliza';
      case 'fuliza_repay':  return 'fuliza';
      case 'airtime':       return 'airtime';
      case 'reversal':      return 'other';
      case 'withdrawal':    return 'cash';
      case 'deposit':       return 'banking';
      case 'loan':          return 'savings';

      // till: almost always shopping — only override if keyword says otherwise
      case 'till': {
        const hayTill = `${text} ${extra ?? ''}`.toLowerCase();
        // Check for non-shopping till merchants (fuel stations, etc.)
        for (const kw of CATEGORY_MAP.transport) {
          if (hayTill.includes(kw)) return 'transport';
        }
        for (const kw of CATEGORY_MAP.food) {
          if (hayTill.includes(kw)) return 'food';
        }
        return 'shopping'; // default for till
      }

      // send_money: person-to-person = transfer; check for specific payees
      case 'send_money': {
        const haySend = `${text} ${extra ?? ''}`.toLowerCase();
        for (const kw of CATEGORY_MAP.savings) {
          if (haySend.includes(kw)) return 'savings';
        }
        for (const kw of CATEGORY_MAP.charity) {
          if (haySend.includes(kw)) return 'charity';
        }
        for (const kw of CATEGORY_MAP.banking) {
          if (haySend.includes(kw)) return 'banking';
        }
        return 'transfer'; // default for send money to a person
      }

      // received: could be salary, charity donation, etc.
      case 'received': {
        const hayRecv = `${text} ${extra ?? ''}`.toLowerCase();
        for (const kw of CATEGORY_MAP.salary) {
          if (hayRecv.includes(kw)) return 'salary';
        }
        for (const kw of CATEGORY_MAP.charity) {
          if (hayRecv.includes(kw)) return 'charity';
        }
        return 'other'; // generic receive
      }

      // paybill + pochi: fall through to paybill map + keyword scan below
      case 'paybill':
      case 'pochi':
        break;

      // unknown: fall through to keyword scan
      case 'unknown':
        break;
    }
  }

  // ── Step 2: Paybill number map (very high accuracy) ───────────────────────
  if (paybill && PAYBILL_MAP[paybill]) return PAYBILL_MAP[paybill];

  // ── Step 3: Keyword scan (ordered — more specific categories first) ────────
  const hay = `${text} ${extra ?? ''}`.toLowerCase();

  // Check in priority order — put specific categories before broad ones
  const ORDER = [
    'fuliza', 'airtime', 'salary', 'savings', 'insurance',
    'banking', 'healthcare', 'education', 'utilities',
    'rent', 'charity', 'food', 'transport', 'shopping',
    'cash', 'transfer',
  ];

  for (const cat of ORDER) {
    const kws = CATEGORY_MAP[cat];
    if (kws && kws.some(k => k.length > 3 && hay.includes(k))) return cat;
  }

  return 'other';
}

// ─── AI categorization (async, calls Claude API) ─────────────────────────────
// Falls back silently to existing keyword categories on any error.
export async function inferCategoryAI(
  transactions: ParsedTransaction[],
): Promise<ParsedTransaction[]> {
  if (!transactions.length) return transactions;

  const prompt = `You are an M-Pesa transaction categorizer for Kenya.
Assign the best category to each transaction from this list:
food, transport, shopping, utilities, healthcare, education, airtime, charity,
banking, salary, rent, insurance, savings, fuliza, cash, transfer, other

Rules:
- balance_check type → always "other"
- withdrawal type → always "cash"
- send_money to a person (not a business) → "transfer"
- till/buy goods → "shopping" unless clearly food or transport merchant
- fuliza_draw or fuliza_repay → always "fuliza"
- airtime type → always "airtime"

Return ONLY a JSON array – no markdown fences, no explanation:
[{"index": 0, "category": "food"}, ...]

Transactions:
${transactions
  .map(
    (t, i) =>
      `${i}: ${t.type} | ${t.name ?? ''} | ${t.business ?? ''} | KES ${t.amount ?? 0} | ${t.raw_text.slice(0, 80)}`,
  )
  .join('\n')}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`API ${res.status}`);

    const data: { content: Array<{ type: string; text?: string }> } = await res.json();
    const raw = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text ?? '')
      .join('');

    const clean = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
    const parsed: Array<{ index: number; category: string }> = JSON.parse(clean);

    if (!Array.isArray(parsed)) throw new Error('Unexpected AI response shape');

    return transactions.map((t, i) => {
      const hit = parsed.find(p => p.index === i);
      return hit && typeof hit.category === 'string'
        ? { ...t, category: hit.category }
        : t;
    });
  } catch {
    return transactions;
  }
}

export function isCredit(type: string): boolean {
  return ['received', 'deposit', 'reversal'].includes(type);
}

// ─── Amount helpers ───────────────────────────────────────────────────────────
function parseAmount(raw: string): number | null {
  const clean = raw.replace(/,/g, '');
  const m = clean.match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function extractFirstAmount(text: string): number | null {
  const m =
    text.match(/K[Ss][Hh]\s?([\d,]+\.?\d*)/i) ??
    text.match(/KES\s?([\d,]+\.?\d*)/i);
  return m ? parseAmount(m[1]) : null;
}

// ─── Transaction ID ───────────────────────────────────────────────────────────
export const TXN_CODE_RE = /(?<![A-Z0-9])([A-Z]{1,3}[A-Z0-9]{7,9})(?![A-Z0-9])/g;

export function extractTxnId(text: string): string | null {
  TXN_CODE_RE.lastIndex = 0;
  const m = TXN_CODE_RE.exec(text);
  TXN_CODE_RE.lastIndex = 0;
  if (!m) return null;
  return m[1].length === 10 ? m[1] : null;
}

export function extractAllTxnIds(blob: string): string[] {
  TXN_CODE_RE.lastIndex = 0;
  const matches = [...blob.matchAll(TXN_CODE_RE)];
  return [...new Set(matches.map(m => m[1]).filter(id => id.length === 10))];
}

export function normalizeCode(code: string | null): string {
  if (!code) return '';
  return code.replace(/[\s\-]/g, '').toUpperCase();
}

// ─── Phone extraction ─────────────────────────────────────────────────────────
export function extractPhone(text: string): string | null {
  const masked = text.match(/(?:\+?254|0)(7\d{2}|\d{2})\*{2,5}(\d{3})/);
  if (masked) return `0${masked[1]}***${masked[2]}`;
  const full = text.match(/(?:\+?254|0)(7\d{8}|1\d{8})/);
  return full ? `0${full[1]}` : null;
}

// ─── Date & time ──────────────────────────────────────────────────────────────
function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) {
    const [y, m, d] = raw.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parts = raw.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    let day   = parts[0].padStart(2, '0');
    let month = parts[1].padStart(2, '0');
    let year  = parts[2];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return null;
}

function extractDateTime(text: string): { date: string | null; time: string | null } {
  const dateM =
    text.match(/\b(\d{4}-\d{1,2}-\d{1,2})\b/i) ??
    text.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/i) ??
    text.match(/\b(\d{1,2}\s+\w{3,9}\s+\d{2,4})\b/i);
  const timeM = text.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)/i);
  const rawDate = dateM?.[1]?.trim() ?? null;
  return {
    date: rawDate ? normalizeDate(rawDate) : null,
    time: timeM?.[1]?.trim() ?? null,
  };
}

// ─── Balance & fees ───────────────────────────────────────────────────────────
function extractBalance(text: string): number | null {
  const m =
    text.match(/(?:new\s+m-?pesa\s+balance|m-?pesa\s+balance|m-?pesa\s+account)\s*(?::|is)?\s*K[Ss][Hh]?\s*([\d,]+\.?\d*)/i) ??
    text.match(/balance\s+(?:is\s+)?K?[Ss][Hh]?\s*([\d,]+\.?\d*)/i) ??
    text.match(/balance\s+is\s+([\d,]+\.?\d*)/i);
  return m ? parseAmount(m[1]) : null;
}

function extractFees(text: string): number | null {
  const m = text.match(/(?:Transaction cost|Charge|Fee)[,:]?\s*K[Ss][Hh]?\s?([\d,]+\.?\d*)/i);
  return m ? parseAmount(m[1]) : null;
}

function extractFulizaFee(text: string): number | null {
  const m = text.match(/Access Fee(?:\s+charged)?\s+K[Ss][Hh]?\s?([\d,]+\.?\d*)/i);
  return m ? parseAmount(m[1]) : null;
}

function extractFulizaTotalDue(text: string): number | null {
  const m = text.match(/Total Fuliza M-PESA outstanding amount is K[Ss][Hh]?\s?([\d,]+\.?\d*)/i);
  return m ? parseAmount(m[1]) : null;
}

// ─── Type detection ───────────────────────────────────────────────────────────
interface TypeResult { type: TransactionType; confidence: number }

function detectType(text: string): TypeResult {
  const t = text;

  if (/fully\s+pay.{0,40}outstanding\s+Fuliza|Fuliza.*repay|repaid.*Fuliza/i.test(t))
    return { type: 'fuliza_repay', confidence: 0.99 };
  if (
    /Fuliza M-PESA amount is K[Ss][Hh]/i.test(t) ||
    /you\s+have\s+used\s+Fuliza/i.test(t) ||
    /Access Fee charged.*Fuliza|Fuliza.*Access Fee/i.test(t)
  ) return { type: 'fuliza_draw', confidence: 0.99 };

  if (/pochi\s+la\s+biashara/i.test(t))  return { type: 'pochi',         confidence: 0.99 };
  if (/reversal/i.test(t))               return { type: 'reversal',      confidence: 0.99 };
  if (/airtime|data\s+bundle/i.test(t))  return { type: 'airtime',       confidence: 0.98 };

  if (/you\s+have\s+received|money\s+you\s+have\s+received|received\s+K[Ss][Hh].{0,20}from/i.test(t))
    return { type: 'received', confidence: 0.98 };

  if (/withdrew?|withdraw(?:al)?.*agent|agent.*cash\s+point|agent.*withdraw/i.test(t))
    return { type: 'withdrawal', confidence: 0.97 };

  if (/pay\s*bill|paybill|business\s+no\.?|for\s+account\s+\d|sent\s+to\s+.{2,40}\s+for\s+account/i.test(t))
    return { type: 'paybill', confidence: 0.97 };

  if (/buy\s+goods|till\s+no\.?|merchant|paid\s+to.*till/i.test(t))
    return { type: 'till', confidence: 0.97 };

  if (/m-?shwari|kcb\s+m-?pesa|loan\s+of|loan\s+repay/i.test(t))
    return { type: 'loan', confidence: 0.96 };

  if (/deposited\s+at|cash\s+deposit/i.test(t))
    return { type: 'deposit', confidence: 0.95 };

  if (/balance\s+(?:inquiry|as\s+at)|m-?pesa\s+balance\s+(?:as\s+at|is)/i.test(t))
    return { type: 'balance_check', confidence: 0.97 };

  if (/sent\s+to|you\s+have\s+sent|send\s+money/i.test(t))
    return { type: 'send_money', confidence: 0.94 };
  if (/give\s+K[Ss][Hh].+cash\s+to/i.test(t))
    return { type: 'send_money', confidence: 0.92 };

  if (/paid\s+to\s+[A-Z]/i.test(t)) return { type: 'till',       confidence: 0.80 };
  if (/\+K[Ss][Hh]/i.test(t))       return { type: 'received',   confidence: 0.70 };
  if (/\-K[Ss][Hh]/i.test(t))       return { type: 'send_money', confidence: 0.70 };

  return { type: 'unknown', confidence: 0.30 };
}

// ─── Name extraction ──────────────────────────────────────────────────────────
function extractName(text: string, type: TransactionType): string | null {
  const patterns: RegExp[] = [];

  switch (type) {
    case 'send_money':
      patterns.push(
        /sent\s+to\s+([A-Z][A-Za-z\s]{2,35}?)(?=\s+(?:07|01|\+?254|\d{10})|\s+on\s|\.|,)/i,
        /cash\s+to\s+([A-Z][A-Za-z\s&]{2,35}?)(?:\s+on\s|\s+New\s|$)/i,
        /to\s+([A-Z][A-Z\s]{2,35}?)\s+(?:07|01|\+?254)/i,
      );
      break;
    case 'received':
      patterns.push(
        /from\s+([A-Z][A-Za-z\s]{2,35}?)(?=\s+(?:07|01|\+?254|\d{10})|\s+on\s|\.|,)/i,
        /received\s+from\s+([A-Z][A-Za-z\s]{2,35}?)(?:\s+0[71]|\s+on|\.|,)/i,
      );
      break;
    case 'paybill':
      patterns.push(
        /sent\s+to\s+([A-Z][A-Za-z\s&\-]{2,40}?)\s+for\s+account/i,
        /paid\s+to\s+([A-Z][A-Za-z\s&\-]{2,40}?)\s+(?:Paybill|Business|on\s)/i,
      );
      break;
    case 'till':
      patterns.push(/paid\s+to\s+([A-Z][A-Za-z\s&\-\.]{2,40}?)\s+(?:Till|on\s|\.|$)/i);
      break;
    case 'withdrawal':
      patterns.push(/(?:from|at)\s+([A-Z][A-Za-z\s&\-]{2,40}?)\s+(?:agent|new|on\s)/i);
      break;
    case 'fuliza_draw':
      patterns.push(
        /paid\s+to\s+([A-Z][A-Za-z\s&\-]{2,40}?)\s+(?:on\s|\.|,)/i,
        /sent\s+to\s+([A-Z][A-Za-z\s]{2,35}?)(?=\s+(?:07|01|\+?254|\d{10})|\s+on\s|\.|,)/i,
      );
      break;
    case 'fuliza_repay':
      return null;
  }

  patterns.push(
    /(?:to|from)\s+([A-Z][A-Z\s]{2,35}?)(?:\s+07|\s+01|\s+K[Ss][Hh]|\s+on\s|\.|,)/i,
    /([A-Z]{2,}(?:\s+[A-Z]{2,}){1,3})\s+(?:07|01)/,
  );

  for (const p of patterns) {
    const m = text.match(p);
    const candidate = m?.[1]?.trim().replace(/\s{2,}/g, ' ');
    if (candidate && candidate.length > 1 && !/^\d/.test(candidate)) return candidate;
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
  const paybillSent = text.match(
    /sent\s+to\s+(.+?)\s+for\s+account\s+([A-Z0-9\s\-]+?)(?:\s+on\s|\s+New|\.|$)/i,
  );
  if (paybillSent) {
    return { business: paybillSent[1].trim(), paybill: null, account: paybillSent[2].trim(), till: null };
  }

  const paybillFull = text.match(
    /paid\s+to\s+(.+?)\s+(?:PAYBILL|Business\s+No\.?)\s*(\d+)\s+Account\s+([A-Z0-9\s\-]+?)\s+on/i,
  );
  if (paybillFull) {
    return {
      business: paybillFull[1].trim(),
      paybill:  paybillFull[2].trim(),
      account:  paybillFull[3].trim(),
      till:     null,
    };
  }

  const tillFull = text.match(/paid\s+to\s+(.+?)\s+(?:TILL\s+No\.?|Buy\s+Goods)\s*(\d+)\s+on/i);
  if (tillFull) {
    return { business: tillFull[1].trim(), paybill: null, account: null, till: tillFull[2].trim() };
  }

  return {
    business:
      text.match(
        /paid\s+to\s+([A-Z][A-Za-z\s&\-\.]{2,35}?)(?:\s+Business|\s+Paybill|\s+on|\s+K[Ss][Hh]|\.)/i,
      )?.[1]?.trim() ?? null,
    paybill:
      text.match(/(?:Business\s+No\.?|Paybill\s+No\.?)\s*(\d+)/i)?.[1]?.trim() ?? null,
    account:
      text.match(/(?:Account\s+No\.?|Acc\.?)\s*([A-Z0-9\-\s]+?)(?:\s+on|\.|,|$)/i)?.[1]?.trim() ?? null,
    till:
      text.match(/(?:Till\s+No\.?)\s*(\d+)/i)?.[1]?.trim() ?? null,
  };
}

// ─── Main parser ──────────────────────────────────────────────────────────────
export function parseMpesa(sms: string): ParsedTransaction {
  const text = sms?.trim() ?? '';

  if (/failed|insufficient\s+funds|invalid\s+pin|transaction\s+declined/i.test(text)) {
    return {
      transaction_code:  extractTxnId(text),
      type:              'unknown',
      amount:            extractFirstAmount(text),
      name:              null,
      phone:             null,
      account:           null,
      business:          null,
      paybill:           null,
      till:              null,
      balance:           extractBalance(text),
      transaction_cost:  null,
      fuliza_fee:        null,
      fuliza_total_due:  null,
      date:              extractDateTime(text).date,
      time:              extractDateTime(text).time,
      category:          'other',
      raw_text:          text,
      direction:         'debit',
      confidence:        0.1,
      needs_review:      true,
    };
  }

  const { type, confidence } = detectType(text);
  const { date, time }    = extractDateTime(text);
  const biz               = extractBusinessInfo(text);
  const name              = extractName(text, type) ?? biz.business;
  const phone             = extractPhone(text);
  const txnId             = extractTxnId(text);
  const amount            = extractFirstAmount(text);
  const bal               = extractBalance(text);
  const fee               = extractFees(text);
  const fFee              = extractFulizaFee(text);
  const fDue              = extractFulizaTotalDue(text);

  let conf = confidence;
  if (txnId)  conf = Math.min(0.99, conf + 0.05);
  if (amount) conf = Math.min(0.99, conf + 0.04);
  if (date)   conf = Math.min(0.99, conf + 0.03);
  if (name)   conf = Math.min(0.99, conf + 0.02);
  if (type === 'unknown') conf = Math.max(conf, 0.20);

  return {
    transaction_code:  txnId,
    type,
    amount,
    name,
    phone,
    account:           biz.account,
    business:          biz.business,
    paybill:           biz.paybill,
    till:              biz.till,
    balance:           bal,
    transaction_cost:  fee,
    fuliza_fee:        fFee,
    fuliza_total_due:  fDue,
    date,
    time,
    // ── Pass type into inferCategory for type-first routing ──────────────────
    category: inferCategory(text, biz.business ?? name, biz.paybill, type),
    raw_text:          text,
    direction:         isCredit(type) ? 'credit' : 'debit',
    confidence:        Math.round(conf * 100) / 100,
    needs_review:      conf < 0.80 || !txnId,
  };
}

// ─── Batch parser ─────────────────────────────────────────────────────────────
export function parseMpesaBatch(blob: string): ParsedTransaction[] {
  if (!blob?.trim()) return [];
  const raw = blob.trim();
  let segments: string[] = [];

  TXN_CODE_RE.lastIndex = 0;
  const codeMatches = [...raw.matchAll(TXN_CODE_RE)].filter(
    m =>
      m[1].length === 10 &&
      /Confirmed|Completed/i.test(raw.slice(m.index!, m.index! + 200)),
  );
  if (codeMatches.length > 1) {
    const indices = codeMatches.map(m => m.index!);
    segments = indices.map((start, i) =>
      raw.slice(start, indices[i + 1] ?? raw.length).trim(),
    );
  }

  if (segments.length < 2) {
    segments = raw.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  }

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

  const seen = new Set<string>();
  return results.filter(p => {
    if (!p.transaction_code) return true;
    const key = normalizeCode(p.transaction_code);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Summary stats ────────────────────────────────────────────────────────────
export function summarizeBatch(txns: ParsedTransaction[]): BatchSummary {
  const inTypes  = new Set<TransactionType>(['received', 'deposit', 'reversal']);
  const outTypes = new Set<TransactionType>([
    'send_money', 'paybill', 'till', 'withdrawal', 'airtime', 'fuliza_repay', 'pochi',
  ]);

  const summary: BatchSummary = {
    total:       txns.length,
    totalIn:     0,
    totalOut:    0,
    totalFees:   0,
    totalFuliza: 0,
    byType:      {},
    byCategory:  {},
  };

  for (const t of txns) {
    const amt = t.amount ?? 0;
    if (inTypes.has(t.type))              summary.totalIn     += amt;
    if (outTypes.has(t.type))             summary.totalOut    += amt;
    if (t.transaction_cost)               summary.totalFees   += t.transaction_cost;
    if (t.type === 'fuliza_draw' && amt)  summary.totalFuliza += amt;

    summary.byType[t.type]         = (summary.byType[t.type]         ?? 0) + 1;
    summary.byCategory[t.category] = (summary.byCategory[t.category] ?? 0) + 1;
  }

  return summary;
}

// ─── Export helpers ───────────────────────────────────────────────────────────
const CSV_HEADERS = [
  'Ref Code', 'Type', 'Amount (KES)', 'Name', 'Phone', 'Business', 'Account',
  'Paybill', 'Till', 'Balance', 'Fee', 'Fuliza Fee', 'Date', 'Time', 'Category', 'Confidence',
];

function txnToRow(t: ParsedTransaction): string[] {
  return [
    t.transaction_code   ?? '',
    t.type,
    t.amount?.toString() ?? '',
    t.name               ?? '',
    t.phone              ?? '',
    t.business           ?? '',
    t.account            ?? '',
    t.paybill            ?? '',
    t.till               ?? '',
    t.balance?.toString()          ?? '',
    t.transaction_cost?.toString() ?? '',
    t.fuliza_fee?.toString()       ?? '',
    t.date               ?? '',
    t.time               ?? '',
    t.category,
    t.confidence.toString(),
  ];
}

const UTF8_BOM = '\uFEFF';

export function exportToCSV(txns: ParsedTransaction[], filename = 'mpesa_transactions.csv'): void {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines  = [
    CSV_HEADERS.map(escape).join(','),
    ...txns.map(t => txnToRow(t).map(escape).join(',')),
  ];
  const blob = new Blob([UTF8_BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

export function exportToExcel(
  txns: ParsedTransaction[],
  filename = 'mpesa_transactions.xls',
): void {
  const lines = [
    CSV_HEADERS.join('\t'),
    ...txns.map(t => txnToRow(t).join('\t')),
  ];
  const blob = new Blob([UTF8_BOM + lines.join('\r\n')], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}