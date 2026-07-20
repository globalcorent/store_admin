import{createClient}from"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const config=window.STORE_CONFIG||{},supabase=createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY),$=selector=>document.querySelector(selector);
let products=[],orders=[],reviews=[],pendingFile=null,removeImageRequested=false,currentProduct=null,currentOrder=null;
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const money=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format((cents||0)/100);
const fallbackImage=category=>({"gel-candles":"assets/collection-gel-candles.webp","wax-candles":"assets/collection-wax-candles.webp",candles:"assets/collection-wax-candles.webp",soaps:"assets/collection-soaps.webp",accessories:"assets/collection-accessories.webp"}[category]||"assets/collection-wax-candles.webp");
const categoryLabel=category=>({"gel-candles":"Gel candles","wax-candles":"Wax candles",candles:"Candles",soaps:"Handmade soaps",accessories:"Accessories"}[category]||category);
const stars=rating=>`<span class="admin-stars">${[1,2,3,4,5].map(value=>value<=rating?"★":"☆").join("")}</span>`;

const{data:{session}}=await supabase.auth.getSession();
if(!session)location.replace("auth.html");else{
  const{data:profile}=await supabase.from("profiles").select("role").eq("id",session.user.id).single();
  if(profile?.role!=="admin")location.replace("index.html");else{$("#loading").hidden=true;$("#app").hidden=false;await loadDashboard()}
}

async function loadDashboard(){
  const[productResult,orderResult,orderCountResult,subscriberResult,reviewResult,salesResult]=await Promise.all([
    supabase.from("products").select("*").order("sort_order"),
    supabase.from("orders").select("id,customer_name,customer_email,status,amount_total_cents,currency,shipping,fulfillment_status,tracking_number,tracking_url,shipped_at,delivered_at,created_at,order_items(id,product_name,quantity,unit_price_cents)").order("created_at",{ascending:false}).limit(100),
    supabase.from("orders").select("id",{count:"exact",head:true}),
    supabase.from("newsletter_subscribers").select("id",{count:"exact",head:true}),
    supabase.from("reviews").select("id,product_id,author_name,rating,title,body,approved,verified_purchase,created_at").order("created_at",{ascending:false}),
    supabase.from("orders").select("amount_total_cents").eq("status","paid")
  ]);
  const failed=[productResult,orderResult,reviewResult,salesResult].find(result=>result.error);if(failed?.error){alert(`Could not load the dashboard: ${failed.error.message}`);return}
  products=productResult.data||[];orders=orderResult.data||[];reviews=reviewResult.data||[];
  $("#product-count").textContent=products.length;$("#order-count").textContent=orderCountResult.count||0;$("#subscriber-count").textContent=subscriberResult.count||0;$("#review-count").textContent=reviews.filter(review=>!review.approved).length;
  $("#sales-total").textContent=money((salesResult.data||[]).reduce((sum,order)=>sum+order.amount_total_cents,0));
  renderProducts();renderOrders();renderReviews();
}

function renderProducts(){
  const query=$("#product-search").value.trim().toLowerCase();
  const visible=products.filter(product=>!query||[product.name,product.category,product.badge,product.scent_notes].some(value=>String(value||"").toLowerCase().includes(query)));
  $("#products").innerHTML=visible.length?visible.map(product=>`<article class="admin-product-card">
    <img src="${escapeHtml(product.image_url||fallbackImage(product.category))}" alt="">
    <div class="admin-product-copy"><span>${escapeHtml(categoryLabel(product.category))}</span><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.scent_notes||product.description||"No description yet.")}</p></div>
    <div class="admin-product-meta"><b>${money(product.price_cents)}</b><span>${product.inventory==null?"Unlimited stock":`${product.inventory} in stock`}</span><i class="${product.active?"live":"hidden"}">${product.active?"Visible":"Hidden"}</i></div>
    <div class="admin-row-actions"><button class="edit-button" data-id="${product.id}">Edit</button><button class="delete-button" data-id="${product.id}" aria-label="Delete ${escapeHtml(product.name)}">⋮</button></div>
  </article>`).join(""):'<div class="empty-state"><b>No products found</b><p>Try another search or add a new product.</p></div>';
  document.querySelectorAll(".edit-button").forEach(button=>button.onclick=()=>openEditor(products.find(product=>product.id===button.dataset.id)));
  document.querySelectorAll(".delete-button").forEach(button=>button.onclick=()=>deleteProduct(button.dataset.id));
}

