import Stripe from "npm:stripe@22.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const signature = req.headers.get("Stripe-Signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!signature || !webhookSecret) return new Response("Webhook is not configured", { status: 400 });
    const event = await stripe.webhooks.constructEventAsync(await req.text(), signature, webhookSecret, undefined, cryptoProvider);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { data: order, error } = await db.from("orders").upsert({
        user_id: session.metadata?.user_id || null,
        stripe_session_id: session.id,
        customer_email: session.customer_details?.email,
        customer_name: session.customer_details?.name,
        status: session.payment_status,
        amount_total_cents: session.amount_total || 0,
        currency: session.currency || "usd",
        shipping: session.collected_information?.shipping_details || null
      }, { onConflict: "stripe_session_id" }).select("id").single();
      if (error) throw error;
      const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100, expand: ["data.price.product"] });
      await db.from("order_items").delete().eq("order_id", order.id);
      const rows = lines.data.map((line) => {
        const stripeProduct = line.price?.product as { metadata?: Record<string,string> } | string | null;
        return {
          order_id: order.id,
          product_id: typeof stripeProduct === "object" && stripeProduct ? stripeProduct.metadata?.product_id || null : null,
          product_name: line.description,
          quantity: line.quantity || 1,
          unit_price_cents: line.price?.unit_amount || 0
        };
      });
      if (rows.length) {
        const { error: itemError } = await db.from("order_items").insert(rows);
        if (itemError) throw itemError;
      }
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error(error);
    return new Response("Webhook error", { status: 400 });
  }
});
