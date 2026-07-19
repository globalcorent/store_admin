import Stripe from "npm:stripe@22.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405,headers:cors});
  try{
    const{items,successUrl,cancelUrl}=await req.json();
    if(!Array.isArray(items)||!items.length)throw new Error("Cart is empty");
    if(!successUrl||!cancelUrl)throw new Error("Missing return URL");
    const ids=[...new Set(items.map((item:{id:string})=>item.id))];
    const{data:products,error}=await db.from("products").select("id,name,description,category,price_cents,active,inventory").in("id",ids).eq("active",true);
    if(error)throw error;
    const byId=new Map(products?.map(product=>[product.id,product]));
    const normalized=items.map((item:{id:string;quantity:number})=>({id:item.id,quantity:Math.max(1,Math.min(20,Math.trunc(Number(item.quantity)||1)))}));
    const candleCount=normalized.reduce((total,item)=>total+(byId.get(item.id)?.category==="candles"?item.quantity:0),0);
    const line_items=normalized.map(item=>{
      const product=byId.get(item.id);
      if(!product)throw new Error("A product is unavailable");
      if(product.inventory!==null&&item.quantity>product.inventory)throw new Error(`${product.name} has limited stock`);
      const bundle=product.category==="candles"&&candleCount>=3;
      return{quantity:item.quantity,price_data:{currency:"usd",unit_amount:bundle?Math.round(product.price_cents*.85):product.price_cents,product_data:{name:bundle?`${product.name} — 15% bundle deal`:product.name,description:product.description}}};
    });
    const merchandiseTotal=line_items.reduce((sum,line)=>sum+line.price_data.unit_amount*line.quantity,0);
    const shippingAmount=merchandiseTotal>=7500?0:795;
    const authHeader=req.headers.get("Authorization");
    let userId:string|undefined;
    if(authHeader?.startsWith("Bearer ")){const{data}=await db.auth.getUser(authHeader.slice(7));userId=data.user?.id}
    const session=await stripe.checkout.sessions.create({mode:"payment",line_items,success_url:successUrl,cancel_url:cancelUrl,shipping_address_collection:{allowed_countries:["US"]},shipping_options:[{shipping_rate_data:{type:"fixed_amount",fixed_amount:{amount:shippingAmount,currency:"usd"},display_name:shippingAmount===0?"Free U.S. shipping":"Standard U.S. shipping",delivery_estimate:{minimum:{unit:"business_day",value:5},maximum:{unit:"business_day",value:7}}}}],phone_number_collection:{enabled:true},automatic_tax:{enabled:true},allow_promotion_codes:true,metadata:userId?{user_id:userId}:undefined});
    return Response.json({url:session.url},{headers:cors});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Checkout failed"},{status:400,headers:cors})}
});
