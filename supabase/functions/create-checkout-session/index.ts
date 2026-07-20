import Stripe from "npm:stripe@22.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
};
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const isCandle = (category: string) => ["gel-candles", "wax-candles", "candles"].includes(category);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  try {
    const authorization = req.headers.get("Authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    const { data: authData } = token ? await db.auth.getUser(token) : { data: { user: null } };
    const accountUser = authData.user;
    const { items } = await req.json();
    if (!Array.isArray(items) || !items.length) throw new Error("Cart is empty");

    const legacySlugs: Record<string,string> = {
      c1:"bombshell-pink", c2:"burnt-orange", c3:"enchanted-bloom", c4:"midnight-tide", c5:"serene-lavender",
      s1:"honey-oat-glow", s2:"citrus-garden", s3:"lavender-cloud",
      a1:"golden-wick-trimmer", a2:"candle-snuffer", a3:"signature-gift-set"
    };
    const { data: products, error } = await db.from("products")
      .select("id,name,slug,description,category,price_cents,active,inventory")
      .eq("active", true);
    if (error) throw error;
    const byId = new Map(products?.flatMap((product) => [[product.id, product], [product.slug, product]]));
    const normalized = items.map((item: { id: string; quantity: number }) => ({
      id: legacySlugs[item.id] || item.id,
      quantity: Math.max(1, Math.min(20, Math.trunc(Number(item.quantity) || 1)))
    }));
    const candleCount = normalized.reduce((total, item) =>
      total + (isCandle(byId.get(item.id)?.category || "") ? item.quantity : 0), 0);
    const line_items = normalized.map((item) => {
      const product = byId.get(item.id);
      if (!product) throw new Error("A product is unavailable");
      if (product.inventory !== null && item.quantity > product.inventory) throw new Error(`${product.name} has limited stock`);
      const bundle = isCandle(product.category) && candleCount >= 3;
      return {
        quantity: item.quantity,
        price_data: {
          currency: "usd",
          unit_amount: bundle ? Math.round(product.price_cents * 0.85) : product.price_cents,
          product_data: {
            name: bundle ? `${product.name} — 15% bundle deal` : product.name,
            description: product.description,
            metadata: { product_id: product.id }
          }
        }
      };
    });
    const merchandiseTotal = line_items.reduce((sum, line) => sum + line.price_data.unit_amount * line.quantity, 0);
    const shippingAmount = merchandiseTotal >= 7500 ? 0 : 795;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      client_reference_id: accountUser?.id,
      customer_email: accountUser?.email,
      metadata: accountUser ? { user_id: accountUser.id } : {},
      success_url: "https://rfauhbcnrmwqyowftlcq.supabase.co/functions/v1/confirm-order?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://globalcorent.github.io/store_admin/",
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: shippingAmount, currency: "usd" },
          display_name: shippingAmount === 0 ? "Free U.S. shipping" : "Standard U.S. shipping",
          delivery_estimate: { minimum: { unit: "business_day", value: 5 }, maximum: { unit: "business_day", value: 7 } }
        }
      }],
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true
    });
    return Response.json({ url: session.url }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Checkout failed" }, { status: 400, headers: cors });
  }
});
