create table if not exists public.order_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_feedback_profile_idx on public.order_feedback (customer_profile_id, created_at desc);
alter table public.order_feedback enable row level security;
revoke all on public.order_feedback from anon, authenticated;
grant all on public.order_feedback to service_role;

do $$ begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.order_feedback'::regclass and tgname = 'set_updated_at') then
    create trigger set_updated_at before update on public.order_feedback
    for each row execute function public.set_updated_at();
  end if;
end $$;
