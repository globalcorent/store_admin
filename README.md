# Aromatic Designer Works Store

Bright, mobile-friendly luxury storefront for candles, soaps and accessories. The catalog is connected to Supabase; Stripe activates secure checkout after its function secrets are configured.

Store contact: 347-423-9364 · adw.com1660@gmail.com

Current offers: 15% off any three or more candles, automatically applied; free standard U.S. shipping on merchandise totals of $75 or more. Orders require one business day of preparation followed by an estimated 5–7 business days in transit. Returns are accepted within 14 days of delivery only for unopened and unused items, with no exceptions.

## Preview

Serve this folder through a local web server (do not double-click `index.html`):

```bash
python3 -m http.server 8080 --directory aromatic-shop
```

Open `http://localhost:8080`.

## Connect Supabase

1. Create a Supabase project.
2. In the SQL Editor, run `supabase/migrations/001_store.sql`.
3. Copy the project URL and publishable key from Project Settings → API into `config.js`.
4. Use Supabase CLI help to confirm current commands, then link the project and deploy both Edge Functions.
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

- Products and prices: Supabase Table Editor → `products`
- Newsletter signups: Supabase Table Editor → `newsletter_subscribers`
- Contact email and Instagram: footer links in `index.html`
- Store colors: variables at the top of `styles.css`
- Shipping threshold text: announcement bar in `index.html`

Before launch, replace the sample soaps/accessories, business email, social link, return policy, shipping policy, privacy policy, and product photography.
