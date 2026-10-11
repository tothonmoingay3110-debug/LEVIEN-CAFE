-- Website Content switch. Existing stores continue accepting online orders.
alter table public.site_content
  add column if not exists online_ordering_enabled boolean not null default true;
