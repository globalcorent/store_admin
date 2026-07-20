import{createClient}from"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const config=window.STORE_CONFIG||{},supabase=createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY),$=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const money=(cents,currency="usd")=>new Intl.NumberFormat("en-US",{style:"currency",currency:String(currency||"usd").toUpperCase()}).format((cents||0)/100);
let session=null,profile=null,orders=[],products=new Map();

const authResult=await supabase.auth.getSession();session=authResult.data.session;
if(!session)location.replace("auth.html?next=account.html");else{
  const profileResult=await supabase.from("profiles").select("id,email,full_name,role").eq("id",session.user.id).single();
  profile=profileResult.data;
  if(profile?.role==="admin")location.replace("admin.html");else await loadAccount();
}

async function loadAccount(){
  const claimResult=await supabase.functions.invoke("claim-orders",{body:{}});
  if(claimResult.error)console.warn("Earlier guest orders could not be checked",claimResult.error);
  const orderResult=await supabase.from("orders").select("id,status,amount_total_cents,currency,shipping,fulfillment_status,tracking_number,tracking_url,shipped_at,delivered_at,created_at,order_items(id,product_id,product_name,quantity,unit_price_cents)").order("created_at",{ascending:false});
  if(orderResult.error){showToast("We couldn’t load your orders. Please refresh.");orders=[]}else orders=orderResult.data||[];
  const productIds=[...new Set(orders.flatMap(order=>(order.order_items||[]).map(item=>item.product_id).filter(Boolean)))];
  if(productIds.length){const productResult=await supabase.from("products").select("id,name,image_url,category,active").in("id",productIds).eq("active",true);for(const product of productResult.data||[])products.set(product.id,product)}
  renderAccount();$("#account-loading").hidden=true;$("#account-app").hidden=false;
  if(new URLSearchParams(location.search).get("order")==="success"){history.replaceState({},"",location.pathname);showToast("Thank you—your paid order is now in your account.")}
}

