-- Admin-managed coupon codes, automatic discounts, and bundle/package deals.
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 100),
  mode text not null check (mode in ('automatic', 'coupon')),
  code text,
  discount_type text not null check (discount_type in ('percentage', 'fixed_amount')),
  discount_value integer not null,
  applies_to text not null default 'all'
    check (applies_to in ('all', 'candles', 'gel-candles', 'wax-candles', 'soaps', 'accessories')),
  min_quantity smallint not null default 1 check (min_quantity between 1 and 100),
  min_subtotal_cents integer not null default 0 check (min_subtotal_cents between 0 and 10000000),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_code_by_mode check (
    (mode = 'automatic' and code is null)
    or
    (mode = 'coupon' and code is not null and code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$')
  ),
  constraint promotions_discount_value check (
    (discount_type = 'percentage' and discount_value between 1 and 90)
    or
    (discount_type = 'fixed_amount' and discount_value between 1 and 100000)
  ),
  constraint promotions_date_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create unique index if not exists promotions_code_unique_idx
  on public.promotions (lower(code))
  where code is not null;

create index if not exists promotions_active_window_idx
  on public.promotions (active, starts_at, ends_at);

drop trigger if exists promotions_set_updated_at on public.promotions;
create trigger promotions_set_updated_at
  before update on public.promotions
  for each row execute procedure public.set_updated_at();

alter table public.promotions enable row level security;
revoke all on table public.promotions from anon, authenticated;
grant select, insert, update, delete on table public.promotions to authenticated;
grant all on table public.promotions to service_role;

drop policy if exists promotions_admin_select on public.promotions;
create policy promotions_admin_select on public.promotions
  for select to authenticated using ((select private.is_admin()));

drop policy if exists promotions_admin_insert on public.promotions;
create policy promotions_admin_insert on public.promotions
  for insert to authenticated with check ((select private.is_admin()));

drop policy if exists promotions_admin_update on public.promotions;
create policy promotions_admin_update on public.promotions
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists promotions_admin_delete on public.promotions;
create policy promotions_admin_delete on public.promotions
  for delete to authenticated using ((select private.is_admin()));

insert into public.promotions (
  name, mode, code, discount_type, discount_value, applies_to,
  min_quantity, min_subtotal_cents, active
)
select
  'Pick any 3 candles — 15% off', 'automatic', null, 'percentage', 15, 'candles',
  3, 0, true
where not exists (
  select 1 from public.promotions
  where mode = 'automatic'
    and discount_type = 'percentage'
    and discount_value = 15
    and applies_to = 'candles'
    and min_quantity = 3
);
