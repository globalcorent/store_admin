-- Customer account history and admin-managed fulfillment details.
alter table public.orders
  add column if not exists fulfillment_status text not null default 'unfulfilled',
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

alter table public.orders drop constraint if exists orders_fulfillment_status_check;
alter table public.orders
  add constraint orders_fulfillment_status_check
  check (fulfillment_status in ('unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'));

create index if not exists orders_fulfillment_created_idx
  on public.orders(fulfillment_status, created_at desc);

-- Link prior orders and items only when there is an exact, trustworthy match.
update public.orders as orders
set user_id = profiles.id
from public.profiles as profiles
where orders.user_id is null
  and orders.customer_email is not null
  and profiles.email is not null
  and lower(orders.customer_email) = lower(profiles.email);

update public.order_items as items
set product_id = products.id
from public.products as products
where items.product_id is null
  and (
    items.product_name = products.name
    or items.product_name = products.name || ' — 15% bundle deal'
  );

-- Customers may update only their own display name, never role or email.
revoke update on table public.profiles from authenticated;
grant update(full_name) on table public.profiles to authenticated;

drop policy if exists profiles_update_own_name on public.profiles;
create policy profiles_update_own_name
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Only an administrator may update fulfillment fields.
grant update(fulfillment_status, tracking_number, tracking_url, shipped_at, delivered_at)
  on table public.orders to authenticated;

drop policy if exists orders_admin_fulfillment_update on public.orders;
create policy orders_admin_fulfillment_update
  on public.orders for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
