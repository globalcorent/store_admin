import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const {email}=await req.json();
    const normalized=String(email||"").trim().toLowerCase();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)||normalized.length>254) throw new Error("Enter a valid email address");
    const {error}=await db.from("newsletter_subscribers").upsert({email:normalized},{onConflict:"email",ignoreDuplicates:true});
    if(error) throw error;
    return Response.json({subscribed:true},{headers:cors});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Signup failed"},{status:400,headers:cors});}
});
