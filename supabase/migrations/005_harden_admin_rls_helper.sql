-- Keep the privileged role check out of the exposed Data API schema.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'admin'
    )
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

drop policy if exists products_public_read_active on public.products;
create policy products_public_read_active
  on public.products for select
  to anon
  using (active = true);

drop policy if exists products_authenticated_read on public.products;
create policy products_authenticated_read
  on public.products for select
  to authenticated
  using (active = true or (select private.is_admin()));

drop policy if exists products_admin_insert on public.products;
create policy products_admin_insert
  on public.products for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists products_admin_update on public.products;
create policy products_admin_update
  on public.products for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists products_admin_delete on public.products;
create policy products_admin_delete
  on public.products for delete
  to authenticated
  using ((select private.is_admin()));

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists orders_owner_or_admin_read on public.orders;
create policy orders_owner_or_admin_read
  on public.orders for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists order_items_owner_or_admin_read on public.order_items;
create policy order_items_owner_or_admin_read
  on public.order_items for select
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = (select auth.uid())
    )
  );

drop policy if exists newsletter_admin_read on public.newsletter_subscribers;
create policy newsletter_admin_read
  on public.newsletter_subscribers for select
  to authenticated
  using ((select private.is_admin()));

drop policy if exists reviews_public_read_approved on public.reviews;
drop policy if exists reviews_admin_read_all on public.reviews;
create policy reviews_anon_read_approved
  on public.reviews for select
  to anon
  using (approved = true);
create policy reviews_authenticated_read
  on public.reviews for select
  to authenticated
  using (approved = true or (select private.is_admin()));

drop policy if exists reviews_admin_update on public.reviews;
create policy reviews_admin_update
  on public.reviews for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists reviews_admin_delete on public.reviews;
create policy reviews_admin_delete
  on public.reviews for delete
  to authenticated
  using ((select private.is_admin()));

drop policy if exists product_images_admin_insert on storage.objects;
create policy product_images_admin_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and (select private.is_admin()));

drop policy if exists product_images_admin_update on storage.objects;
create policy product_images_admin_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()))
  with check (bucket_id = 'product-images' and (select private.is_admin()));

drop policy if exists product_images_admin_delete on storage.objects;
create policy product_images_admin_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));

drop function if exists public.is_admin();
