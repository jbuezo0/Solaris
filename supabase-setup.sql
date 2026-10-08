-- Solaris GT: esquema independiente para catálogo, pedidos y administración.
-- Ejecutar una sola vez en Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  category text not null check (category in ('Lámparas solares','Decoración','Iluminación interior','Iluminación exterior','Guirnaldas y ambiente','Reflectores solares','Accesorios','Otros')),
  brand text not null default '',
  model text not null default '',
  old_price numeric(12,2) check (old_price is null or old_price >= 0),
  price numeric(12,2) not null check (price >= 0),
  label text not null default '',
  status text not null default 'Disponible' check (status in ('Disponible','Últimas unidades','Consultar existencias','Por encargo','Agotado')),
  warranty text not null default 'Consultar',
  description text not null default '',
  image_url text not null default '',
  image_urls jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Actualización segura para proyectos Solaris creados con la primera versión.
alter table public.products add column if not exists brand text not null default '';
alter table public.products add column if not exists model text not null default '';
alter table public.products add column if not exists old_price numeric(12,2);
alter table public.products add column if not exists label text not null default '';
alter table public.products add column if not exists warranty text not null default 'Consultar';
alter table public.products add column if not exists image_urls jsonb not null default '[]'::jsonb;
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check check (category in ('Lámparas solares','Decoración','Iluminación interior','Iluminación exterior','Guirnaldas y ambiente','Reflectores solares','Accesorios','Otros'));
alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check check (status in ('Disponible','Últimas unidades','Consultar existencias','Por encargo','Agotado'));
alter table public.products drop constraint if exists products_old_price_check;
alter table public.products add constraint products_old_price_check check (old_price is null or old_price >= 0);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  department text not null,
  municipality text not null,
  address text not null,
  notes text not null default '',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  shipping numeric(12,2) not null check (shipping >= 0),
  total numeric(12,2) not null check (total >= 0),
  status text not null default 'Nuevo' check (status in ('Nuevo','Confirmado','Enviado','Entregado','Cancelado')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  quantity integer not null check (quantity > 0 and quantity <= 100),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Catálogo público" on public.products;
create policy "Catálogo público" on public.products for select to anon, authenticated
using (active = true or (auth.jwt() ->> 'email') = 'jbuezo0@gmail.com');

drop policy if exists "Administrador crea productos" on public.products;
create policy "Administrador crea productos" on public.products for insert to authenticated
with check ((auth.jwt() ->> 'email') = 'jbuezo0@gmail.com');

drop policy if exists "Administrador edita productos" on public.products;
create policy "Administrador edita productos" on public.products for update to authenticated
using ((auth.jwt() ->> 'email') = 'jbuezo0@gmail.com')
with check ((auth.jwt() ->> 'email') = 'jbuezo0@gmail.com');

drop policy if exists "Administrador elimina productos" on public.products;
create policy "Administrador elimina productos" on public.products for delete to authenticated
using ((auth.jwt() ->> 'email') = 'jbuezo0@gmail.com');

drop policy if exists "Administrador consulta pedidos" on public.orders;
create policy "Administrador consulta pedidos" on public.orders for select to authenticated
using ((auth.jwt() ->> 'email') = 'jbuezo0@gmail.com');

drop policy if exists "Administrador actualiza pedidos" on public.orders;
create policy "Administrador actualiza pedidos" on public.orders for update to authenticated
using ((auth.jwt() ->> 'email') = 'jbuezo0@gmail.com')
with check ((auth.jwt() ->> 'email') = 'jbuezo0@gmail.com');

drop policy if exists "Administrador consulta productos del pedido" on public.order_items;
create policy "Administrador consulta productos del pedido" on public.order_items for select to authenticated
using ((auth.jwt() ->> 'email') = 'jbuezo0@gmail.com');

create or replace function public.create_solaris_order(
  customer_name text, customer_phone text, department text, municipality text,
  address text, notes text, items jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_order_id uuid;
  calculated_subtotal numeric(12,2);
  calculated_shipping numeric(12,2);
begin
  if trim(customer_name) = '' or trim(customer_phone) = '' or trim(department) = ''
     or trim(municipality) = '' or trim(address) = '' then
    raise exception 'Faltan datos de envío';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'El pedido no contiene productos';
  end if;

  select coalesce(sum(p.price * greatest(1, least(100, (item->>'quantity')::integer))), 0)
  into calculated_subtotal
  from jsonb_array_elements(items) item
  join public.products p on p.id = (item->>'product_id')::uuid
  where p.active = true and p.status <> 'Agotado';

  if calculated_subtotal <= 0 then raise exception 'Productos no válidos'; end if;
  calculated_shipping := case when calculated_subtotal >= 800 then 0 else 35 end;

  insert into public.orders (
    customer_name, customer_phone, department, municipality, address, notes,
    subtotal, shipping, total
  ) values (
    trim(customer_name), trim(customer_phone), trim(department), trim(municipality),
    trim(address), coalesce(trim(notes), ''), calculated_subtotal,
    calculated_shipping, calculated_subtotal + calculated_shipping
  ) returning id into new_order_id;

  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, line_total)
  select new_order_id, p.id, p.name,
         greatest(1, least(100, (item->>'quantity')::integer)), p.price,
         p.price * greatest(1, least(100, (item->>'quantity')::integer))
  from jsonb_array_elements(items) item
  join public.products p on p.id = (item->>'product_id')::uuid
  where p.active = true and p.status <> 'Agotado';

  return new_order_id;
end;
$$;

revoke all on function public.create_solaris_order(text,text,text,text,text,text,jsonb) from public;
grant execute on function public.create_solaris_order(text,text,text,text,text,text,jsonb) to anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
