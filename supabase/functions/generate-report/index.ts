import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const businessId = body?.business_id as string | undefined;
    const reportType = body?.report_type as string | undefined;
    const dateFrom = body?.date_from as string | undefined;
    const dateTo = body?.date_to as string | undefined;

    if (!businessId || !reportType || !dateFrom || !dateTo) {
      return json({ error: "Missing required report parameters" }, 400);
    }

    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return json({ error: "Invalid date range" }, 400);
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, user_id")
      .eq("id", businessId)
      .single();
    if (businessError || !business) return json({ error: "Business not found" }, 404);

    const isMember = await isBusinessMember(supabase, user.id, businessId);
    if (business.user_id !== user.id && !isMember) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select(`
        id, amount, type, direction, category, txn_date, customer_id,
        name, phone, raw_text, business_id, created_at
      `)
      .eq("business_id", businessId)
      .gte("txn_date", from.toISOString().split("T")[0])
      .lte("txn_date", to.toISOString().split("T")[0]);

    if (txError) throw txError;

    const { data: debts, error: debtError } = await supabase
      .from("debts")
      .select("id, amount, paid_amount, status, due_date")
      .eq("business_id", businessId);

    if (debtError) throw debtError;

    const report = buildReport(reportType, transactions ?? [], debts ?? [], from, to);
    return json({ report_type: reportType, business_id: businessId, date_from: dateFrom, date_to: dateTo, report }, 200);
  } catch (error) {
    console.error("[generate-report]", error);
    return json({ error: "Internal server error" }, 500);
  }
});

async function isBusinessMember(supabase: any, userId: string, businessId: string) {
  const { data, error } = await supabase
    .from("business_members")
    .select("id")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}

function buildReport(
  reportType: string,
  transactions: any[],
  debts: any[],
  from: Date,
  to: Date,
) {
  const credits = transactions.filter(tx => tx.direction === "credit" || tx.type === "received");
  const debits = transactions.filter(tx => tx.direction === "debit" || tx.type === "sent");
  const totalRevenue = credits.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const totalExpenses = debits.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const liabilities = debts.reduce((sum, debt) => sum + Number(debt.amount || 0) - Number(debt.paid_amount || 0), 0);
  const assetBalance = totalRevenue - totalExpenses;
  const equity = assetBalance - liabilities;

  const groupedByDate = groupByPeriod(transactions, from, to, reportType);
  const groupedByCategory = groupBy(transactions, "category");
  const customers = buildCustomerStatements(transactions, debts);

  switch (reportType) {
    case "income_statement":
      return { net_profit: netProfit, revenues: totalRevenue, expenses: totalExpenses, breakdown: groupedByCategory };
    case "balance_sheet":
      return { assets: assetBalance, liabilities, equity, as_of: to.toISOString().split("T")[0] };
    case "cash_flow":
      return {
        inflows: totalRevenue,
        outflows: totalExpenses,
        net_cash_flow: netProfit,
        series: groupedByDate,
      };
    case "customer_statements":
      return { customers };
    case "sales_summary":
      return { total_inflows: totalRevenue, series: groupedByDate };
    case "sales_by_category":
      return { categories: groupedByCategory };
    case "expense_summary":
      return { total_outflows: totalExpenses, series: groupByPeriod(debits, from, to, reportType) };
    case "expenses_by_category":
      return { categories: groupBy(debits, "category") };
    default:
      return { error: "Unknown report type" };
  }
}

function groupBy(items: any[], key: string) {
  return items.reduce((acc, item) => {
    const value = item[key] ?? "other";
    acc[value] = (acc[value] ?? 0) + Number(item.amount || 0);
    return acc;
  }, {} as Record<string, number>);
}

function groupByPeriod(items: any[], from: Date, to: Date, reportType: string) {
  const period = periodForRange(from, to);
  const format = period === "month"
    ? (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    : period === "week"
      ? (date: Date) => `${date.getFullYear()}-W${Math.ceil(((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(date.getFullYear(), 0, 1).getDay() + 1) / 7)}`
      : (date: Date) => date.toISOString().split("T")[0];

  return items.reduce((acc, item) => {
    const when = item.txn_date ? new Date(item.txn_date) : new Date();
    const bucket = format(when);
    acc[bucket] = (acc[bucket] ?? 0) + Number(item.amount || 0);
    return acc;
  }, {} as Record<string, number>);
}

function periodForRange(from: Date, to: Date) {
  const diffDays = Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1;
  if (diffDays > 60) return "month";
  if (diffDays > 14) return "week";
  return "day";
}

function buildCustomerStatements(transactions: any[], debts: any[]) {
  const customers: Record<string, any> = {};
  for (const tx of transactions) {
    const key = tx.customer_id ?? tx.phone ?? tx.name ?? "Unknown";
    const entry = customers[key] ?? { customer_id: tx.customer_id, label: tx.name || tx.phone || "Unknown", transactions: [], total: 0 };
    entry.transactions.push({
      id: tx.id,
      date: tx.txn_date,
      amount: Number(tx.amount || 0),
      direction: tx.direction,
      category: tx.category,
      note: tx.raw_text,
    });
    entry.total += Number(tx.amount || 0);
    customers[key] = entry;
  }

  for (const debt of debts) {
    const key = debt.customer_id ?? debt.phone ?? debt.name ?? "Unknown";
    const entry = customers[key] ?? { customer_id: debt.customer_id, label: debt.name || debt.phone || "Unknown", transactions: [], total: 0, debts: [] };
    entry.debts = entry.debts ?? [];
    entry.debts.push({ id: debt.id, amount: Number(debt.amount || 0), paid_amount: Number(debt.paid_amount || 0), status: debt.status, due_date: debt.due_date });
    customers[key] = entry;
  }

  return Object.values(customers);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
