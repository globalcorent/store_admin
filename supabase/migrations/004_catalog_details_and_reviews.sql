-- Expand the catalog for handmade gel candles, wax candles, soaps, and accessories.
alter table public.products drop constraint if exists products_category_check;

update public.products
set category = 'wax-candles'
where category = 'candles';

alter table public.products
  add constraint products_category_check
  check (category in ('gel-candles', 'wax-candles', 'soaps', 'accessories'));

alter table public.products
  add column if not exists scent_notes text not null default '',
  add column if not exists size_label text not null default '',
  add column if not exists burn_time text not null default '',
  add column if not exists materials text not null default '',
  add column if not exists care_instructions text not null default '',
  add column if not exists featured boolean not null default false;

update public.products
set scent_notes = case slug
  when 'bombshell-pink' then 'Rose • Lavender'
  when 'burnt-orange' then 'Caribbean Palm • Lavender'
  when 'enchanted-bloom' then 'Jasmine • Peony • Tangerine • Pineapple'
  when 'midnight-tide' then 'Cool Water • Musk • Amber'
  when 'serene-lavender' then 'Lavender'
  when 'honey-oat-glow' then 'Honey • Oat'
  when 'citrus-garden' then 'Citrus • Garden Herbs'
  when 'lavender-cloud' then 'Lavender'
  else scent_notes
end
where scent_notes = '';

update public.products
set featured = true
where slug in ('bombshell-pink', 'burnt-orange', 'signature-gift-set');

create index if not exists products_category_active_sort_idx
  on public.products(category, sort_order)
  where active = true;

-- Reviews are public only after admin approval. New submissions always enter moderation.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 2 and 80),
  rating smallint not null check (rating between 1 and 5),
  title text not null default '' check (char_length(title) <= 120),
  body text not null check (char_length(btrim(body)) between 20 and 1200),
  approved boolean not null default false,
  verified_purchase boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

create index if not exists reviews_approved_product_created_idx
  on public.reviews(product_id, created_at desc)
  where approved = true;

create index if not exists reviews_pending_created_idx
  on public.reviews(created_at desc)
  where approved = false;

revoke all on table public.reviews from anon, authenticated;
grant select, insert on table public.reviews to anon, authenticated;
grant update, delete on table public.reviews to authenticated;
grant all on table public.reviews to service_role;

drop policy if exists reviews_public_read_approved on public.reviews;
create policy reviews_public_read_approved
  on public.reviews for select
  to anon, authenticated
  using (approved = true);

drop policy if exists reviews_admin_read_all on public.reviews;
create policy reviews_admin_read_all
  on public.reviews for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists reviews_public_submit_pending on public.reviews;
create policy reviews_public_submit_pending
  on public.reviews for insert
  to anon, authenticated
  with check (
    approved = false
    and verified_purchase = false
    and char_length(btrim(author_name)) between 2 and 80
    and rating between 1 and 5
    and char_length(btrim(body)) between 20 and 1200
  );

drop policy if exists reviews_admin_update on public.reviews;
create policy reviews_admin_update
  on public.reviews for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists reviews_admin_delete on public.reviews;
create policy reviews_admin_delete
  on public.reviews for delete
  to authenticated
  using ((select public.is_admin()));
