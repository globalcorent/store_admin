create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  category text not null check (category in ('candles','soaps','accessories')),
  description text not null default '', price_cents integer not null check (price_cents >= 0),
  badge text not null default '', visual text not null default '✦', color text not null default '#efe4d4',
  active boolean not null default true, inventory integer check (inventory is null or inventory >= 0),
  sort_order integer not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), stripe_session_id text not null unique,
  customer_email text, customer_name text, status text not null default 'paid',
  amount_total_cents integer not null, currency text not null default 'usd', shipping jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, product_name text not null,
  quantity integer not null check (quantity > 0), unit_price_cents integer not null check (unit_price_cents >= 0)
);
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(), email text not null unique check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.newsletter_subscribers enable row level security;
revoke all on public.orders, public.order_items from anon, authenticated;
grant select on public.products to anon, authenticated;
create policy "Public can view active products" on public.products for select to anon, authenticated using (active = true);

insert into public.products(name,slug,category,description,price_cents,badge,visual,color,sort_order) values
('Bombshell Pink','bombshell-pink','candles','A confident floral blend of rose and calming lavender.',2400,'Bestseller','🕯️','#f4c2cf',10),
('Burnt Orange','burnt-orange','candles','Caribbean palm and lavender with a warm, sunlit finish.',2600,'Signature','🕯️','#dc6b2f',20),
('Enchanted Bloom','enchanted-bloom','candles','Jasmine, peony, tangerine and pineapple in full bloom.',2800,'New','🌺','#eed0df',30),
('Midnight Tide','midnight-tide','candles','Cool water, musk and amber for a calm evening atmosphere.',2800,'','🌊','#9cb8c8',40),
('Serene Lavender','serene-lavender','candles','Soft lavender designed for slow nights and peaceful rooms.',2400,'Relax','🪻','#c9b9dc',50),
('Honey Oat Glow','honey-oat-glow','soaps','A creamy, comforting bar with a warm honey-oat aroma.',1000,'Gentle','🧼','#ead3a6',60),
('Citrus Garden','citrus-garden','soaps','A bright cleansing bar with fresh citrus and garden herbs.',1000,'Fresh','🍊','#f4c66a',70),
('Lavender Cloud','lavender-cloud','soaps','A soothing lavender bar with a soft, clean finish.',1100,'','☁️','#d9d0ea',80),
('Golden Wick Trimmer','golden-wick-trimmer','accessories','Keep every flame clean and controlled with a precise trim.',1600,'Essential','✂️','#e8cf8e',90),
('Candle Snuffer','candle-snuffer','accessories','A graceful, smoke-conscious way to end your candle ritual.',1800,'','🔔','#c9b28c',100),
('Signature Gift Set','signature-gift-set','accessories','A ready-to-give candle, soap and care accessory bundle.',4900,'Gift Ready','🎁','#eab7a1',110)
on conflict (slug) do nothing;
