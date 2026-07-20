import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import { createCartQuote, normalizeCart, type Promotion, type StoreProduct } from "../_shared/promotion-pricing.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
};
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  try {
    const { items, coupon_code } = await req.json();
    const [productResult, promotionResult] = await Promise.all([
      db.from("products").select("id,slug,name,description,category,price_cents,inventory").eq("active", true),
      db.from("promotions").select("id,name,mode,code,discount_type,discount_value,applies_to,min_quantity,min_subtotal_cents,active,starts_at,ends_at,created_at").eq("active", true)
    ]);
    if (productResult.error) throw productResult.error;
    if (promotionResult.error) throw promotionResult.error;
    const lines = normalizeCart(items, (productResult.data || []) as StoreProduct[]);
    const quote = createCartQuote((promotionResult.data || []) as Promotion[], lines, coupon_code);
    const { groups: _privateGroups, ...publicQuote } = quote;
    return Response.json(publicQuote, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not price the cart" }, { status: 400, headers: cors });
  }
});
