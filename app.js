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

let products=fallbackProducts,reviews=[],currentUser=null,appliedCoupon=localStorage.getItem("adw-coupon")||"",quoteSequence=0;
let cart=JSON.parse(localStorage.getItem("adw-cart")||"[]");
let supabase=null;
const el=selector=>document.querySelector(selector);
const money=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const categoryImages={"gel-candles":"assets/collection-gel-candles.webp","wax-candles":"assets/collection-wax-candles.webp",candles:"assets/collection-wax-candles.webp",soaps:"assets/collection-soaps.webp",accessories:"assets/collection-accessories.webp"};
const categoryLabels={"gel-candles":"Gel candle","wax-candles":"Wax candle",candles:"Candle",soaps:"Handmade soap",accessories:"Candle accessory"};
const categoryLabel=category=>categoryLabels[category]||category;
const isCandle=product=>["gel-candles","wax-candles","candles"].includes(product.category);
const discountedCandlePrice=(product,dealActive)=>dealActive&&isCandle(product)?Math.round(product.price_cents*.85):product.price_cents;
const productGallery=product=>{const rows=[...(product.product_images||[])].filter(image=>image.image_url).sort((a,b)=>a.sort_order-b.sort_order).map(image=>({url:image.image_url,alt:image.alt_text||product.name,real:true}));if(rows.length)return rows;if(product.image_url)return[{url:product.image_url,alt:product.name,real:true}];return[{url:categoryImages[product.category]||categoryImages.accessories,alt:product.name,real:false}]};
const productImage=product=>productGallery(product)[0].url;
const productHasPhoto=product=>productGallery(product).some(image=>image.real);
const productReviews=id=>reviews.filter(review=>review.product_id===id);
const reviewSummary=id=>{const list=productReviews(id);return{count:list.length,average:list.length?list.reduce((sum,item)=>sum+item.rating,0)/list.length:0}};
const stars=rating=>`<span class="stars" aria-label="${Number(rating).toFixed(1)} out of 5 stars">${[1,2,3,4,5].map(value=>value<=Math.round(rating)?"★":"☆").join("")}</span>`;

async function loadStore(){
  if(config.SUPABASE_URL&&config.SUPABASE_PUBLISHABLE_KEY){
    try{
      const{createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      supabase=createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY);
      const sessionResult=await supabase.auth.getSession();currentUser=sessionResult.data.session?.user||null;
      const productResult=await supabase.from("products").select("id,name,slug,category,description,scent_notes,size_label,burn_time,materials,care_instructions,featured,price_cents,badge,visual,color,image_url,active,inventory,product_images(id,image_url,alt_text,sort_order)").eq("active",true).order("sort_order");
      if(productResult.error)throw productResult.error;
      if(productResult.data?.length)products=productResult.data;
      const reviewResult=await supabase.from("reviews").select("id,product_id,author_name,rating,title,body,verified_purchase,created_at").order("created_at",{ascending:false});
      if(!reviewResult.error)reviews=reviewResult.data||[];
      cart=cart.filter(item=>products.some(product=>product.id===item.id));persistCart();
    }catch(error){console.warn("Using sample catalog:",error.message);showToast("We’re refreshing the live catalog. Please try again shortly.")}
  }
  el(".loading").hidden=true;renderProducts("all");renderCart();renderAccountOrderNote();
  if(localStorage.getItem("adw-open-cart")==="1"){localStorage.removeItem("adw-open-cart");openCart();showToast("Available favorites were added from your order.")}
}

function renderAccountOrderNote(){const note=el(".account-order-note");if(!note)return;note.innerHTML=currentUser?'✓ This purchase will be saved to <a href="account.html">your account</a>.':'<a href="auth.html">Sign in before checkout</a> to save this purchase to your account.'}

