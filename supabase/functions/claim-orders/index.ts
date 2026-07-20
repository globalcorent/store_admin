import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405,headers:cors});
  try{
    const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
    if(!token)throw new Error("Sign in required");
    const{data:{user},error:userError}=await db.auth.getUser(token);
    if(userError||!user)throw new Error("Your session has expired. Please sign in again.");
    if(!user.email||!user.email_confirmed_at)throw new Error("Confirm your email to recover earlier orders.");
    const email=user.email.trim().toLowerCase();
    const{data:candidates,error:lookupError}=await db.from("orders").select("id,customer_email").is("user_id",null).ilike("customer_email",email);
    if(lookupError)throw lookupError;
    const ids=(candidates||[]).filter(order=>order.customer_email?.trim().toLowerCase()===email).map(order=>order.id);
    if(!ids.length)return Response.json({claimed:0},{headers:{...cors,"Cache-Control":"no-store"}});
    const{data,error}=await db.from("orders").update({user_id:user.id}).is("user_id",null).in("id",ids).select("id");
    if(error)throw error;
    return Response.json({claimed:data?.length||0},{headers:{...cors,"Cache-Control":"no-store"}});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Orders could not be recovered"},{status:401,headers:cors});
  }
});
