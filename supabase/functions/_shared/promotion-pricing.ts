export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  category: string;
  price_cents: number;
  inventory?: number | null;
};

export type Promotion = {
  id: string;
  name: string;
  mode: "automatic" | "coupon";
  code: string | null;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  applies_to: string;
  min_quantity: number;
  min_subtotal_cents: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at?: string;
};

export type CartLine = { product: StoreProduct; quantity: number };

const legacySlugs: Record<string, string> = {
  c1: "bombshell-pink", c2: "burnt-orange", c3: "enchanted-bloom", c4: "midnight-tide", c5: "serene-lavender",
  s1: "honey-oat-glow", s2: "citrus-garden", s3: "lavender-cloud",
  a1: "golden-wick-trimmer", a2: "candle-snuffer", a3: "signature-gift-set"
};

export const isCandleCategory = (category: string) => ["gel-candles", "wax-candles", "candles"].includes(category);
const matchesScope = (product: StoreProduct, scope: string) => scope === "all" || (scope === "candles" ? isCandleCategory(product.category) : product.category === scope);
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export function normalizeCart(rawItems: unknown, products: StoreProduct[], enforceStock = false): CartLine[] {
  if (!Array.isArray(rawItems) || !rawItems.length) throw new Error("Cart is empty");
  if (rawItems.length > 50) throw new Error("Cart has too many separate items");
  const byReference = new Map<string, StoreProduct>();
  for (const product of products) {
    byReference.set(product.id, product);
    byReference.set(product.slug, product);
  }
  const combined = new Map<string, CartLine>();
  for (const raw of rawItems) {
    const item = raw as { id?: unknown; quantity?: unknown };
    const reference = legacySlugs[String(item.id || "")] || String(item.id || "");
    const product = byReference.get(reference);
    if (!product) throw new Error("A product in your cart is unavailable");
    const quantity = Math.max(1, Math.min(20, Math.trunc(Number(item.quantity) || 1)));
    const existing = combined.get(product.id);
    const combinedQuantity = Math.min(20, quantity + (existing?.quantity || 0));
    if (enforceStock && product.inventory !== null && product.inventory !== undefined && combinedQuantity > product.inventory) throw new Error(`${product.name} has limited stock`);
    combined.set(product.id, { product, quantity: combinedQuantity });
  }
  return [...combined.values()];
}

const promotionIsActive = (promotion: Promotion, now = new Date()) => promotion.active && (!promotion.starts_at || new Date(promotion.starts_at) <= now) && (!promotion.ends_at || new Date(promotion.ends_at) > now);
const merchandiseSubtotal = (lines: CartLine[]) => lines.reduce((sum, line) => sum + line.product.price_cents * line.quantity, 0);
const scopedLines = (lines: CartLine[], promotion: Promotion) => lines.filter(line => matchesScope(line.product, promotion.applies_to));
const scopedQuantity = (lines: CartLine[], promotion: Promotion) => scopedLines(lines, promotion).reduce((sum, line) => sum + line.quantity, 0);
const scopedSubtotal = (lines: CartLine[], promotion: Promotion) => scopedLines(lines, promotion).reduce((sum, line) => sum + line.product.price_cents * line.quantity, 0);
const qualifies = (lines: CartLine[], promotion: Promotion) => scopedQuantity(lines, promotion) >= promotion.min_quantity && merchandiseSubtotal(lines) >= promotion.min_subtotal_cents;

export function promotionDiscount(lines: CartLine[], promotion: Promotion | null): number {
  if (!promotion || !qualifies(lines, promotion)) return 0;
  const eligible = scopedLines(lines, promotion);
  if (promotion.discount_type === "percentage") {
    return eligible.reduce((sum, line) => {
      const discountedUnit = Math.round(line.product.price_cents * (1 - promotion.discount_value / 100));
      return sum + (line.product.price_cents - discountedUnit) * line.quantity;
    }, 0);
  }
  const eligibleSubtotal = scopedSubtotal(lines, promotion), eligibleQuantity = scopedQuantity(lines, promotion);
  return Math.min(promotion.discount_value, Math.max(0, eligibleSubtotal - eligibleQuantity));
}

function publicPromotion(promotion: Promotion | null) {
  if (!promotion) return null;
  return { id: promotion.id, name: promotion.name, mode: promotion.mode, code: promotion.mode === "coupon" ? promotion.code : null, discount_type: promotion.discount_type, discount_value: promotion.discount_value, applies_to: promotion.applies_to, min_quantity: promotion.min_quantity, min_subtotal_cents: promotion.min_subtotal_cents };
}

