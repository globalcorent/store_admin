do $$ begin
  create type public.app_role as enum ('customer', 'admin');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists products_active_sort_idx on public.products(active, sort_order);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id,email,full_name,role)
  values(new.id,lower(new.email),coalesce(new.raw_user_meta_data->>'full_name',''),
    case when lower(new.email)='adw.com1660@gmail.com' then 'admin'::public.app_role else 'customer'::public.app_role end);
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
grant usage on type public.app_role to authenticated;
grant select on public.profiles to authenticated;
grant select on public.orders, public.order_items to authenticated;
drop policy if exists "Public can view active products" on public.products;
create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy "products_public_read_active" on public.products for select to anon,authenticated using(active=true or public.is_admin());
create policy "products_admin_insert" on public.products for insert to authenticated with check(public.is_admin());
create policy "products_admin_update" on public.products for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "products_admin_delete" on public.products for delete to authenticated using(public.is_admin());
create policy "orders_owner_or_admin_read" on public.orders for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "order_items_owner_or_admin_read" on public.order_items for select to authenticated
using(public.is_admin() or exists(select 1 from public.orders where orders.id=order_items.order_id and orders.user_id=auth.uid()));
create policy "newsletter_admin_read" on public.newsletter_subscribers for select to authenticated using(public.is_admin());

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
