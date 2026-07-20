import Stripe from "npm:stripe@22.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import { createCartQuote, normalizeCart, type Promotion, type StoreProduct } from "../_shared/promotion-pricing.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
};
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  try {
    const authorization = req.headers.get("Authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    const { data: authData } = token ? await db.auth.getUser(token) : { data: { user: null } };
    const accountUser = authData.user;
    const { items, coupon_code } = await req.json();
    const [productResult, promotionResult] = await Promise.all([
      db.from("products").select("id,name,slug,description,category,price_cents,inventory").eq("active", true),
      db.from("promotions").select("id,name,mode,code,discount_type,discount_value,applies_to,min_quantity,min_subtotal_cents,active,starts_at,ends_at,created_at").eq("active", true)
    ]);
    if (productResult.error) throw productResult.error;
    if (promotionResult.error) throw promotionResult.error;
    const lines = normalizeCart(items, (productResult.data || []) as StoreProduct[], true);
    const quote = createCartQuote((promotionResult.data || []) as Promotion[], lines, coupon_code);
    const line_items = quote.groups.map((line) => {
      const discounted = line.unit_amount < line.product.price_cents;
      return {
        quantity: line.quantity,
        price_data: {
          currency: "usd",
          unit_amount: line.unit_amount,
          product_data: {
            name: discounted && quote.promotion ? `${line.product.name} — ${quote.promotion.name}` : line.product.name,
            description: line.product.description,
            metadata: { product_id: line.product.id }
          }
        }
      };
    });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      client_reference_id: accountUser?.id,
      customer_email: accountUser?.email,
      metadata: {
        ...(accountUser ? { user_id: accountUser.id } : {}),
        ...(quote.promotion ? { promotion_id: quote.promotion.id, promotion_name: quote.promotion.name, coupon_code: quote.promotion.code || "" } : {})
      },
      success_url: "https://rfauhbcnrmwqyowftlcq.supabase.co/functions/v1/confirm-order?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://globalcorent.github.io/store_admin/",
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: quote.shipping_cents, currency: "usd" },
          display_name: quote.shipping_cents === 0 ? "Free U.S. shipping" : "Standard U.S. shipping",
          delivery_estimate: { minimum: { unit: "business_day", value: 5 }, maximum: { unit: "business_day", value: 7 } }
        }
      }],
      phone_number_collection: { enabled: true },
      allow_promotion_codes: false
    });
    return Response.json({ url: session.url }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Checkout failed" }, { status: 400, headers: cors });
  }
});