function requirementMessage(promotion: Promotion) {
  const parts: string[] = [];
  if (promotion.min_quantity > 1) parts.push(`${promotion.min_quantity} qualifying items`);
  if (promotion.min_subtotal_cents > 0) parts.push(`${money(promotion.min_subtotal_cents)} in merchandise`);
  return parts.length ? `Requires ${parts.join(" and ")}.` : "The cart does not qualify for this code.";
}

export function selectPromotion(promotions: Promotion[], lines: CartLine[], requestedCode?: string | null) {
  const active = promotions.filter(promotion => promotionIsActive(promotion));
  const automatic = active.filter(promotion => promotion.mode === "automatic" && qualifies(lines, promotion));
  const code = String(requestedCode || "").trim().toUpperCase();
  const coupon = code ? active.find(promotion => promotion.mode === "coupon" && promotion.code === code) || null : null;
  const eligibleCoupon = coupon && qualifies(lines, coupon) ? coupon : null;
  const candidates = [...automatic, ...(eligibleCoupon ? [eligibleCoupon] : [])];
  const selected = candidates.sort((a, b) => promotionDiscount(lines, b) - promotionDiscount(lines, a))[0] || null;
  let coupon_status: string | null = null, coupon_message = "";
  if (code && !coupon) {
    coupon_status = "invalid";
    coupon_message = "That coupon code is not active or does not exist.";
  } else if (coupon && !eligibleCoupon) {
    coupon_status = "ineligible";
    coupon_message = requirementMessage(coupon);
  } else if (eligibleCoupon && selected?.id !== eligibleCoupon.id) {
    coupon_status = "better_automatic";
    coupon_message = `${selected?.name || "The automatic deal"} saves you more, so we kept the better price.`;
  } else if (eligibleCoupon) {
    coupon_status = "applied";
    coupon_message = `${eligibleCoupon.code} applied — you saved ${money(promotionDiscount(lines, eligibleCoupon))}.`;
  }
  const bundles = active.filter(promotion => promotion.mode === "automatic" && promotion.min_quantity > 1);
  const featured = bundles.sort((a, b) => Math.max(0, a.min_quantity - scopedQuantity(lines, a)) - Math.max(0, b.min_quantity - scopedQuantity(lines, b)) || a.min_quantity - b.min_quantity)[0] || null;
  return {
    selected,
    coupon_status,
    coupon_message,
    bundle_hint: featured ? { ...publicPromotion(featured), eligible_quantity: scopedQuantity(lines, featured) } : null
  };
}

export function priceCart(lines: CartLine[], promotion: Promotion | null) {
  const discount = promotionDiscount(lines, promotion);
  let remainingFixed = promotion?.discount_type === "fixed_amount" ? discount : 0;
  const units: Array<{ product: StoreProduct; unit_amount: number }> = [];
  for (const line of lines) {
    for (let index = 0; index < line.quantity; index++) {
      let unitAmount = line.product.price_cents;
      if (promotion && matchesScope(line.product, promotion.applies_to)) {
        if (promotion.discount_type === "percentage") unitAmount = Math.round(unitAmount * (1 - promotion.discount_value / 100));
        else if (remainingFixed > 0) {
          const unitDiscount = Math.min(remainingFixed, Math.max(0, unitAmount - 1));
          unitAmount -= unitDiscount;
          remainingFixed -= unitDiscount;
        }
      }
      units.push({ product: line.product, unit_amount: unitAmount });
    }
  }
  const groups = new Map<string, { product: StoreProduct; unit_amount: number; quantity: number }>();
  for (const unit of units) {
    const key = `${unit.product.id}:${unit.unit_amount}`, existing = groups.get(key);
    if (existing) existing.quantity += 1;
    else groups.set(key, { ...unit, quantity: 1 });
  }
  const regular = merchandiseSubtotal(lines), discounted = units.reduce((sum, unit) => sum + unit.unit_amount, 0), shipping = discounted >= 7500 ? 0 : 795;
  const lineTotals = lines.map(line => ({
    product_id: line.product.id,
    quantity: line.quantity,
    regular_total_cents: line.product.price_cents * line.quantity,
    total_cents: units.filter(unit => unit.product.id === line.product.id).reduce((sum, unit) => sum + unit.unit_amount, 0)
  }));
  return { merchandise_cents: regular, discount_cents: regular - discounted, discounted_merchandise_cents: discounted, shipping_cents: shipping, total_cents: discounted + shipping, remaining_free_shipping_cents: Math.max(0, 7500 - discounted), groups: [...groups.values()], lines: lineTotals };
}

export function createCartQuote(promotions: Promotion[], lines: CartLine[], requestedCode?: string | null) {
  const selection = selectPromotion(promotions, lines, requestedCode), pricing = priceCart(lines, selection.selected);
  return { ...pricing, promotion: publicPromotion(selection.selected), coupon_status: selection.coupon_status, coupon_message: selection.coupon_message, bundle_hint: selection.bundle_hint };
}
