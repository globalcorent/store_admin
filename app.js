const config=window.STORE_CONFIG||{};
const fallbackProducts=[
  {id:"c1",name:"Bombshell Pink",slug:"bombshell-pink",category:"gel-candles",description:"A confident floral blend of rose and calming lavender.",scent_notes:"Rose • Lavender",size_label:"",burn_time:"",materials:"",care_instructions:"",price_cents:2400,badge:"Bestseller",visual:"🕯️",color:"#f4c2cf",image_url:null,inventory:null,active:true},
  {id:"c2",name:"Burnt Orange",slug:"burnt-orange",category:"wax-candles",description:"Caribbean palm and lavender with a warm, sunlit finish.",scent_notes:"Palm • Lavender",size_label:"",burn_time:"",materials:"",care_instructions:"",price_cents:2600,badge:"Signature",visual:"🕯️",color:"#dc6b2f",image_url:null,inventory:null,active:true},
  {id:"c3",name:"Enchanted Bloom",slug:"enchanted-bloom",category:"gel-candles",description:"Jasmine, peony, tangerine and pineapple in full bloom.",scent_notes:"Jasmine • Peony • Tangerine",size_label:"",burn_time:"",materials:"",care_instructions:"",price_cents:2800,badge:"New",visual:"🌺",color:"#eed0df",image_url:null,inventory:null,active:true},
  {id:"c4",name:"Midnight Tide",slug:"midnight-tide",category:"wax-candles",description:"Cool water, musk and amber for a calm evening atmosphere.",scent_notes:"Water • Musk • Amber",size_label:"",burn_time:"",materials:"",care_instructions:"",price_cents:2800,badge:"",visual:"🌊",color:"#9cb8c8",image_url:null,inventory:null,active:true},
  {id:"c5",name:"Serene Lavender",slug:"serene-lavender",category:"wax-candles",description:"Soft lavender designed for slow nights and peaceful rooms.",scent_notes:"Lavender",size_label:"",burn_time:"",materials:"",care_instructions:"",price_cents:2400,badge:"Relax",visual:"🪻",color:"#c9b9dc",image_url:null,inventory:null,active:true},
  {id:"s1",name:"Honey Oat Glow",slug:"honey-oat-glow",category:"soaps",description:"A creamy, comforting bar with a warm honey-oat aroma.",scent_notes:"Honey • Oat",size_label:"",burn_time:"",materials:"",care_instructions:"",price_cents:1000,badge:"Gentle",visual:"🧼",color:"#ead3a6",image_url:null,inventory:null,active:true},
  {id:"s2",name:"Citrus Garden",slug:"citrus-garden",category:"soaps",description:"A bright cleansing bar with fresh citrus and garden herbs.",scent_notes:"Citrus • Herbs",size_label:"",burn_time:"",materials:"",care_instructions:"",price_cents:1000,badge:"Fresh",visual:"🍊",color:"#f4c66a",image_url:null,inventory:null,active:true},
  {id:"s3",name:"Lavender Cloud",slug:"lavender-cloud",category:"soaps",description:"A soothing lavender bar with a soft, clean finish.",scent_notes:"Lavender",size_label:"",burn_time:"",materials:"",care_instructions:"",price_cents:1100,badge:"",visual:"☁️",color:"#d9d0ea",image_url:null,inventory:null,active:true},
  {id:"a1",name:"Golden Wick Trimmer",slug:"golden-wick-trimmer",category:"accessories",description:"Keep every flame clean and controlled with a precise trim.",scent_notes:"",size_label:"",burn_time:"",materials:"",care_instructions:"",price_cents:1600,badge:"Essential",visual:"✂️",color:"#e8cf8e",image_url:null,inventory:null,active:true},
  {id:"a2",name:"Candle Snuffer",slug:"candle-snuffer",category:"accessories",description:"A graceful, smoke-conscious way to end your candle ritual.",scent_notes:"",size_label:"",burn_time:"",materials:"",care_instructions:"",price_cents:1800,badge:"",visual:"🔔",color:"#c9b28c",image_url:null,inventory:null,active:true},
  {id:"a3",name:"Signature Gift Set",slug:"signature-gift-set",category:"accessories",description:"A ready-to-give candle, soap and care accessory bundle.",scent_notes:"",size_label:"",burn_time:"",materials:"",care_instructions:"",price_cents:4900,badge:"Gift Ready",visual:"🎁",color:"#eab7a1",image_url:null,inventory:null,active:true}
];

