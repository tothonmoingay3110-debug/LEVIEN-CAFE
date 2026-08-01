-- LEVIEN CAFE Sprint 4 — Supabase-ready schema
-- Run this later in Supabase SQL Editor when the project URL and keys are ready.

create extension if not exists pgcrypto;

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  singleton_key text unique not null default 'main',
  store_name text not null default 'LEVIEN CAFE',
  tagline text not null default 'CAFE & EATERY',
  logo_url text,
  announcement text,
  about_title text,
  about_text text,
  about_image_url text,
  address text,
  phone text,
  email text,
  opening_hours text,
  map_url text,
  footer_text text,
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text default '☕',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.toppings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  emoji text default '☕',
  allow_ice boolean not null default true,
  allow_sugar boolean not null default true,
  best_seller boolean not null default false,
  must_try boolean not null default false,
  featured boolean not null default false,
  is_new boolean not null default false,
  sold_out boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_toppings (
  product_id uuid references public.products(id) on delete cascade,
  topping_id uuid references public.toppings(id) on delete cascade,
  primary key (product_id, topping_id)
);

create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.combo_products (
  combo_id uuid references public.combos(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  primary key (combo_id, product_id)
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  eyebrow text,
  description text,
  price_text text,
  image_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_name text not null,
  phone text not null,
  order_type text not null check (order_type in ('Pickup','Delivery')),
  address text,
  note text,
  subtotal numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  status text not null default 'New' check (status in ('New','Preparing','Ready','Completed','Cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null,
  quantity integer not null default 1,
  customization jsonb not null default '{}'::jsonb
);

insert into public.site_content (singleton_key)
values ('main')
on conflict (singleton_key) do nothing;
