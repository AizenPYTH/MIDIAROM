-- =============================================================================
-- 0008 — Storage buckets & policies
-- All order buckets are PRIVATE; files are served through signed URLs created
-- server-side after a permission check. Paths are "<order_id>/<kind>/<file>".
-- content-media is public (workshop photos, catalog images, CMS assets).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('reception-media',  'reception-media',  false, 104857600, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm']),
  ('diagnostic-media', 'diagnostic-media', false, 104857600, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm']),
  ('repair-media',     'repair-media',     false, 104857600, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm']),
  ('shipping-media',   'shipping-media',   false,  52428800, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('final-media',      'final-media',      false, 104857600, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm']),
  ('sav-media',        'sav-media',        false, 104857600, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm']),
  ('documents',        'documents',        false,  20971520, array['application/pdf']),
  ('content-media',    'content-media',    true,   10485760, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do nothing;

-- Helper: first folder of an object path is the order id
create or replace function public.storage_order_id(p_name text)
returns uuid
language sql
immutable
as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (storage.foldername(p_name))[1]::uuid
    else null
  end;
$$;

-- Staff: full access to every private order bucket
create policy "storage: staff read order media" on storage.objects
  for select to authenticated
  using (bucket_id in ('reception-media','diagnostic-media','repair-media','shipping-media','final-media','sav-media','documents')
         and public.is_staff());
create policy "storage: staff write order media" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('reception-media','diagnostic-media','repair-media','shipping-media','final-media','sav-media','documents')
              and public.is_staff());
create policy "storage: staff update order media" on storage.objects
  for update to authenticated
  using (bucket_id in ('reception-media','diagnostic-media','repair-media','shipping-media','final-media','sav-media','documents')
         and public.is_staff());
create policy "storage: staff delete order media" on storage.objects
  for delete to authenticated
  using (bucket_id in ('reception-media','diagnostic-media','repair-media','shipping-media','final-media','sav-media','documents')
         and public.is_staff());

-- Customers: read files of THEIR orders only
create policy "storage: customer read own order media" on storage.objects
  for select to authenticated
  using (bucket_id in ('reception-media','diagnostic-media','repair-media','shipping-media','final-media','sav-media','documents')
         and public.owns_order(public.storage_order_id(name)));

-- Customers: upload SAV evidence for their own orders
create policy "storage: customer upload sav media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sav-media' and public.owns_order(public.storage_order_id(name)));

-- Public content bucket
create policy "storage: public read content" on storage.objects
  for select to anon, authenticated using (bucket_id = 'content-media');
create policy "storage: admin write content" on storage.objects
  for insert to authenticated with check (bucket_id = 'content-media' and public.is_admin());
create policy "storage: admin update content" on storage.objects
  for update to authenticated using (bucket_id = 'content-media' and public.is_admin());
create policy "storage: admin delete content" on storage.objects
  for delete to authenticated using (bucket_id = 'content-media' and public.is_admin());
