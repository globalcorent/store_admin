import Stripe from "npm:stripe@22.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const storeUrl="https://globalcorent.github.io/store_admin/";

Deno.serve(async req=>{
  try{
    const url=new URL(req.url);
    const sessionId=url.searchParams.get("session_id");
    if(!sessionId?.startsWith("cs_"))throw new Error("Missing checkout session");
    const session=await stripe.checkout.sessions.retrieve(sessionId);
    if(session.payment_status!=="paid")throw new Error("Payment is not complete");
    const{data:order,error}=await db.from("orders").upsert({
      user_id:session.metadata?.user_id||null,
      stripe_session_id:session.id,
      customer_email:session.customer_details?.email,
      customer_name:session.customer_details?.name,
      status:session.payment_status,
      amount_total_cents:session.amount_total||0,
      currency:session.currency||"usd",
      shipping:session.collected_information?.shipping_details||null
    },{onConflict:"stripe_session_id"}).select("id").single();
    if(error)throw error;
    const lines=await stripe.checkout.sessions.listLineItems(session.id,{limit:100,expand:["data.price.product"]});
    await db.from("order_items").delete().eq("order_id",order.id);
    const rows=lines.data.map(line=>{
      const stripeProduct=line.price?.product as {metadata?:Record<string,string>}|string|null;
      return{order_id:order.id,product_id:typeof stripeProduct==="object"&&stripeProduct?stripeProduct.metadata?.product_id||null:null,product_name:line.description,quantity:line.quantity||1,unit_price_cents:line.price?.unit_amount||0};
    });
    if(rows.length){const{error:itemError}=await db.from("order_items").insert(rows);if(itemError)throw itemError}
    const returnUrl=session.metadata?.user_id?`${storeUrl}account.html?order=success`:`${storeUrl}?checkout=success`;
    return Response.redirect(returnUrl,303);
  }catch(error){
    console.error(error);
    return Response.redirect(`${storeUrl}?checkout=error`,303);
  }
});
