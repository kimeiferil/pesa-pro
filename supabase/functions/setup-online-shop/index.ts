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
    const enabled = body?.enabled as boolean | undefined;
    if (!businessId || typeof enabled !== "boolean") {
      return json({ error: "business_id and enabled are required" }, 400);
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, user_id, name, slug")
      .eq("id", businessId)
      .single();
    if (businessError || !business) return json({ error: "Business not found" }, 404);
    if (business.user_id !== user.id) {
      return json({ error: "Forbidden" }, 403);
    }

    const slug = business.slug || generateSlug(business.name || `shop-${businessId}`);
    const { data: updatedBusiness, error: updateError } = await supabase
      .from("businesses")
      .update({ slug, shop_is_active: enabled, updated_at: new Date().toISOString() })
      .eq("id", businessId)
      .select("id, slug, shop_is_active, logo_url, name")
      .single();
    if (updateError || !updatedBusiness) throw updateError ?? new Error("Failed to update shop settings");

    const base = Deno.env.get("APP_BASE_URL") ?? "https://pesapro.app";
    const shopUrl = `${base.replace(/\/$/, "")}/shop/${updatedBusiness.slug}`;

    return json({ shop_url: shopUrl, shop_is_active: updatedBusiness.shop_is_active, logo_url: updatedBusiness.logo_url, business_name: updatedBusiness.name });
  } catch (error) {
    console.error("[setup-online-shop]", error);
    return json({ error: "Internal server error" }, 500);
  }
});

function generateSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `shop-${Math.random().toString(36).slice(2, 10)}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