function renderProducts(category){
  const list=category==="all"?products:products.filter(product=>product.category===category);
  el(".product-grid").innerHTML=list.length?list.map(product=>{
    const summary=reviewSummary(product.id),soldOut=product.inventory===0,hasPhoto=productHasPhoto(product),photoCount=productGallery(product).filter(image=>image.real).length;
    return `<article class="product-card" data-id="${escapeHtml(product.id)}">
      <div class="product-image ${hasPhoto?"has-photo":"fallback-photo"}" style="--product-bg:${escapeHtml(product.color)}">
        <img class="product-photo" src="${escapeHtml(productImage(product))}" alt="${escapeHtml(product.name)}" loading="lazy">
        ${product.badge?`<span class="product-badge">${escapeHtml(product.badge)}</span>`:""}
        ${photoCount>1?`<span class="product-photo-count">▧ ${photoCount} photos</span>`:""}
        ${soldOut?'<span class="sold-out-badge">Sold out</span>':""}
        ${hasPhoto?"":`<span class="product-visual" aria-hidden="true">${escapeHtml(product.visual||"✦")}</span>`}
        <button class="quick-add" data-add="${escapeHtml(product.id)}" ${soldOut?"disabled":""}>${soldOut?"Sold out":"Add to cart"}</button>
      </div>
      <div class="product-info"><span class="product-meta">${escapeHtml(categoryLabel(product.category))}</span><div class="product-title-row"><h3 class="product-title">${escapeHtml(product.name)}</h3><span class="product-price">${money(product.price_cents)}</span></div>${product.scent_notes?`<p class="scent-notes">${escapeHtml(product.scent_notes)}</p>`:""}<p class="product-desc">${escapeHtml(product.description)}</p><div class="product-rating">${summary.count?`${stars(summary.average)} <span>${summary.average.toFixed(1)} (${summary.count})</span>`:'<span>New arrival • Be the first to review</span>'}</div></div>
    </article>`}).join(""):'<div class="empty-products"><h3>More handmade pieces are coming.</h3><p>Try another collection while this one is being prepared.</p></div>';
  document.querySelectorAll(".product-image").forEach(node=>node.addEventListener("click",event=>{if(!event.target.matches("[data-add]"))openProduct(node.closest("article").dataset.id)}));
  document.querySelectorAll("[data-add]:not(:disabled)").forEach(button=>button.addEventListener("click",()=>addToCart(button.dataset.add)));
}

