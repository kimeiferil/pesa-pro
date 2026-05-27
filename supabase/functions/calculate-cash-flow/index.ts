import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { business_id } = await req.json();
    if (!business_id) return json({ error: "business_id required" }, 400);

    const { data: biz } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("id", business_id)
      .eq("user_id", user.id)
      .single();
    if (!biz) return json({ error: "Business not found" }, 404);

    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { data: txns, error: txErr } = await supabase
      .from("transactions")
      .select("amount, type, created_at")
      .eq("business_id", business_id)
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (txErr) throw txErr;

    const CREDIT_TYPES = new Set(["received", "deposit", "reversal", "pochi"]);
    const TZ = "Africa/Nairobi";

    type Bucket = { in: number; out: number; count: number };
    const dayBuckets: Record<string, Bucket> = {};

    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = d.toLocaleDateString("en-KE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
      dayBuckets[key] = { in: 0, out: 0, count: 0 };
    }

    for (const t of txns ?? []) {
      const d = new Date(t.created_at);
      const key = d.toLocaleDateString("en-KE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
      if (!dayBuckets[key]) continue;
      const amt = Number(t.amount) || 0;
      if (CREDIT_TYPES.has(t.type)) dayBuckets[key].in += amt;
      else dayBuckets[key].out += amt;
      dayBuckets[key].count++;
    }

    const days = Object.entries(dayBuckets).map(([date, b]) => ({
      date,
      inflow: Math.round(b.in),
      outflow: Math.round(b.out),
      net: Math.round(b.in - b.out),
      count: b.count,
    }));

    const last7 = days.slice(-7);
    const avgDailyIn  = last7.reduce((s, d) => s + d.inflow,  0) / 7;
    const avgDailyOut = last7.reduce((s, d) => s + d.outflow, 0) / 7;
    const avgNet = avgDailyIn - avgDailyOut;
    const currentBalance = days.reduce((s, d) => s + d.net, 0);

    const forecast = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(Date.now() + (i + 1) * 86_400_000);
      return {
        date: d.toLocaleDateString("en-KE", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }),
        projected_balance: Math.round(currentBalance + avgNet * (i + 1)),
        projected_inflow:  Math.round(avgDailyIn),
        projected_outflow: Math.round(avgDailyOut),
      };
    });

    const projected5Day = currentBalance + avgNet * 5;
    let status: "healthy" | "warning" | "critical";
    let tip: string;

    if (projected5Day < 0) {
      status = "critical";
      tip = avgDailyOut > avgDailyIn
        ? `Outflows are KES ${Math.round(avgDailyOut - avgDailyIn).toLocaleString()} more than inflows daily. Chase your 3 oldest unpaid debts first.`
        : "Balance may go negative in 5 days. Delay non-urgent supplier payments if possible.";
    } else if (projected5Day < avgDailyOut * 3) {
      status = "warning";
      tip = `You have less than 3 days of expenses in reserve. Try to collect at least KES ${Math.round(avgDailyOut * 3 - projected5Day).toLocaleString()} this week.`;
    } else {
      status = "healthy";
      tip = `Cash flow looks good. Consider saving KES ${Math.round(avgDailyIn * 0.1).toLocaleString()}/day (10% of inflow) as an emergency buffer.`;
    }

    if (status !== "healthy") {
      await supabase.from("alerts").insert({
        user_id: user.id,
        business_id,
        type: "negative_flow",
        severity: status,
        title: status === "critical" ? "⚠️ Cash Flow Critical" : "Cash Flow Warning",
        body: tip,
      });
    }

    return json({ business_id, business_name: biz.name, status, forecast, days, tip, generated_at: new Date().toISOString() });
  } catch (e) {
    console.error("[calculate-cash-flow]", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}