import{createClient}from"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const config=window.STORE_CONFIG||{},supabase=createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY),$=selector=>document.querySelector(selector);
let products=[],orders=[],reviews=[],galleryDraft=[],removedGallery=[],currentProduct=null,currentOrder=null;
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const money=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format((cents||0)/100);
const fallbackImage=category=>({"gel-candles":"assets/collection-gel-candles.webp","wax-candles":"assets/collection-wax-candles.webp",candles:"assets/collection-wax-candles.webp",soaps:"assets/collection-soaps.webp",accessories:"assets/collection-accessories.webp"}[category]||"assets/collection-wax-candles.webp");
const productGallery=product=>{const rows=[...(product.product_images||[])].filter(image=>image.image_url).sort((a,b)=>a.sort_order-b.sort_order||new Date(a.created_at||0)-new Date(b.created_at||0));if(rows.length)return rows;if(product.image_url)return[{id:null,image_url:product.image_url,image_path:product.image_path||null,alt_text:product.name||"",sort_order:0}];return[]};
const primaryImage=product=>productGallery(product)[0]?.image_url||fallbackImage(product.category);
const categoryLabel=category=>({"gel-candles":"Gel candles","wax-candles":"Wax candles",candles:"Candles",soaps:"Handmade soaps",accessories:"Accessories"}[category]||category);
const stars=rating=>`<span class="admin-stars">${[1,2,3,4,5].map(value=>value<=rating?"★":"☆").join("")}</span>`;

const{data:{session}}=await supabase.auth.getSession();
if(!session)location.replace("auth.html");else{
  const{data:profile}=await supabase.from("profiles").select("role").eq("id",session.user.id).single();
  if(profile?.role!=="admin")location.replace("index.html");else{$("#loading").hidden=true;$("#app").hidden=false;await loadDashboard()}
}