function addToCart(id){const product=products.find(entry=>entry.id===id);if(!product||product.inventory===0){showToast("This item is currently sold out.");return}const item=cart.find(entry=>entry.id===id),limit=product.inventory==null?20:Math.min(20,product.inventory);if(item&&item.quantity>=limit){showToast(limit===20?"Maximum quantity reached.":`Only ${limit} available right now.`);return}if(item)item.quantity++;else cart.push({id,quantity:1});persistCart();renderCart();showToast("Added to your cart")}
function changeQty(id,delta){const item=cart.find(entry=>entry.id===id);if(!item)return;const product=products.find(entry=>entry.id===id),limit=product?.inventory==null?20:Math.min(20,product.inventory);if(delta>0&&item.quantity>=limit){showToast(limit===20?"Maximum quantity reached.":`Only ${limit} available right now.`);return}item.quantity+=delta;if(item.quantity<1)cart=cart.filter(entry=>entry.id!==id);persistCart();renderCart()}
function removeItem(id){cart=cart.filter(entry=>entry.id!==id);persistCart();renderCart()}
function persistCart(){localStorage.setItem("adw-cart",JSON.stringify(cart))}
function detailedCart(){return cart.map(item=>({...item,product:products.find(product=>product.id===item.id)})).filter(item=>item.product)}
function calculateCartPricing(items){
  const candleCount=items.reduce((sum,item)=>sum+(isCandle(item.product)?item.quantity:0),0),dealActive=candleCount>=3;
  const merchandise=items.reduce((sum,item)=>sum+item.product.price_cents*item.quantity,0);
  const discountedMerchandise=items.reduce((sum,item)=>sum+discountedCandlePrice(item.product,dealActive)*item.quantity,0);
  const savings=merchandise-discountedMerchandise,remaining=Math.max(0,7500-discountedMerchandise),shipping=remaining?795:0;
  return{candleCount,dealActive,merchandise,discountedMerchandise,savings,remaining,shipping,estimatedTotal:discountedMerchandise+shipping};
}
function renderCart(){
  const items=detailedCart(),count=items.reduce((sum,item)=>sum+item.quantity,0);
  const{candleCount,dealActive,merchandise,discountedMerchandise,savings,remaining,shipping,estimatedTotal}=calculateCartPricing(items),progress=Math.min(100,discountedMerchandise/7500*100),candlesNeeded=Math.max(0,3-candleCount);
  el(".cart-count").textContent=count;el(".cart-head-count").textContent=`${count} ${count===1?"item":"items"}`;el(".cart-merchandise").textContent=money(merchandise);el(".cart-savings").textContent=`−${money(savings)}`;el(".cart-shipping").textContent=shipping?money(shipping):"FREE";el(".cart-subtotal").textContent=money(estimatedTotal);el(".cart-savings-row").classList.toggle("visible",savings>0);el(".cart-empty").classList.toggle("visible",!items.length);el(".cart-summary").hidden=!items.length;el(".cart-offer-stack").hidden=!items.length;
  el(".shipping-progress").textContent=remaining?`${money(remaining)} away from free shipping${dealActive?" after savings":""}`:"Free U.S. shipping unlocked";el(".shipping-meter-bar i").style.width=`${progress}%`;
  el(".bundle-progress").textContent=candlesNeeded?`Add ${candlesNeeded} more candle${candlesNeeded===1?"":"s"} to save 15%`:`15% applied — you saved ${money(savings)}`;el(".deal-meter i").style.width=`${Math.min(100,candleCount/3*100)}%`;
  const discountConfirmation=el(".cart-discount-confirmation");discountConfirmation.hidden=!dealActive;el(".cart-promotion-name").textContent="15% candle deal applied";el(".cart-discount-copy").textContent=dealActive?`You saved ${money(savings)} on ${candleCount} candle${candleCount===1?"":"s"}.`:"Your qualifying savings are included above.";
  el(".cart-items").innerHTML=items.map(({product,quantity})=>{const candleDeal=dealActive&&isCandle(product),regularLine=product.price_cents*quantity,discountedLine=discountedCandlePrice(product,dealActive)*quantity;return`<article class="cart-item"><img class="cart-thumb" src="${escapeHtml(productImage(product))}" alt="${escapeHtml(product.name)}"><div class="cart-item-copy"><span class="cart-item-category">${escapeHtml(categoryLabel(product.category))}${product.size_label?` • ${escapeHtml(product.size_label)}`:""}</span><h3>${escapeHtml(product.name)}</h3><p>${money(product.price_cents)} each <b data-line-badge="${escapeHtml(product.id)}" ${candleDeal?"":"hidden"}>${candleDeal?"15% deal applied":"Promotion applied"}</b></p><div class="qty"><button data-qty="-1" data-id="${escapeHtml(product.id)}" aria-label="Decrease ${escapeHtml(product.name)} quantity">−</button><span aria-live="polite">${quantity}</span><button data-qty="1" data-id="${escapeHtml(product.id)}" aria-label="Increase ${escapeHtml(product.name)} quantity">+</button></div></div><div class="cart-item-end"><div class="cart-line-price" data-line-price="${escapeHtml(product.id)}">${candleDeal?`<del>${money(regularLine)}</del>`:""}<strong>${money(discountedLine)}</strong></div><button class="remove" data-remove="${escapeHtml(product.id)}" aria-label="Remove ${escapeHtml(product.name)}">Remove</button></div></article>`}).join("");
  const hasCandle=items.some(item=>isCandle(item.product)),recommendations=items.length?products.filter(product=>product.active!==false&&product.inventory!==0&&!cart.some(item=>item.id===product.id)).sort((a,b)=>{const score=product=>hasCandle?(product.category==="accessories"?0:product.category==="soaps"?1:2):(product.featured?0:1);return score(a)-score(b)}).slice(0,2):[],recommendationSection=el(".cart-recommendations");recommendationSection.hidden=!recommendations.length;el(".cart-recommendation-grid").innerHTML=recommendations.map(product=>`<article><img src="${escapeHtml(productImage(product))}" alt=""><div><span>${escapeHtml(categoryLabel(product.category))}</span><strong>${escapeHtml(product.name)}</strong><small>${money(product.price_cents)}</small></div><button type="button" data-cart-recommend="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)} to cart">+</button></article>`).join("");document.querySelectorAll("[data-cart-recommend]").forEach(button=>button.onclick=()=>addToCart(button.dataset.cartRecommend));
  document.querySelectorAll("[data-qty]").forEach(button=>button.onclick=()=>changeQty(button.dataset.id,Number(button.dataset.qty)));
  document.querySelectorAll("[data-remove]").forEach(button=>button.onclick=()=>removeItem(button.dataset.remove));
  if(items.length)void refreshCartQuote(items);else{quoteSequence++;el(".cart-coupon-message").textContent=""}
}

