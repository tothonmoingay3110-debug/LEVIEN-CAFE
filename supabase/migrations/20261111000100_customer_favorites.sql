create table if not exists public.customer_favorites (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  selection jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_profile_id, product_id),
  constraint customer_favorites_selection_object check (jsonb_typeof(selection) = 'object')
);

create index if not exists customer_favorites_profile_idx
on public.customer_favorites (customer_profile_id, updated_at desc);

alter table public.customer_favorites enable row level security;
revoke all on public.customer_favorites from anon, authenticated;
grant all on public.customer_favorites to service_role;

do $$ begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.customer_favorites'::regclass and tgname = 'set_updated_at') then
    create trigger set_updated_at before update on public.customer_favorites
    for each row execute function public.set_updated_at();
  end if;
end $$;
