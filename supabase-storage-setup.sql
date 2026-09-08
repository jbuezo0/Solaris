-- Solaris GT: almacenamiento seguro de imágenes de productos.
-- Ejecutar una sola vez en Supabase > SQL Editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Imágenes públicas de productos" on storage.objects;
create policy "Imágenes públicas de productos"
on storage.objects for select to public
using (bucket_id = 'product-images');

drop policy if exists "Administrador sube imágenes" on storage.objects;
create policy "Administrador sube imágenes"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (auth.jwt() ->> 'email') = 'jbuezo0@gmail.com'
);

drop policy if exists "Administrador actualiza imágenes" on storage.objects;
create policy "Administrador actualiza imágenes"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-images'
  and (auth.jwt() ->> 'email') = 'jbuezo0@gmail.com'
)
with check (
  bucket_id = 'product-images'
  and (auth.jwt() ->> 'email') = 'jbuezo0@gmail.com'
);

drop policy if exists "Administrador elimina imágenes" on storage.objects;
create policy "Administrador elimina imágenes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (auth.jwt() ->> 'email') = 'jbuezo0@gmail.com'
);