let products=fallbackProducts,reviews=[];
let cart=JSON.parse(localStorage.getItem("adw-cart")||"[]");
let supabase=null;
const el=selector=>document.querySelector(selector);
const money=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const categoryImages={"gel-candles":"assets/collection-gel-candles.webp","wax-candles":"assets/collection-wax-candles.webp",candles:"assets/collection-wax-candles.webp",soaps:"assets/collection-soaps.webp",accessories:"assets/collection-accessories.webp"};
const categoryLabels={"gel-candles":"Gel candle","wax-candles":"Wax candle",candles:"Candle",soaps:"Handmade soap",accessories:"Candle accessory"};
const categoryLabel=category=>categoryLabels[category]||category;
const isCandle=product=>["gel-candles","wax-candles","candles"].includes(product.category);
const productImage=product=>product.image_url||categoryImages[product.category]||categoryImages.accessories;
const productReviews=id=>reviews.filter(review=>review.product_id===id);
const reviewSummary=id=>{const list=productReviews(id);return{count:list.length,average:list.length?list.reduce((sum,item)=>sum+item.rating,0)/list.length:0}};
const stars=rating=>`<span class="stars" aria-label="${Number(rating).toFixed(1)} out of 5 stars">${[1,2,3,4,5].map(value=>value<=Math.round(rating)?"★":"☆").join("")}</span>`;

async function loadStore(){
  if(config.SUPABASE_URL&&config.SUPABASE_PUBLISHABLE_KEY){
    try{
      const{createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      supabase=createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY);
      const productResult=await supabase.from("products").select("id,name,slug,category,description,scent_notes,size_label,burn_time,materials,care_instructions,featured,price_cents,badge,visual,color,image_url,active,inventory").eq("active",true).order("sort_order");
      if(productResult.error)throw productResult.error;
      if(productResult.data?.length)products=productResult.data;
      const reviewResult=await supabase.from("reviews").select("id,product_id,author_name,rating,title,body,verified_purchase,created_at").order("created_at",{ascending:false});
      if(!reviewResult.error)reviews=reviewResult.data||[];
      cart=cart.filter(item=>products.some(product=>product.id===item.id));persistCart();
    }catch(error){console.warn("Using sample catalog:",error.message);showToast("We’re refreshing the live catalog. Please try again shortly.")}
  }
  el(".loading").hidden=true;renderProducts("all");renderCart();
}

function renderProducts(category){
  const list=category==="all"?products:products.filter(product=>product.category===category);
  el(".product-grid").innerHTML=list.length?list.map(product=>{
    const summary=reviewSummary(product.id),soldOut=product.inventory===0;
    return `<article class="product-card" data-id="${escapeHtml(product.id)}">
      <div class="product-image ${product.image_url?"has-photo":"fallback-photo"}" style="--product-bg:${escapeHtml(product.color)}">
        <img class="product-photo" src="${escapeHtml(productImage(product))}" alt="${escapeHtml(product.name)}" loading="lazy">
        ${product.badge?`<span class="product-badge">${escapeHtml(product.badge)}</span>`:""}
        ${soldOut?'<span class="sold-out-badge">Sold out</span>':""}
        ${product.image_url?"":`<span class="product-visual" aria-hidden="true">${escapeHtml(product.visual||"✦")}</span>`}
        <button class="quick-add" data-add="${escapeHtml(product.id)}" ${soldOut?"disabled":""}>${soldOut?"Sold out":"Add to bag"}</button>
      </div>
      <div class="product-info"><span class="product-meta">${escapeHtml(categoryLabel(product.category))}</span><div class="product-title-row"><h3 class="product-title">${escapeHtml(product.name)}</h3><span class="product-price">${money(product.price_cents)}</span></div>${product.scent_notes?`<p class="scent-notes">${escapeHtml(product.scent_notes)}</p>`:""}<p class="product-desc">${escapeHtml(product.description)}</p><div class="product-rating">${summary.count?`${stars(summary.average)} <span>${summary.average.toFixed(1)} (${summary.count})</span>`:'<span>New arrival • Be the first to review</span>'}</div></div>
    </article>`}).join(""):'<div class="empty-products"><h3>More handmade pieces are coming.</h3><p>Try another collection while this one is being prepared.</p></div>';
  document.querySelectorAll(".product-image").forEach(node=>node.addEventListener("click",event=>{if(!event.target.matches("[data-add]"))openProduct(node.closest("article").dataset.id)}));
  document.querySelectorAll("[data-add]:not(:disabled)").forEach(button=>button.addEventListener("click",()=>addToCart(button.dataset.add)));
}

