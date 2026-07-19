import Stripe from "npm:stripe@22.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const cryptoProvider=Stripe.createSubtleCryptoProvider();
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async req=>{
  try{
    const signature=req.headers.get("Stripe-Signature");
    if(!signature) return new Response("Missing signature",{status:400});
    const event=await stripe.webhooks.constructEventAsync(await req.text(),signature,Deno.env.get("STRIPE_WEBHOOK_SECRET")!,undefined,cryptoProvider);
    if(event.type==="checkout.session.completed"){
      const session=event.data.object as Stripe.Checkout.Session;
      const {data:order,error}=await db.from("orders").upsert({stripe_session_id:session.id,customer_email:session.customer_details?.email,customer_name:session.customer_details?.name,status:session.payment_status,amount_total_cents:session.amount_total||0,currency:session.currency||"usd",shipping:session.collected_information?.shipping_details||null},{onConflict:"stripe_session_id"}).select("id").single();
      if(error) throw error;
      const lines=await stripe.checkout.sessions.listLineItems(session.id,{limit:100});
      await db.from("order_items").delete().eq("order_id",order.id);
      const rows=lines.data.map(line=>({order_id:order.id,product_name:line.description,quantity:line.quantity||1,unit_price_cents:line.price?.unit_amount||0}));
      if(rows.length){const {error:itemError}=await db.from("order_items").insert(rows);if(itemError)throw itemError;}
    }
    return Response.json({received:true});
  }catch(error){console.error(error);return new Response("Webhook error",{status:400});}
});
