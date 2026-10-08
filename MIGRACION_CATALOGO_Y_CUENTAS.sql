-- Solaris GT: ejecutar en Supabase > SQL Editor para habilitar el catálogo ampliado.
-- Conserva los productos y pedidos existentes.

alter table public.products add column if not exists brand text not null default '';
alter table public.products add column if not exists model text not null default '';
alter table public.products add column if not exists old_price numeric(12,2);
alter table public.products add column if not exists label text not null default '';
alter table public.products add column if not exists warranty text not null default 'Consultar';

alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
check (category in ('Lámparas solares','Decoración','Iluminación interior','Iluminación exterior','Guirnaldas y ambiente','Reflectores solares','Accesorios','Otros'));

alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check
check (status in ('Disponible','Últimas unidades','Consultar existencias','Por encargo','Agotado'));

alter table public.products drop constraint if exists products_old_price_check;
alter table public.products add constraint products_old_price_check
check (old_price is null or old_price >= 0);