function addToCart(id){const product=products.find(entry=>entry.id===id);if(!product||product.inventory===0){showToast("This item is currently sold out.");return}const item=cart.find(entry=>entry.id===id);if(item)item.quantity++;else cart.push({id,quantity:1});persistCart();renderCart();showToast("Added to your bag")}
function changeQty(id,delta){const item=cart.find(entry=>entry.id===id);if(!item)return;item.quantity+=delta;if(item.quantity<1)cart=cart.filter(entry=>entry.id!==id);persistCart();renderCart()}
function removeItem(id){cart=cart.filter(entry=>entry.id!==id);persistCart();renderCart()}
function persistCart(){localStorage.setItem("adw-cart",JSON.stringify(cart))}
function detailedCart(){return cart.map(item=>({...item,product:products.find(product=>product.id===item.id)})).filter(item=>item.product)}
function renderCart(){
  const items=detailedCart(),count=items.reduce((sum,item)=>sum+item.quantity,0),subtotal=items.reduce((sum,item)=>sum+item.product.price_cents*item.quantity,0);
  const candleCount=items.reduce((sum,item)=>sum+(isCandle(item.product)?item.quantity:0),0);
  const estimatedAfterDeal=items.reduce((sum,item)=>sum+Math.round(item.product.price_cents*(isCandle(item.product)&&candleCount>=3?.85:1))*item.quantity,0);
  const remaining=Math.max(0,7500-estimatedAfterDeal),progress=Math.min(100,estimatedAfterDeal/7500*100);
  el(".cart-count").textContent=count;el(".cart-subtotal").textContent=money(subtotal);el(".cart-empty").classList.toggle("visible",!items.length);el(".cart-summary").hidden=!items.length;
  el(".shipping-progress").textContent=remaining?`${money(remaining)} away from free U.S. shipping${candleCount>=3?" after candle savings":""}.`:"You unlocked free U.S. shipping.";
  el(".shipping-meter i").style.width=`${progress}%`;
  el(".cart-items").innerHTML=items.map(({product,quantity})=>`<div class="cart-item"><img class="cart-thumb" src="${escapeHtml(productImage(product))}" alt=""><div><h3>${escapeHtml(product.name)}</h3><p>${money(product.price_cents)}</p><div class="qty"><button data-qty="-1" data-id="${escapeHtml(product.id)}" aria-label="Decrease quantity">−</button><span>${quantity}</span><button data-qty="1" data-id="${escapeHtml(product.id)}" aria-label="Increase quantity">+</button></div></div><button class="remove" data-remove="${escapeHtml(product.id)}">Remove</button></div>`).join("");
  document.querySelectorAll("[data-qty]").forEach(button=>button.onclick=()=>changeQty(button.dataset.id,Number(button.dataset.qty)));
  document.querySelectorAll("[data-remove]").forEach(button=>button.onclick=()=>removeItem(button.dataset.remove));
}

