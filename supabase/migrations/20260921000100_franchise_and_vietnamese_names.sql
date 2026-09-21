alter table public.products add column if not exists vietnamese_name text not null default '';

alter table public.contact_messages alter column email drop not null;
alter table public.contact_messages alter column message drop not null;
alter table public.contact_messages add column if not exists location text not null default '';
alter table public.contact_messages add column if not exists franchise_model text not null default '';
alter table public.contact_messages add column if not exists franchise_products text[] not null default '{}'::text[];

comment on column public.products.vietnamese_name is 'Customer-facing Vietnamese product name shown above the English name.';
comment on column public.contact_messages.franchise_products is 'One or more franchise product lines selected by the prospect.';