function applyCartQuote(quote){
  el(".cart-merchandise").textContent=money(quote.merchandise_cents);el(".cart-savings").textContent=`−${money(quote.discount_cents)}`;el(".cart-shipping").textContent=quote.shipping_cents?money(quote.shipping_cents):"FREE";el(".cart-subtotal").textContent=money(quote.total_cents);el(".cart-savings-row").classList.toggle("visible",quote.discount_cents>0);el(".cart-discount-label").textContent=quote.promotion?.name||"Promotion savings";
  const confirmation=el(".cart-discount-confirmation");confirmation.hidden=!quote.promotion;el(".cart-promotion-name").textContent=quote.promotion?.name||"Promotion applied";el(".cart-discount-copy").textContent=quote.promotion?`You saved ${money(quote.discount_cents)} on this order.`:"Your qualifying savings are included above.";
  const remaining=quote.remaining_free_shipping_cents;el(".shipping-progress").textContent=remaining?`${money(remaining)} away from free shipping${quote.discount_cents?" after savings":""}`:"Free U.S. shipping unlocked";el(".shipping-meter-bar i").style.width=`${Math.min(100,quote.discounted_merchandise_cents/7500*100)}%`;
  const hint=quote.bundle_hint,bundle=el(".bundle-offer");bundle.hidden=!hint;if(hint){const needed=Math.max(0,hint.min_quantity-hint.eligible_quantity),offer=hint.discount_type==="percentage"?`${hint.discount_value}%`:`${money(hint.discount_value)}`,isApplied=quote.promotion?.id===hint.id;el(".bundle-progress").textContent=needed?`Add ${needed} more qualifying item${needed===1?"":"s"} to save ${offer}`:isApplied?`${hint.name} applied — you saved ${money(quote.discount_cents)}`:`${hint.name} is unlocked; your best deal appears below`;el(".deal-meter i").style.width=`${Math.min(100,hint.eligible_quantity/hint.min_quantity*100)}%`}
  const totals=new Map((quote.lines||[]).map(line=>[line.product_id,line])),badges=new Map([...document.querySelectorAll("[data-line-badge]")].map(node=>[node.dataset.lineBadge,node]));document.querySelectorAll("[data-line-price]").forEach(node=>{const line=totals.get(node.dataset.linePrice);if(!line)return;const discounted=line.total_cents<line.regular_total_cents;node.innerHTML=`${discounted?`<del>${money(line.regular_total_cents)}</del>`:""}<strong>${money(line.total_cents)}</strong>`;const badge=badges.get(line.product_id);if(badge){badge.hidden=!discounted;badge.textContent=discounted?"Promotion applied":""}});
  const couponMessage=el(".cart-coupon-message");couponMessage.textContent=quote.coupon_message||"";couponMessage.className=`cart-coupon-message ${quote.coupon_status||""}`;
}
async function refreshCartQuote(items){
  if(!supabase)return;const request=++quoteSequence;try{const{data,error}=await supabase.functions.invoke("quote-cart",{body:{items:items.map(({product,quantity})=>({id:product.id,quantity})),coupon_code:appliedCoupon||null}});if(error)throw error;if(request!==quoteSequence)return;applyCartQuote(data)}catch(error){if(request!==quoteSequence)return;console.error("Cart quote failed",error);el(".cart-coupon-message").textContent="Could not verify promotions right now. Please try again."}
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
  const summary=reviewSummary(product.id),soldOut=product.inventory===0,gallery=productGallery(product),hasPhoto=productHasPhoto(product);
  const specs=[product.scent_notes&&["Scent notes",product.scent_notes],product.size_label&&["Size",product.size_label],product.burn_time&&["Approx. burn time",product.burn_time],product.materials&&[product.category==="soaps"?"Ingredients / materials":"Materials",product.materials]].filter(Boolean);
  el(".dialog-content").innerHTML=`<div class="dialog-product"><div class="dialog-gallery"><div class="dialog-image ${hasPhoto?"has-photo":"fallback-photo"}" style="--product-bg:${escapeHtml(product.color)}"><img id="dialog-main-image" src="${escapeHtml(gallery[0].url)}" alt="${escapeHtml(gallery[0].alt)}">${hasPhoto?"":`<span>${escapeHtml(product.visual||"✦")}</span>`}</div>${gallery.length>1?`<div class="product-thumbnails" aria-label="Product photos">${gallery.map((image,index)=>`<button type="button" class="${index===0?"active":""}" data-gallery-index="${index}" aria-label="View photo ${index+1}"><img src="${escapeHtml(image.url)}" alt=""></button>`).join("")}</div>`:""}</div><div class="dialog-copy"><p class="eyebrow">${escapeHtml(categoryLabel(product.category))}</p><h2>${escapeHtml(product.name)}</h2><div class="dialog-rating">${summary.count?`${stars(summary.average)} <span>${summary.average.toFixed(1)} from ${summary.count} review${summary.count===1?"":"s"}</span>`:'<span>New • No published reviews yet</span>'}</div><p class="price">${money(product.price_cents)}</p><p>${escapeHtml(product.description)}</p>${specs.length?`<dl class="product-specs">${specs.map(([label,value])=>`<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`:""}${product.care_instructions?`<div class="specific-care"><strong>Care instructions</strong><p>${escapeHtml(product.care_instructions)}</p></div>`:""}<div class="product-promise"><span>Handmade in small batches</span><span>Secure checkout through Stripe</span><span>U.S. shipping • 14-day unopened returns</span></div><button class="button primary" data-dialog-add="${escapeHtml(product.id)}" ${soldOut?"disabled":""}>${soldOut?"Currently sold out":"Add to cart"}</button></div></div>
    <section class="product-reviews"><div class="reviews-heading"><div><p class="eyebrow">CUSTOMER REVIEWS</p><h2>Real feedback, moderated before publishing.</h2></div>${summary.count?`<div class="rating-total">${summary.average.toFixed(1)} ${stars(summary.average)}<small>${summary.count} published review${summary.count===1?"":"s"}</small></div>`:""}</div>${renderReviewList(product)}<form class="review-form"><h3>Review ${escapeHtml(product.name)}</h3><p>Your review will appear after approval. Please share only your genuine experience.</p><div class="review-form-grid"><label>Your name<input name="author_name" minlength="2" maxlength="80" required autocomplete="name"></label><label>Rating<select name="rating" required><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Average</option><option value="2">2 — Needs improvement</option><option value="1">1 — Poor</option></select></label><label class="form-wide">Review title <small>Optional</small><input name="title" maxlength="120"></label><label class="form-wide">Your review<textarea name="body" minlength="20" maxlength="1200" required placeholder="What did you like? How did you use it?"></textarea></label><label class="review-honeypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label></div><button class="button primary" type="submit">Submit for approval</button><p class="review-message" aria-live="polite"></p></form></section>`;
  const addButton=el("[data-dialog-add]");if(addButton&&!soldOut)addButton.onclick=()=>{addToCart(product.id);el(".product-dialog").close();openCart()};
  document.querySelectorAll("[data-gallery-index]").forEach(button=>button.onclick=()=>{const index=Number(button.dataset.galleryIndex),image=gallery[index],main=el("#dialog-main-image");main.src=image.url;main.alt=image.alt;document.querySelector(".product-thumbnails .active")?.classList.remove("active");button.classList.add("active")});
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
  const validItems=detailedCart().map(({product,quantity})=>({id:product.id,quantity}));if(!validItems.length){showToast("Your cart is empty.");return}
  const button=el(".checkout-button");button.disabled=true;button.textContent="Opening secure checkout…";
  try{const{data,error}=await supabase.functions.invoke(config.CHECKOUT_FUNCTION||"create-checkout-session",{body:{items:validItems,coupon_code:appliedCoupon||null}});if(error)throw error;if(!data?.url)throw new Error("No checkout URL returned");location.assign(data.url)}catch(error){console.error(error);showToast("Checkout could not open. Please try again.");button.disabled=false;button.innerHTML="<span>▣</span> Continue to secure checkout"}
}
function showToast(message){const toast=el(".toast");toast.textContent=message;toast.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove("show"),2800)}

