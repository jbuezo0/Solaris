-- Solaris GT: ejecutar una vez en Supabase > SQL Editor.
-- Agrega una galería de hasta 10 imágenes por producto sin eliminar datos existentes.

alter table public.products
add column if not exists image_urls jsonb not null default '[]'::jsonb;

update public.products
set image_urls = jsonb_build_array(image_url)
where image_url <> ''
  and (image_urls is null or image_urls = '[]'::jsonb);