function openCart(){el(".cart-drawer").classList.add("open");el(".cart-drawer").setAttribute("aria-hidden","false");el(".scrim").hidden=false;document.body.classList.add("locked")}
function closeCart(){el(".cart-drawer").classList.remove("open");el(".cart-drawer").setAttribute("aria-hidden","true");el(".scrim").hidden=true;document.body.classList.remove("locked")}

function renderReviewList(product){
  const list=productReviews(product.id);
  if(!list.length)return '<div class="no-reviews"><h3>Be the first to share your experience.</h3><p>Honest reviews help a handmade business grow.</p></div>';
  return `<div class="review-list">${list.slice(0,6).map(review=>`<article class="review"><div>${stars(review.rating)}${review.verified_purchase?'<span class="verified-review">Verified purchase</span>':""}</div><h3>${escapeHtml(review.title||product.name)}</h3><p>${escapeHtml(review.body)}</p><small>${escapeHtml(review.author_name)} • ${new Date(review.created_at).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"})}</small></article>`).join("")}</div>`;
}

function openProduct(id){
  const product=products.find(item=>item.id===id);if(!product)return;
  const summary=reviewSummary(product.id),soldOut=product.inventory===0;
  const specs=[product.scent_notes&&["Scent notes",product.scent_notes],product.size_label&&["Size",product.size_label],product.burn_time&&["Approx. burn time",product.burn_time],product.materials&&[product.category==="soaps"?"Ingredients / materials":"Materials",product.materials]].filter(Boolean);
  el(".dialog-content").innerHTML=`<div class="dialog-product"><div class="dialog-image ${product.image_url?"has-photo":"fallback-photo"}" style="--product-bg:${escapeHtml(product.color)}"><img src="${escapeHtml(productImage(product))}" alt="${escapeHtml(product.name)}">${product.image_url?"":`<span>${escapeHtml(product.visual||"✦")}</span>`}</div><div class="dialog-copy"><p class="eyebrow">${escapeHtml(categoryLabel(product.category))}</p><h2>${escapeHtml(product.name)}</h2><div class="dialog-rating">${summary.count?`${stars(summary.average)} <span>${summary.average.toFixed(1)} from ${summary.count} review${summary.count===1?"":"s"}</span>`:'<span>New • No published reviews yet</span>'}</div><p class="price">${money(product.price_cents)}</p><p>${escapeHtml(product.description)}</p>${specs.length?`<dl class="product-specs">${specs.map(([label,value])=>`<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`:""}${product.care_instructions?`<div class="specific-care"><strong>Care instructions</strong><p>${escapeHtml(product.care_instructions)}</p></div>`:""}<div class="product-promise"><span>Handmade in small batches</span><span>Secure checkout through Stripe</span><span>U.S. shipping • 14-day unopened returns</span></div><button class="button primary" data-dialog-add="${escapeHtml(product.id)}" ${soldOut?"disabled":""}>${soldOut?"Currently sold out":"Add to bag"}</button></div></div>
    <section class="product-reviews"><div class="reviews-heading"><div><p class="eyebrow">CUSTOMER REVIEWS</p><h2>Real feedback, moderated before publishing.</h2></div>${summary.count?`<div class="rating-total">${summary.average.toFixed(1)} ${stars(summary.average)}<small>${summary.count} published review${summary.count===1?"":"s"}</small></div>`:""}</div>${renderReviewList(product)}<form class="review-form"><h3>Review ${escapeHtml(product.name)}</h3><p>Your review will appear after approval. Please share only your genuine experience.</p><div class="review-form-grid"><label>Your name<input name="author_name" minlength="2" maxlength="80" required autocomplete="name"></label><label>Rating<select name="rating" required><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Average</option><option value="2">2 — Needs improvement</option><option value="1">1 — Poor</option></select></label><label class="form-wide">Review title <small>Optional</small><input name="title" maxlength="120"></label><label class="form-wide">Your review<textarea name="body" minlength="20" maxlength="1200" required placeholder="What did you like? How did you use it?"></textarea></label><label class="review-honeypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label></div><button class="button primary" type="submit">Submit for approval</button><p class="review-message" aria-live="polite"></p></form></section>`;
  const addButton=el("[data-dialog-add]");if(addButton&&!soldOut)addButton.onclick=()=>{addToCart(product.id);el(".product-dialog").close();openCart()};
  el(".review-form").onsubmit=event=>submitReview(event,product.id);
  el(".product-dialog").showModal();
}

async function submitReview(event,productId){
  event.preventDefault();const form=event.currentTarget,message=form.querySelector(".review-message"),button=form.querySelector("button[type=submit]"),data=new FormData(form);
  if(data.get("website")){form.reset();message.textContent="Thank you. Your review is pending approval.";return}
  if(!supabase){message.textContent="Reviews are unavailable right now. Please refresh and try again.";return}
  button.disabled=true;button.textContent="Submitting…";message.textContent="";
  const{error}=await supabase.from("reviews").insert({product_id:productId,author_name:String(data.get("author_name")||"").trim(),rating:Number(data.get("rating")),title:String(data.get("title")||"").trim(),body:String(data.get("body")||"").trim(),approved:false,verified_purchase:false});
  if(error){message.textContent="We couldn’t submit that review. Please check the form and try again.";button.disabled=false;button.textContent="Submit for approval";return}
  form.reset();button.hidden=true;message.classList.add("success");message.textContent="Thank you. Your review is pending approval and will not appear until it is checked.";
}

async function checkout(){
  if(!supabase){showToast("Checkout is getting ready. Please refresh.");return}
  const validItems=detailedCart().map(({product,quantity})=>({id:product.id,quantity}));if(!validItems.length){showToast("Your bag is empty.");return}
  const button=el(".checkout-button");button.disabled=true;button.textContent="Opening secure checkout…";
  try{const{data,error}=await supabase.functions.invoke(config.CHECKOUT_FUNCTION||"create-checkout-session",{body:{items:validItems}});if(error)throw error;if(!data?.url)throw new Error("No checkout URL returned");location.assign(data.url)}catch(error){console.error(error);showToast("Checkout could not open. Please try again.");button.disabled=false;button.textContent="Secure checkout"}
}
function showToast(message){const toast=el(".toast");toast.textContent=message;toast.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove("show"),2800)}

document.querySelectorAll(".filter").forEach(button=>button.onclick=()=>{document.querySelector(".filter.active")?.classList.remove("active");button.classList.add("active");renderProducts(button.dataset.category)});
document.querySelectorAll("[data-category-jump]").forEach(tile=>tile.onclick=()=>{const category=tile.dataset.categoryJump;document.querySelector(".filter.active")?.classList.remove("active");const filter=document.querySelector(`[data-category="${category}"]`);filter.classList.add("active");renderProducts(category);filter.scrollIntoView({behavior:"smooth",block:"center"})});
el(".cart-button").onclick=openCart;el(".cart-close").onclick=closeCart;el(".scrim").onclick=closeCart;el(".continue-shopping").onclick=()=>{closeCart();location.hash="shop"};el(".checkout-button").onclick=checkout;el(".dialog-close").onclick=()=>el(".product-dialog").close();
el(".nav-toggle").onclick=()=>{const nav=el(".main-nav"),open=nav.classList.toggle("open");el(".nav-toggle").setAttribute("aria-expanded",open)};document.querySelectorAll(".main-nav a").forEach(link=>link.onclick=()=>el(".main-nav").classList.remove("open"));
el(".newsletter-form").onsubmit=async event=>{event.preventDefault();const message=el(".form-message"),email=el("#newsletter-email").value.trim();if(!supabase){message.textContent="Please refresh and try again.";return}const{error}=await supabase.functions.invoke("subscribe-newsletter",{body:{email}});message.textContent=error?"We couldn’t save that email. Please try again.":"Thank you — you’re on the list!";if(!error)event.target.reset()};
el("#year").textContent=new Date().getFullYear();
if(new URLSearchParams(location.search).get("checkout")==="success"){cart=[];persistCart();history.replaceState({},"",location.pathname);setTimeout(()=>showToast("Thank you! Your paid order was received."),500)}
loadStore();
