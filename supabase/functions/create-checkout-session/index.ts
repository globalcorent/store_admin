import Stripe from "npm:stripe@22.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const {items,successUrl,cancelUrl}=await req.json();
    if(!Array.isArray(items)||!items.length) throw new Error("Cart is empty");
    if(!successUrl||!cancelUrl) throw new Error("Missing return URL");
    const ids=[...new Set(items.map((i:{id:string})=>i.id))];
    const {data:products,error}=await db.from("products").select("id,name,description,category,price_cents,active,inventory").in("id",ids).eq("active",true);
    if(error) throw error;
    const byId=new Map(products?.map(p=>[p.id,p]));
    const candleCount=items.reduce((total:number,item:{id:string,quantity:number})=>total+(byId.get(item.id)?.category==="candles"?Math.max(1,Math.min(20,Math.trunc(Number(item.quantity)))):0),0);
    const line_items=items.map((item:{id:string,quantity:number})=>{
      const p=byId.get(item.id);const quantity=Math.max(1,Math.min(20,Math.trunc(Number(item.quantity))));
      if(!p) throw new Error("A product is unavailable");if(p.inventory!==null&&quantity>p.inventory) throw new Error(`${p.name} has limited stock`);
      const hasBundleDeal=p.category==="candles"&&candleCount>=3;
      return {quantity,price_data:{currency:"usd",unit_amount:hasBundleDeal?Math.round(p.price_cents*.85):p.price_cents,product_data:{name:hasBundleDeal?`${p.name} — 15% bundle deal`:p.name,description:p.description}}};
    });
    const merchandiseTotal=line_items.reduce((sum:number,line)=>sum+(line.price_data.unit_amount*line.quantity),0);
    const shippingAmount=merchandiseTotal>=7500?0:795;
    const session=await stripe.checkout.sessions.create({mode:"payment",line_items,success_url:successUrl,cancel_url:cancelUrl,shipping_address_collection:{allowed_countries:["US"]},shipping_options:[{shipping_rate_data:{type:"fixed_amount",fixed_amount:{amount:shippingAmount,currency:"usd"},display_name:shippingAmount===0?"Free U.S. shipping":"Standard U.S. shipping",delivery_estimate:{minimum:{unit:"business_day",value:5},maximum:{unit:"business_day",value:7}}}}],phone_number_collection:{enabled:true},automatic_tax:{enabled:true},allow_promotion_codes:true});
    return Response.json({url:session.url},{headers:cors});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Checkout failed"},{status:400,headers:cors});}
});
