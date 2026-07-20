# Aromatic Designer Works Store

Mobile-friendly storefront and protected admin for handmade gel candles, wax candles, soaps, and candle accessories. Supabase powers the catalog, product-photo storage, Auth, orders, newsletter, and moderated reviews. Stripe hosts secure checkout.

Store contact: 347-423-9364 · adw.com1660@gmail.com

Current offers: 15% off any three or more candles, automatically applied; free standard U.S. shipping on merchandise totals of $75 or more. Orders require one business day of preparation followed by an estimated 5–7 business days in transit. Returns are accepted within 14 days of delivery only for unopened and unused items, with no exceptions.

## Preview

Serve this folder through a local web server (do not double-click `index.html`):

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Connect Supabase

1. Create a Supabase project.
2. Apply every file in `supabase/migrations` in numeric order.
3. The storefront is configured for Supabase project `rfauhbcnrmwqyowftlcq`.
4. Use Supabase CLI help to confirm current commands, then link the project and deploy the five Edge Functions in `supabase/functions`.
5. Add function secrets: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Never place them in `config.js` or GitHub.

## Connect Stripe

1. In Stripe test mode, create a webhook endpoint pointing to:
   `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
2. Subscribe to `checkout.session.completed`.
3. Save the returned signing secret as `STRIPE_WEBHOOK_SECRET` in Supabase Edge Function secrets.
4. Add the Stripe test secret key as `STRIPE_SECRET_KEY`.
5. Make a test purchase and confirm a row appears in `orders` and `order_items`.

Prices are read from Supabase inside the checkout function. The browser cannot alter the amount charged. Stripe secret keys and Supabase service-role keys stay server-side.

## Customize

- Products, actual photos, details, and inventory: protected `admin.html`
- Review approval and removal: protected `admin.html`
- Newsletter signups: Supabase Table Editor → `newsletter_subscribers`
- Contact details and store copy: `index.html`
- Store colors: variables at the top of `styles.css`
- Shipping threshold text: announcement bar in `index.html`

Before launch, add a sharp actual photo, verified size, materials or ingredients, burn time where applicable, and product-specific care instructions to every listing. Do not publish unsupported safety, health, ingredient, or certification claims.

## Store accounts and admin

- Customers use `auth.html` to create an account or sign in.
- The protected customer dashboard is at `account.html`. It shows order history, fulfillment progress, tracking links, saved profile name, support shortcuts, and a buy-again action for available products.
- The account dashboard includes the Aroma Assistant chat panel for immediate guided answers about linked orders, shipping, returns, products, and candle care, with direct phone and email handoff.
- The shopping bag shows candle-bundle progress, free-shipping progress, discount savings, estimated shipping, the pre-tax total, inventory-aware quantities, and delivery expectations before Stripe checkout.
- The protected dashboard is at `admin.html`.
- Sign up with `adw.com1660@gmail.com` and confirm the email to receive the admin role.
- Product, order, subscriber, review, and profile access remains enforced by database RLS even if someone directly opens the admin URL.
- Product photos can be uploaded directly from the protected dashboard. Supported formats are JPG, PNG, and WebP up to 5 MB.
- Customer reviews enter a pending queue and never publish until the administrator approves them.
- Stripe returns successful payments through the `confirm-order` function so orders are saved even if webhook delivery is delayed.
- When a customer signs in before checkout, the validated Supabase user ID is attached to the Stripe session and the completed order is saved to that customer account. Guest checkout remains available.
- After email confirmation, the account dashboard securely recovers earlier unclaimed guest orders placed with the same email address.
- Administrators can update order fulfillment from received to preparing, shipped, delivered, cancelled, or refunded and can add carrier tracking details.