function renderOrders(){
  $("#orders").innerHTML=orders.length?`<div class="admin-table-wrap"><table><thead><tr><th>Date</th><th>Customer</th><th>Payment</th><th>Fulfillment</th><th>Total</th><th></th></tr></thead><tbody>${orders.slice(0,25).map(order=>`<tr><td>${new Date(order.created_at).toLocaleDateString()}</td><td><strong>${escapeHtml(order.customer_name||"Guest")}</strong><small class="table-subline">${escapeHtml(order.customer_email||"—")}</small></td><td><span class="order-status payment">${escapeHtml(order.status)}</span></td><td><span class="order-status fulfillment ${escapeHtml(order.fulfillment_status)}">${escapeHtml(fulfillmentLabel(order.fulfillment_status))}</span></td><td><strong>${money(order.amount_total_cents)}</strong></td><td><button class="manage-order" data-order-id="${order.id}">Manage</button></td></tr>`).join("")}</tbody></table></div>`:'<div class="empty-state"><b>No orders yet</b><p>Paid Stripe orders will appear here automatically.</p></div>';
  document.querySelectorAll("[data-order-id]").forEach(button=>button.onclick=()=>openOrderEditor(button.dataset.orderId));
}

function fulfillmentLabel(status){return({unfulfilled:"Order received",processing:"Preparing",shipped:"Shipped",delivered:"Delivered",cancelled:"Cancelled",refunded:"Refunded"}[status]||"Order received")}
function adminOrderNumber(order){return`ADW-${order.id.replaceAll("-","").slice(0,8).toUpperCase()}`}
function shippingAddress(shipping){const data=shipping||{},address=data.address||{},city=[address.city,address.state,address.postal_code].filter(Boolean).join(", ");return[data.name,address.line1,address.line2,city,address.country].filter(Boolean).map(escapeHtml).join("<br>")||"No shipping address stored."}
function openOrderEditor(id){
  const order=orders.find(item=>item.id===id);if(!order)return;currentOrder=order;$("#order-id").value=order.id;$("#order-form-title").textContent=adminOrderNumber(order);$("#fulfillment-status").value=order.fulfillment_status||"unfulfilled";$("#tracking-number").value=order.tracking_number||"";$("#tracking-url").value=order.tracking_url||"";$("#order-notice").textContent="";
  $("#order-overview").innerHTML=`<article><small>Customer</small><strong>${escapeHtml(order.customer_name||"Guest")}</strong><span>${escapeHtml(order.customer_email||"—")}</span></article><article><small>Order total</small><strong>${money(order.amount_total_cents)}</strong><span>${new Date(order.created_at).toLocaleString()}</span></article><article><small>Ship to</small><p>${shippingAddress(order.shipping)}</p></article>`;
  $("#order-items-detail").innerHTML=`<h3>Items</h3>${(order.order_items||[]).map(item=>`<div><span>${item.quantity} × ${escapeHtml(item.product_name)}</span><strong>${money(item.unit_price_cents*item.quantity)}</strong></div>`).join("")}`;
  $("#order-editor").showModal();
}