async function loadDashboard(){
  const[productResult,orderResult,orderCountResult,subscriberResult,reviewResult,salesResult]=await Promise.all([
    supabase.from("products").select("*,product_images(id,image_url,image_path,alt_text,sort_order,created_at)").order("sort_order"),
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
  $("#products").innerHTML=visible.length?visible.map(product=>{const photoCount=productGallery(product).length;return`<article class="admin-product-card">
    <div class="admin-product-photo"><img src="${escapeHtml(primaryImage(product))}" alt=""><span>${photoCount} photo${photoCount===1?"":"s"}</span></div>
    <div class="admin-product-copy"><span>${escapeHtml(categoryLabel(product.category))}</span><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.scent_notes||product.description||"No description yet.")}</p></div>
    <div class="admin-product-meta"><b>${money(product.price_cents)}</b><span>${product.inventory==null?"Unlimited stock":`${product.inventory} in stock`}</span><i class="${product.active?"live":"hidden"}">${product.active?"Visible":"Hidden"}</i></div>
    <div class="admin-row-actions"><button class="edit-button" data-id="${product.id}">Edit</button><button class="delete-button" data-id="${product.id}" aria-label="Delete ${escapeHtml(product.name)}">⋮</button></div>
  </article>`}).join(""):'<div class="empty-state"><b>No products found</b><p>Try another search or add a new product.</p></div>';
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

function slugify(value){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")}
function releaseGalleryPreviews(){for(const image of galleryDraft)if(image.preview_url?.startsWith("blob:"))URL.revokeObjectURL(image.preview_url)}
function moveGallery(from,to){if(to<0||to>=galleryDraft.length)return;const[image]=galleryDraft.splice(from,1);galleryDraft.splice(to,0,image);renderGalleryEditor()}
function removeGalleryImage(index){const[image]=galleryDraft.splice(index,1);if(!image)return;if(image.preview_url?.startsWith("blob:"))URL.revokeObjectURL(image.preview_url);if(image.id||image.image_path)removedGallery.push(image);renderGalleryEditor()}
function renderGalleryEditor(){
  $("#gallery-empty").hidden=galleryDraft.length>0;
  $("#gallery-grid").innerHTML=galleryDraft.map((image,index)=>`<article class="gallery-card ${index===0?"cover":""}"><div class="gallery-card-image"><img src="${escapeHtml(image.preview_url||image.image_url)}" alt=""><span>${index===0?"Cover":`View ${index+1}`}</span></div><div class="gallery-card-actions">${index?`<button type="button" data-gallery-cover="${index}">Make cover</button>`:'<b>Store cover</b>'}<span><button type="button" data-gallery-left="${index}" ${index===0?"disabled":""} aria-label="Move photo left">←</button><button type="button" data-gallery-right="${index}" ${index===galleryDraft.length-1?"disabled":""} aria-label="Move photo right">→</button><button type="button" data-gallery-remove="${index}" aria-label="Remove photo">×</button></span></div></article>`).join("");
  document.querySelectorAll("[data-gallery-cover]").forEach(button=>button.onclick=()=>moveGallery(Number(button.dataset.galleryCover),0));
  document.querySelectorAll("[data-gallery-left]").forEach(button=>button.onclick=()=>moveGallery(Number(button.dataset.galleryLeft),Number(button.dataset.galleryLeft)-1));
  document.querySelectorAll("[data-gallery-right]").forEach(button=>button.onclick=()=>moveGallery(Number(button.dataset.galleryRight),Number(button.dataset.galleryRight)+1));
  document.querySelectorAll("[data-gallery-remove]").forEach(button=>button.onclick=()=>removeGalleryImage(Number(button.dataset.galleryRemove)));
}
function openEditor(product={}){
  releaseGalleryPreviews();currentProduct=product;removedGallery=[];galleryDraft=productGallery(product).map(image=>({...image,preview_url:image.image_url,file:null}));$("#product-form").reset();
  $("#product-id").value=product.id||"";$("#product-name").value=product.name||"";$("#slug").value=product.slug||"";$("#category").value=product.category==="candles"?"wax-candles":product.category||"wax-candles";$("#price").value=product.price_cents!=null?(product.price_cents/100).toFixed(2):"";$("#inventory").value=product.inventory??"";$("#sort").value=product.sort_order||0;$("#badge").value=product.badge||"";$("#visual").value=product.visual||"✦";$("#color").value=product.color||"#efe4d4";$("#active").value=String(product.active??true);$("#featured").value=String(product.featured??false);$("#description").value=product.description||"";$("#scent-notes").value=product.scent_notes||"";$("#size-label").value=product.size_label||"";$("#burn-time").value=product.burn_time||"";$("#materials").value=product.materials||"";$("#care-instructions").value=product.care_instructions||"";$("#form-title").textContent=product.id?"Edit product":"Add product";$("#notice").textContent="";renderGalleryEditor();$("#editor").showModal();
}
async function uploadImage(file,productId){
  const extension=file.name.split(".").pop().toLowerCase(),path=`${productId}/${crypto.randomUUID()}.${extension}`;
  const{error}=await supabase.storage.from("product-images").upload(path,file,{cacheControl:"31536000",contentType:file.type,upsert:false});if(error)throw error;
  const{data}=supabase.storage.from("product-images").getPublicUrl(path);return{image_url:data.publicUrl,image_path:path};
}
async function deleteProduct(id){
  const product=products.find(item=>item.id===id);if(!product||!confirm(`Delete "${product.name}"? Its customer reviews will also be removed. This cannot be undone.`))return;
  const paths=[...new Set(productGallery(product).map(image=>image.image_path).filter(Boolean))];const{error}=await supabase.from("products").delete().eq("id",id);if(error){alert(error.message);return}if(paths.length)await supabase.storage.from("product-images").remove(paths);await loadDashboard();
}

$("#product-form").onsubmit=async event=>{
  event.preventDefault();const save=$("#save-product");save.disabled=true;save.textContent="Saving product & photos…";$("#notice").textContent="";const uploadedPaths=[];let galleryWriteStarted=false;
  try{
    const id=$("#product-id").value,row={name:$("#product-name").value.trim(),slug:slugify($("#slug").value),category:$("#category").value,price_cents:Math.round(Number($("#price").value)*100),inventory:$("#inventory").value===""?null:Number($("#inventory").value),sort_order:Number($("#sort").value),badge:$("#badge").value.trim(),visual:$("#visual").value.trim()||"✦",color:$("#color").value,active:$("#active").value==="true",featured:$("#featured").value==="true",description:$("#description").value.trim(),scent_notes:$("#scent-notes").value.trim(),size_label:$("#size-label").value.trim(),burn_time:$("#burn-time").value.trim(),materials:$("#materials").value.trim(),care_instructions:$("#care-instructions").value.trim()};
    const result=id?await supabase.from("products").update(row).eq("id",id).select("id").single():await supabase.from("products").insert(row).select("id").single();if(result.error)throw result.error;const productId=result.data.id;
    for(const image of galleryDraft){if(!image.file||image.image_path)continue;const uploaded=await uploadImage(image.file,productId);uploadedPaths.push(uploaded.image_path);Object.assign(image,uploaded)}
    const productName=row.name,existingRows=galleryDraft.filter(image=>image.id).map((image,index)=>({id:image.id,product_id:productId,image_url:image.image_url,image_path:image.image_path||null,alt_text:`${productName}${index?` — view ${index+1}`:""}`,sort_order:index})),newRows=galleryDraft.filter(image=>!image.id).map((image,index)=>({product_id:productId,image_url:image.image_url,image_path:image.image_path||null,alt_text:`${productName}${index?` — view ${index+1}`:""}`,sort_order:index}));
    galleryWriteStarted=true;if(existingRows.length){const{error}=await supabase.from("product_images").upsert(existingRows);if(error)throw error}if(newRows.length){const{data,error}=await supabase.from("product_images").insert(newRows).select("id,image_path,image_url");if(error)throw error;for(const saved of data||[]){const image=galleryDraft.find(entry=>!entry.id&&((saved.image_path&&entry.image_path===saved.image_path)||entry.image_url===saved.image_url));if(image)image.id=saved.id}}
    const removedIds=removedGallery.map(image=>image.id).filter(Boolean);if(removedIds.length){const{error}=await supabase.from("product_images").delete().eq("product_id",productId).in("id",removedIds);if(error)throw error}
    const cover=galleryDraft[0]||null;const{error:coverError}=await supabase.from("products").update({image_url:cover?.image_url||null,image_path:cover?.image_path||null}).eq("id",productId);if(coverError)throw coverError;
    const removedPaths=[...new Set(removedGallery.map(image=>image.image_path).filter(Boolean))];if(removedPaths.length)await supabase.storage.from("product-images").remove(removedPaths);releaseGalleryPreviews();galleryDraft=[];removedGallery=[];$("#editor").close();await loadDashboard();
  }catch(error){if(!galleryWriteStarted&&uploadedPaths.length){await supabase.storage.from("product-images").remove(uploadedPaths);for(const image of galleryDraft)if(uploadedPaths.includes(image.image_path)){image.image_url=null;image.image_path=null}}$("#notice").textContent=error.message||"Could not save the product and photos."}finally{save.disabled=false;save.textContent="Save product"}
};

$("#image-file").onchange=event=>{const files=[...event.target.files];$("#notice").textContent="";if(!files.length)return;const available=Math.max(0,8-galleryDraft.length);if(!available){$("#notice").textContent="A product can have up to 8 photos.";event.target.value="";return}for(const file of files.slice(0,available)){if(file.size>5242880){$("#notice").textContent=`${file.name} is larger than 5 MB and was not added.`;continue}if(!["image/jpeg","image/png","image/webp"].includes(file.type)){$("#notice").textContent=`${file.name} is not a supported image type.`;continue}galleryDraft.push({id:null,image_url:null,image_path:null,preview_url:URL.createObjectURL(file),file})}if(files.length>available)$("#notice").textContent=`Only ${available} more photo${available===1?"":"s"} could be added (8 maximum).`;event.target.value="";renderGalleryEditor()};
$("#product-name").oninput=()=>{if(!$("#product-id").value)$("#slug").value=slugify($("#product-name").value)};
function closeProductEditor(){releaseGalleryPreviews();galleryDraft=[];removedGallery=[];$("#editor").close()}
$("#product-search").oninput=renderProducts;$("#add").onclick=()=>openEditor();$("#add-secondary").onclick=()=>openEditor();$("#cancel").onclick=closeProductEditor;$("#dialog-x").onclick=closeProductEditor;
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
