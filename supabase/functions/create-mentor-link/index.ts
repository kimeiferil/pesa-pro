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

    const { business_id, label, expires_days } = await req.json();
    if (!business_id) return json({ error: "business_id required" }, 400);

    const { data: biz } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("id", business_id)
      .eq("user_id", user.id)
      .single();
    if (!biz) return json({ error: "Business not found" }, 404);

    const expires_at = expires_days
      ? new Date(Date.now() + expires_days * 86_400_000).toISOString()
      : null;

    const { data: link, error: linkErr } = await supabase
      .from("public_mentor_links")
      .insert({ user_id: user.id, business_id, label: label ?? "Mentor Link", expires_at })
      .select()
      .single();

    if (linkErr) throw linkErr;

    const base = Deno.env.get("APP_BASE_URL") ?? "https://yourapp.com";
    const public_url = `${base}/mentor/${link.token}`;

    return json({ token: link.token, public_url, expires_at, created_at: link.created_at });
  } catch (e) {
    console.error("[create-mentor-link]", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}