document.querySelectorAll(".filter").forEach(button=>button.onclick=()=>{document.querySelector(".filter.active")?.classList.remove("active");button.classList.add("active");renderProducts(button.dataset.category)});
document.querySelectorAll("[data-category-jump]").forEach(tile=>tile.onclick=()=>{const category=tile.dataset.categoryJump;document.querySelector(".filter.active")?.classList.remove("active");const filter=document.querySelector(`[data-category="${category}"]`);filter.classList.add("active");renderProducts(category);filter.scrollIntoView({behavior:"smooth",block:"center"})});
el(".cart-button").onclick=openCart;el(".cart-close").onclick=closeCart;el(".cart-continue").onclick=closeCart;el(".scrim").onclick=closeCart;el(".continue-shopping").onclick=()=>{closeCart();location.hash="shop"};el(".checkout-button").onclick=checkout;el(".dialog-close").onclick=()=>el(".product-dialog").close();
el(".nav-toggle").onclick=()=>{const nav=el(".main-nav"),open=nav.classList.toggle("open");el(".nav-toggle").setAttribute("aria-expanded",open)};document.querySelectorAll(".main-nav a").forEach(link=>link.onclick=()=>el(".main-nav").classList.remove("open"));
el("#cart-coupon-code").value=appliedCoupon;el("#cart-coupon-code").oninput=()=>{el("#cart-coupon-code").value=el("#cart-coupon-code").value.toUpperCase().replace(/[^A-Z0-9_-]/g,"")};el(".cart-coupon-form").onsubmit=event=>{event.preventDefault();appliedCoupon=el("#cart-coupon-code").value.trim().toUpperCase();if(appliedCoupon)localStorage.setItem("adw-coupon",appliedCoupon);else localStorage.removeItem("adw-coupon");el(".cart-coupon-message").textContent=appliedCoupon?"Checking code…":"Coupon removed.";const items=detailedCart();if(items.length)void refreshCartQuote(items)};
el(".newsletter-form").onsubmit=async event=>{event.preventDefault();const message=el(".form-message"),email=el("#newsletter-email").value.trim();if(!supabase){message.textContent="Please refresh and try again.";return}const{error}=await supabase.functions.invoke("subscribe-newsletter",{body:{email}});message.textContent=error?"We couldn’t save that email. Please try again.":"Thank you — you’re on the list!";if(!error)event.target.reset()};
el("#year").textContent=new Date().getFullYear();
if(new URLSearchParams(location.search).get("checkout")==="success"){cart=[];persistCart();history.replaceState({},"",location.pathname);setTimeout(()=>showToast("Thank you! Your paid order was received."),500)}
loadStore();