function renderAccount(){
  const name=profile?.full_name||session.user.user_metadata?.full_name||"";
  $("#customer-first-name").textContent=name.trim().split(/\s+/)[0]||"friend";$("#profile-name").value=name;$("#profile-email").value=profile?.email||session.user.email||"";
  $("#customer-order-count").textContent=orders.length;$("#customer-total-spent").textContent=money(orders.reduce((sum,order)=>sum+order.amount_total_cents,0));
  if(orders.length){$("#customer-latest-order").textContent=new Date(orders[0].created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"});$("#customer-latest-status").textContent=statusLabel(orders[0].fulfillment_status)}
  renderOrders();
}

function orderNumber(order){return`ADW-${order.id.replaceAll("-","").slice(0,8).toUpperCase()}`}
function statusLabel(status){return({unfulfilled:"Order received",processing:"Being prepared",shipped:"On the way",delivered:"Delivered",cancelled:"Cancelled",refunded:"Refunded"}[status]||"Order received")}
function statusMessage(status){return({unfulfilled:"Your payment is confirmed. We’ll begin preparing your handmade order.",processing:"Your handmade items are being prepared for shipment.",shipped:"Your package has left Aromatic Designer Works.",delivered:"Your order is marked delivered. We hope you love it.",cancelled:"This order was cancelled. Contact us if you have questions.",refunded:"This order was refunded. Your bank may need time to post the credit."}[status]||"")}
function addressHtml(shipping){
  const data=shipping||{},address=data.address||{},cityLine=[address.city,address.state,address.postal_code].filter(Boolean).join(", "),parts=[data.name,address.line1,address.line2,cityLine,address.country].filter(Boolean);
  return parts.length?parts.map(escapeHtml).join("<br>"):"Shipping address available in your payment confirmation.";
}
function progressHtml(status){
  if(["cancelled","refunded"].includes(status))return`<div class="order-exception ${status}">${escapeHtml(statusLabel(status))}</div>`;
  const stages=["Order received","Preparing","Shipped","Delivered"],current={unfulfilled:1,processing:1,shipped:2,delivered:3}[status]??1;
  return`<div class="order-progress">${stages.map((stage,index)=>`<div class="${index<current||status==="delivered"?"complete":index===current?"current":""}"><i></i><span>${stage}</span></div>`).join("")}</div>`;
}
function productFallback(category){return({"gel-candles":"assets/collection-gel-candles.webp","wax-candles":"assets/collection-wax-candles.webp",soaps:"assets/collection-soaps.webp",accessories:"assets/collection-accessories.webp"}[category]||"assets/collection-wax-candles.webp")}

function renderOrders(){
  if(!orders.length){$("#customer-orders").innerHTML=`<div class="customer-empty-orders"><span>✦</span><h3>Your first handmade favorite is waiting.</h3><p>Orders placed while signed in will appear here with delivery progress and a buy-again shortcut.</p><a class="customer-primary" href="index.html#shop">Explore the collection</a></div>`;return}
  $("#customer-orders").innerHTML=orders.map((order,index)=>{
    const items=order.order_items||[],canReorder=items.some(item=>item.product_id&&products.has(item.product_id));
    return`<details class="customer-order-card" ${index===0?"open":""}><summary><div><small>${new Date(order.created_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</small><strong>${orderNumber(order)}</strong></div><span class="customer-order-status ${escapeHtml(order.fulfillment_status)}">${escapeHtml(statusLabel(order.fulfillment_status))}</span><b>${money(order.amount_total_cents,order.currency)}</b><i>⌄</i></summary><div class="customer-order-body">${progressHtml(order.fulfillment_status)}<p class="order-status-message">${escapeHtml(statusMessage(order.fulfillment_status))}</p><div class="customer-order-items">${items.map(item=>{const product=products.get(item.product_id),image=product?(product.image_url||productFallback(product.category)):"assets/logo.png";return`<article><img src="${escapeHtml(image)}" alt=""><div><h3>${escapeHtml(item.product_name)}</h3><span>Quantity ${item.quantity}</span></div><strong>${money(item.unit_price_cents*item.quantity,order.currency)}</strong></article>`}).join("")}</div><div class="customer-order-meta"><div><small>SHIP TO</small><p>${addressHtml(order.shipping)}</p></div><div><small>PAYMENT</small><p>${escapeHtml(String(order.status||"paid").toUpperCase())}<br>Total ${money(order.amount_total_cents,order.currency)}</p></div>${order.tracking_number||order.tracking_url?`<div><small>TRACKING</small><p>${escapeHtml(order.tracking_number||"Available")}${order.tracking_url?`<br><a href="${escapeHtml(order.tracking_url)}" target="_blank" rel="noopener">Track package →</a>`:""}</p></div>`:""}</div><div class="customer-order-actions"><button data-reorder="${order.id}" ${canReorder?"":"disabled"}>${canReorder?"Buy available items again":"Items no longer available"}</button><a href="mailto:adw.com1660@gmail.com?subject=${encodeURIComponent(`Help with ${orderNumber(order)}`)}">Get order help</a></div></div></details>`
  }).join("");
  document.querySelectorAll("[data-reorder]:not(:disabled)").forEach(button=>button.onclick=()=>reorder(button.dataset.reorder));
}

function reorder(id){
  const order=orders.find(entry=>entry.id===id);if(!order)return;
  let cart=[];try{cart=JSON.parse(localStorage.getItem("adw-cart")||"[]")}catch{cart=[]}
  for(const item of order.order_items||[]){if(!item.product_id||!products.has(item.product_id))continue;const existing=cart.find(entry=>entry.id===item.product_id);if(existing)existing.quantity=Math.min(20,existing.quantity+item.quantity);else cart.push({id:item.product_id,quantity:Math.min(20,item.quantity)})}
  localStorage.setItem("adw-cart",JSON.stringify(cart));localStorage.setItem("adw-open-cart","1");location.assign("index.html#shop");
}

$("#profile-form").onsubmit=async event=>{event.preventDefault();const name=$("#profile-name").value.trim(),message=$("#profile-message");if(name.length<2){message.textContent="Please enter your full name.";return}const{error}=await supabase.from("profiles").update({full_name:name}).eq("id",session.user.id);if(error){message.textContent="Your name could not be saved.";return}profile.full_name=name;$("#customer-first-name").textContent=name.split(/\s+/)[0];message.textContent="Name saved."};
$("#account-signout").onclick=async()=>{await supabase.auth.signOut();location.replace("index.html")};
function showToast(message){const toast=$(".account-toast");toast.textContent=message;toast.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove("show"),4200)}
