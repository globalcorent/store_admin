-- Store an ordered gallery for each product while retaining products.image_url
-- as the primary-image compatibility field used by checkout and older clients.
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null check (char_length(image_url) between 8 and 2048),
  image_path text,
  alt_text text not null default '' check (char_length(alt_text) <= 180),
  sort_order smallint not null default 0 check (sort_order between 0 and 99),
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_sort_idx
  on public.product_images(product_id, sort_order, created_at);

create unique index if not exists product_images_path_unique_idx
  on public.product_images(image_path)
  where image_path is not null;

insert into public.product_images(product_id, image_url, image_path, alt_text, sort_order)
select products.id, products.image_url, products.image_path, products.name, 0
from public.products
where products.image_url is not null
  and btrim(products.image_url) <> ''
  and not exists (
    select 1 from public.product_images
    where product_images.product_id = products.id
      and product_images.image_url = products.image_url
  );

alter table public.product_images enable row level security;

revoke all on table public.product_images from anon, authenticated;
grant select on table public.product_images to anon, authenticated;
grant insert, update, delete on table public.product_images to authenticated;
grant all on table public.product_images to service_role;

drop policy if exists product_images_anon_read_active on public.product_images;
create policy product_images_anon_read_active
  on public.product_images for select
  to anon
  using (
    exists (
      select 1 from public.products
      where products.id = product_images.product_id
        and products.active = true
    )
  );

drop policy if exists product_images_authenticated_read on public.product_images;
create policy product_images_authenticated_read
  on public.product_images for select
  to authenticated
  using (
    exists (
      select 1 from public.products
      where products.id = product_images.product_id
        and (products.active = true or (select private.is_admin()))
    )
  );

drop policy if exists product_images_admin_insert on public.product_images;
create policy product_images_admin_insert
  on public.product_images for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists product_images_admin_update on public.product_images;
create policy product_images_admin_update
  on public.product_images for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists product_images_admin_delete on public.product_images;
create policy product_images_admin_delete
  on public.product_images for delete
  to authenticated
  using ((select private.is_admin()));
