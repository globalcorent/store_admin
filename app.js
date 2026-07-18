const config = window.STORE_CONFIG || {};

const fallbackProducts = [
  {id:"c1",name:"Bombshell Pink",slug:"bombshell-pink",category:"candles",description:"A confident floral blend of rose and calming lavender.",price_cents:2400,badge:"Bestseller",visual:"🕯️",color:"#f4c2cf",active:true},
  {id:"c2",name:"Burnt Orange",slug:"burnt-orange",category:"candles",description:"Caribbean palm and lavender with a warm, sunlit finish.",price_cents:2600,badge:"Signature",visual:"🕯️",color:"#dc6b2f",active:true},
  {id:"c3",name:"Enchanted Bloom",slug:"enchanted-bloom",category:"candles",description:"Jasmine, peony, tangerine and pineapple in full bloom.",price_cents:2800,badge:"New",visual:"🌺",color:"#eed0df",active:true},
  {id:"c4",name:"Midnight Tide",slug:"midnight-tide",category:"candles",description:"Cool water, musk and amber for a calm evening atmosphere.",price_cents:2800,badge:"",visual:"🌊",color:"#9cb8c8",active:true},
  {id:"c5",name:"Serene Lavender",slug:"serene-lavender",category:"candles",description:"Soft lavender designed for slow nights and peaceful rooms.",price_cents:2400,badge:"Relax",visual:"🪻",color:"#c9b9dc",active:true},
  {id:"s1",name:"Honey Oat Glow",slug:"honey-oat-glow",category:"soaps",description:"A creamy, comforting bar with a warm honey-oat aroma.",price_cents:1000,badge:"Gentle",visual:"🧼",color:"#ead3a6",active:true},
  {id:"s2",name:"Citrus Garden",slug:"citrus-garden",category:"soaps",description:"A bright cleansing bar with fresh citrus and garden herbs.",price_cents:1000,badge:"Fresh",visual:"🍊",color:"#f4c66a",active:true},
  {id:"s3",name:"Lavender Cloud",slug:"lavender-cloud",category:"soaps",description:"A soothing lavender bar with a soft, clean finish.",price_cents:1100,badge:"",visual:"☁️",color:"#d9d0ea",active:true},
  {id:"a1",name:"Golden Wick Trimmer",slug:"golden-wick-trimmer",category:"accessories",description:"Keep every flame clean and controlled with a precise trim.",price_cents:1600,badge:"Essential",visual:"✂️",color:"#e8cf8e",active:true},
  {id:"a2",name:"Candle Snuffer",slug:"candle-snuffer",category:"accessories",description:"A graceful, smoke-conscious way to end your candle ritual.",price_cents:1800,badge:"",visual:"🔔",color:"#c9b28c",active:true},
  {id:"a3",name:"Signature Gift Set",slug:"signature-gift-set",category:"accessories",description:"A ready-to-give candle, soap and care accessory bundle.",price_cents:4900,badge:"Gift Ready",visual:"🎁",color:"#eab7a1",active:true}
];

let products = fallbackProducts;
let cart = JSON.parse(localStorage.getItem("adw-cart") || "[]");
let supabase = null;
const money = cents => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
const el = selector => document.querySelector(selector);
const categoryImages={candles:"assets/collection-candles.webp",soaps:"assets/collection-soaps.webp",accessories:"assets/collection-accessories.webp"};

async function loadProducts(){
  if(config.SUPABASE_URL && config.SUPABASE_PUBLISHABLE_KEY){
    try{
      const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      supabase=createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY);
      const {data,error}=await supabase.from("products").select("id,name,slug,category,description,price_cents,badge,visual,color,active").eq("active",true).order("sort_order");
      if(error) throw error;
      if(data?.length) products=data;
    }catch(error){console.warn("Using sample catalog:",error.message);showToast("Sample catalog shown — connect Supabase when ready.");}
  }
  el(".loading").hidden=true; renderProducts("all"); renderCart();
}

function renderProducts(category){
  const list=category==="all"?products:products.filter(p=>p.category===category);
  el(".product-grid").innerHTML=list.map(p=>`<article class="product-card" data-id="${p.id}">
    <div class="product-image" style="--product-bg:${p.color}">
      <img class="product-photo" src="${categoryImages[p.category]}" alt="" loading="lazy">${p.badge?`<span class="product-badge">${p.badge}</span>`:""}<span class="product-visual" aria-hidden="true">${p.visual||"✦"}</span>
      <button class="quick-add" data-add="${p.id}">Quick add</button>
    </div><div class="product-info"><span class="product-meta">${p.category}</span><div class="product-title-row"><h3 class="product-title">${p.name}</h3><span class="product-price">${money(p.price_cents)}</span></div><p class="product-desc">${p.description}</p></div></article>`).join("");
  document.querySelectorAll(".product-image").forEach(node=>node.addEventListener("click",e=>{if(!e.target.matches("[data-add]"))openProduct(node.closest("article").dataset.id)}));
  document.querySelectorAll("[data-add]").forEach(button=>button.addEventListener("click",()=>addToCart(button.dataset.add)));
}

