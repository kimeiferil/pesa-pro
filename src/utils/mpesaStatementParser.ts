import * as pdfjs from 'pdfjs-dist';
import { parseMpesa, ParsedTransaction } from '../shared/mpesaParser';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export interface StatementRow {
  receiptNo: string;
  completionTime: string;
  details: string;
  status: string;
  paidIn: number;
  withdrawn: number;
  balance: number;
}

/**
 * Extracts text from a password-protected Safaricom M-PESA statement PDF.
 */
export async function extractTextFromPDF(pdfArrayBuffer: ArrayBuffer, password: string): Promise<string> {
  const loadingTask = pdfjs.getDocument({
    data: pdfArrayBuffer,
    password: password,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    fullText += strings.join(' ') + '\n';
  }

  return fullText;
}

/**
 * Parses the raw text extracted from the PDF into transaction objects.
 */
export function parseMpesaStatement(rawText: string): ParsedTransaction[] {
  // Regex to match Safaricom statement rows
  // Typical row: QJX8P2K1 | 01/05/2025 14:32:00 | Payment to Naivas Supermarket | Completed | - | 650.00 | 12,450.00
  // Note: PDF text extraction might not have pipes, just spaces.

  // Pattern: ReceiptNo (10 chars) Date (DD/MM/YYYY) Time (HH:mm:ss) Details Status PaidIn Withdrawn Balance
  const rowRegex = /([A-Z0-9]{10})\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s+(.+?)\s+(Completed|Failed|Cancelled)\s+([\d,\.\-]+)\s+([\d,\.\-]+)\s+([\d,\.\-]+)/g;

  const transactions: ParsedTransaction[] = [];
  let match;

  while ((match = rowRegex.exec(rawText)) !== null) {
    const [_, receiptNo, completionTime, details, status, paidInRaw, withdrawnRaw, balanceRaw] = match;

    if (status !== 'Completed') continue;

    const paidIn = parseAmount(paidInRaw);
    const withdrawn = parseAmount(withdrawnRaw);
    const balance = parseAmount(balanceRaw);

    const amount = paidIn > 0 ? paidIn : withdrawn;
    const type = paidIn > 0 ? 'received' : 'paybill'; // Default to paybill for outflows in statement

    // We generate a "fake" SMS string to leverage the existing robust parseMpesa logic for name/category extraction
    // Or we manually map. Safaricom statements are very structured.

    // Construct a synthetic SMS that parseMpesa can handle
    const syntheticSms = `${receiptNo} Confirmed. ${paidIn > 0 ? 'You have received' : 'Paid to'} KES ${amount.toFixed(2)} ${details} on ${completionTime}. New M-PESA balance is KES ${balance.toFixed(2)}.`;

    const parsed = parseMpesa(syntheticSms);

    // Override specific fields from the statement which is more accurate
    parsed.transaction_code = receiptNo;
    const [datePart, timePart] = completionTime.split(' ');
    parsed.date = formatDate(datePart);
    parsed.time = timePart;
    parsed.balance = balance;
    parsed.amount = amount;

    transactions.push(parsed);
  }

  return transactions;
}

function parseAmount(val: string): number {
  if (!val || val === '-' || val === '0') return 0;
  return parseFloat(val.replace(/,/g, ''));
}

function formatDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/');
  return `${y}-${m}-${d}`;
}