function renderReviews(){
  const ordered=[...reviews].sort((a,b)=>Number(a.approved)-Number(b.approved)||new Date(b.created_at)-new Date(a.created_at));
  $("#reviews").innerHTML=ordered.length?`<div class="admin-review-list">${ordered.map(review=>{const product=products.find(item=>item.id===review.product_id);return `<article class="admin-review-card ${review.approved?"approved":"pending"}"><div class="review-status-block"><span>${review.approved?"Published":"Pending"}</span>${stars(review.rating)}<small>${new Date(review.created_at).toLocaleDateString()}</small></div><div class="admin-review-copy"><small>${escapeHtml(product?.name||"Deleted product")}</small><h3>${escapeHtml(review.title||"Customer review")}</h3><p>${escapeHtml(review.body)}</p><b>— ${escapeHtml(review.author_name)}</b></div><div class="review-actions"><button class="review-toggle ${review.approved?"hide-review":"approve-review"}" data-review-id="${review.id}" data-approved="${review.approved}">${review.approved?"Hide":"Approve"}</button><button class="review-delete" data-review-delete="${review.id}">Delete</button></div></article>`}).join("")}</div>`:'<div class="empty-state"><b>No reviews submitted yet</b><p>Customer reviews will wait here for your approval.</p></div>';
  document.querySelectorAll("[data-review-id]").forEach(button=>button.onclick=()=>setReviewStatus(button.dataset.reviewId,button.dataset.approved!=="true"));
  document.querySelectorAll("[data-review-delete]").forEach(button=>button.onclick=()=>deleteReview(button.dataset.reviewDelete));
}

async function setReviewStatus(id,approved){
  const{error}=await supabase.from("reviews").update({approved}).eq("id",id);if(error){alert(error.message);return}await loadDashboard();
}
async function deleteReview(id){
  const review=reviews.find(item=>item.id===id);if(!review||!confirm(`Delete the review from ${review.author_name}? This cannot be undone.`))return;
  const{error}=await supabase.from("reviews").delete().eq("id",id);if(error){alert(error.message);return}await loadDashboard();
}