function addToCart(id){const item=cart.find(i=>i.id===id);if(item)item.quantity++;else cart.push({id,quantity:1});persistCart();renderCart();showToast("Added to your bag");}
function changeQty(id,delta){const item=cart.find(i=>i.id===id);if(!item)return;item.quantity+=delta;if(item.quantity<1)cart=cart.filter(i=>i.id!==id);persistCart();renderCart();}
function removeItem(id){cart=cart.filter(i=>i.id!==id);persistCart();renderCart();}
function persistCart(){localStorage.setItem("adw-cart",JSON.stringify(cart));}
function detailedCart(){return cart.map(item=>({...item,product:products.find(p=>p.id===item.id)})).filter(i=>i.product);}
function renderCart(){
  const items=detailedCart(),count=items.reduce((n,i)=>n+i.quantity,0),subtotal=items.reduce((n,i)=>n+i.product.price_cents*i.quantity,0);
  el(".cart-count").textContent=count;el(".cart-subtotal").textContent=money(subtotal);el(".cart-empty").classList.toggle("visible",!items.length);el(".cart-summary").hidden=!items.length;
  el(".cart-items").innerHTML=items.map(({product:p,quantity})=>`<div class="cart-item"><div class="cart-thumb" style="--product-bg:${p.color}">${p.visual||"✦"}</div><div><h3>${p.name}</h3><p>${money(p.price_cents)}</p><div class="qty"><button data-qty="-1" data-id="${p.id}" aria-label="Decrease quantity">−</button><span>${quantity}</span><button data-qty="1" data-id="${p.id}" aria-label="Increase quantity">+</button></div></div><button class="remove" data-remove="${p.id}">Remove</button></div>`).join("");
  document.querySelectorAll("[data-qty]").forEach(b=>b.onclick=()=>changeQty(b.dataset.id,Number(b.dataset.qty)));document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>removeItem(b.dataset.remove));
}
function openCart(){el(".cart-drawer").classList.add("open");el(".cart-drawer").setAttribute("aria-hidden","false");el(".scrim").hidden=false;document.body.classList.add("locked")}
function closeCart(){el(".cart-drawer").classList.remove("open");el(".cart-drawer").setAttribute("aria-hidden","true");el(".scrim").hidden=true;document.body.classList.remove("locked")}
function openProduct(id){const p=products.find(p=>p.id===id);if(!p)return;el(".dialog-content").innerHTML=`<div class="dialog-image" style="--product-bg:${p.color}"><img src="${categoryImages[p.category]}" alt="Styled ${p.category} collection preview"><span>${p.visual||"✦"}</span></div><div class="dialog-copy"><p class="eyebrow">${p.category}</p><h2>${p.name}</h2><p class="price">${money(p.price_cents)}</p><p>${p.description}</p><p>Thoughtfully made and carefully packed by Aromatic Designer Works.</p><button class="button primary" data-dialog-add="${p.id}">Add to bag</button></div>`;el("[data-dialog-add]").onclick=()=>{addToCart(p.id);el(".product-dialog").close();openCart()};el(".product-dialog").showModal()}
async function checkout(){
  if(!supabase){showToast("Connect Supabase and Stripe to activate checkout.");return}
  const button=el(".checkout-button");button.disabled=true;button.textContent="Opening secure checkout…";
  try{const {data,error}=await supabase.functions.invoke(config.CHECKOUT_FUNCTION||"create-checkout-session",{body:{items:cart.map(({id,quantity})=>({id,quantity})),successUrl:`${location.origin}${location.pathname}?checkout=success`,cancelUrl:location.href}});if(error)throw error;if(!data?.url)throw new Error("No checkout URL returned");location.assign(data.url)}catch(error){console.error(error);showToast("Checkout could not open. Please try again.");button.disabled=false;button.textContent="Secure checkout"}
}
function showToast(message){const toast=el(".toast");toast.textContent=message;toast.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove("show"),2800)}

document.querySelectorAll(".filter").forEach(button=>button.onclick=()=>{document.querySelector(".filter.active").classList.remove("active");button.classList.add("active");renderProducts(button.dataset.category)});
document.querySelectorAll("[data-category-jump]").forEach(tile=>tile.onclick=()=>{const category=tile.dataset.categoryJump;document.querySelector(".filter.active").classList.remove("active");const filter=document.querySelector(`[data-category="${category}"]`);filter.classList.add("active");renderProducts(category);filter.scrollIntoView({behavior:"smooth",block:"center"})});
el(".cart-button").onclick=openCart;el(".cart-close").onclick=closeCart;el(".scrim").onclick=closeCart;el(".continue-shopping").onclick=()=>{closeCart();location.hash="shop"};el(".checkout-button").onclick=checkout;el(".dialog-close").onclick=()=>el(".product-dialog").close();
el(".nav-toggle").onclick=()=>{const nav=el(".main-nav"),open=nav.classList.toggle("open");el(".nav-toggle").setAttribute("aria-expanded",open)};document.querySelectorAll(".main-nav a").forEach(a=>a.onclick=()=>el(".main-nav").classList.remove("open"));
el(".newsletter-form").onsubmit=async e=>{
  e.preventDefault();const message=el(".form-message"),email=el("#newsletter-email").value.trim();
  if(!supabase){message.textContent="Connect Supabase to activate newsletter signup.";return}
  const {error}=await supabase.functions.invoke("subscribe-newsletter",{body:{email}});
  message.textContent=error?"We couldn't save that email. Please try again.":"Thank you — you're on the list!";
  if(!error)e.target.reset();
};el("#year").textContent=new Date().getFullYear();
if(new URLSearchParams(location.search).get("checkout")==="success"){cart=[];persistCart();history.replaceState({},"",location.pathname);setTimeout(()=>showToast("Thank you! Your order was received."),500)}
loadProducts();