function setPreview(url){const image=$("#image-preview"),placeholder=$("#image-placeholder");if(url){image.src=url;image.hidden=false;placeholder.hidden=true;$("#remove-image").hidden=false}else{image.removeAttribute("src");image.hidden=true;placeholder.hidden=false;$("#remove-image").hidden=true}}
function slugify(value){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")}
function openEditor(product={}){
  currentProduct=product;pendingFile=null;removeImageRequested=false;$("#product-form").reset();
  $("#product-id").value=product.id||"";$("#product-name").value=product.name||"";$("#slug").value=product.slug||"";$("#category").value=product.category==="candles"?"wax-candles":product.category||"wax-candles";$("#price").value=product.price_cents!=null?(product.price_cents/100).toFixed(2):"";$("#inventory").value=product.inventory??"";$("#sort").value=product.sort_order||0;$("#badge").value=product.badge||"";$("#visual").value=product.visual||"✦";$("#color").value=product.color||"#efe4d4";$("#active").value=String(product.active??true);$("#featured").value=String(product.featured??false);$("#description").value=product.description||"";$("#scent-notes").value=product.scent_notes||"";$("#size-label").value=product.size_label||"";$("#burn-time").value=product.burn_time||"";$("#materials").value=product.materials||"";$("#care-instructions").value=product.care_instructions||"";$("#form-title").textContent=product.id?"Edit product":"Add product";$("#notice").textContent="";setPreview(product.image_url||"");$("#editor").showModal();
}
async function uploadImage(file){
  const extension=file.name.split(".").pop().toLowerCase(),path=`${crypto.randomUUID()}.${extension}`;
  const{error}=await supabase.storage.from("product-images").upload(path,file,{cacheControl:"3600",contentType:file.type,upsert:false});if(error)throw error;
  const{data}=supabase.storage.from("product-images").getPublicUrl(path);return{image_url:data.publicUrl,image_path:path};
}
async function deleteProduct(id){
  const product=products.find(item=>item.id===id);if(!product||!confirm(`Delete "${product.name}"? Its customer reviews will also be removed. This cannot be undone.`))return;
  const{error}=await supabase.from("products").delete().eq("id",id);if(error){alert(error.message);return}if(product.image_path)await supabase.storage.from("product-images").remove([product.image_path]);await loadDashboard();
}

$("#product-form").onsubmit=async event=>{
  event.preventDefault();const save=$("#save-product");save.disabled=true;save.textContent="Saving…";$("#notice").textContent="";let uploaded=null;
  try{
    if(pendingFile)uploaded=await uploadImage(pendingFile);
    const id=$("#product-id").value,row={name:$("#product-name").value.trim(),slug:slugify($("#slug").value),category:$("#category").value,price_cents:Math.round(Number($("#price").value)*100),inventory:$("#inventory").value===""?null:Number($("#inventory").value),sort_order:Number($("#sort").value),badge:$("#badge").value.trim(),visual:$("#visual").value.trim()||"✦",color:$("#color").value,active:$("#active").value==="true",featured:$("#featured").value==="true",description:$("#description").value.trim(),scent_notes:$("#scent-notes").value.trim(),size_label:$("#size-label").value.trim(),burn_time:$("#burn-time").value.trim(),materials:$("#materials").value.trim(),care_instructions:$("#care-instructions").value.trim()};
    if(uploaded)Object.assign(row,uploaded);else if(removeImageRequested)Object.assign(row,{image_url:null,image_path:null});
    const{error}=id?await supabase.from("products").update(row).eq("id",id):await supabase.from("products").insert(row);if(error)throw error;
    if((uploaded||removeImageRequested)&&currentProduct?.image_path)await supabase.storage.from("product-images").remove([currentProduct.image_path]);
    $("#editor").close();await loadDashboard();
  }catch(error){if(uploaded?.image_path)await supabase.storage.from("product-images").remove([uploaded.image_path]);$("#notice").textContent=error.message||"Could not save the product."}finally{save.disabled=false;save.textContent="Save product"}
};

$("#image-file").onchange=event=>{const file=event.target.files[0];if(!file)return;if(file.size>5242880){$("#notice").textContent="Please choose an image smaller than 5 MB.";event.target.value="";return}pendingFile=file;removeImageRequested=false;setPreview(URL.createObjectURL(file))};
$("#remove-image").onclick=()=>{pendingFile=null;removeImageRequested=true;$("#image-file").value="";setPreview("")};
$("#product-name").oninput=()=>{if(!$("#product-id").value)$("#slug").value=slugify($("#product-name").value)};
$("#product-search").oninput=renderProducts;$("#add").onclick=()=>openEditor();$("#add-secondary").onclick=()=>openEditor();$("#cancel").onclick=()=>$("#editor").close();$("#dialog-x").onclick=()=>$("#editor").close();
$("#order-form").onsubmit=async event=>{
  event.preventDefault();if(!currentOrder)return;const save=$("#save-order"),status=$("#fulfillment-status").value,now=new Date().toISOString();save.disabled=true;save.textContent="Saving…";$("#order-notice").textContent="";
  const row={fulfillment_status:status,tracking_number:$("#tracking-number").value.trim()||null,tracking_url:$("#tracking-url").value.trim()||null,shipped_at:currentOrder.shipped_at,delivered_at:currentOrder.delivered_at};
  if(["shipped","delivered"].includes(status)&&!row.shipped_at)row.shipped_at=now;if(status==="delivered"&&!row.delivered_at)row.delivered_at=now;
  const{error}=await supabase.from("orders").update(row).eq("id",currentOrder.id);
  if(error){$("#order-notice").textContent=error.message;save.disabled=false;save.textContent="Save fulfillment";return}
  $("#order-editor").close();save.disabled=false;save.textContent="Save fulfillment";await loadDashboard();
};
$("#order-cancel").onclick=()=>$("#order-editor").close();$("#order-dialog-x").onclick=()=>$("#order-editor").close();
$("#signout").onclick=async()=>{await supabase.auth.signOut();location.replace("auth.html")};
