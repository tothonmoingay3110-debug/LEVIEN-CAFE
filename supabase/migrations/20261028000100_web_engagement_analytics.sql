-- Privacy-conscious website engagement. No IP address or customer identity is stored.
create table if not exists public.web_engagement_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('page_view', 'module_click', 'product_view', 'product_click')),
  module_key text check (module_key in ('home', 'menu', 'combos', 'story', 'location', 'event-booking', 'franchise', 'catering', 'gift-card', 'account', 'checkout')),
  product_id uuid,
  session_key uuid not null,
  created_at timestamptz not null default now(),
  constraint web_engagement_event_target_check check (
    (event_type in ('page_view', 'module_click') and module_key is not null and product_id is null)
    or (event_type in ('product_view', 'product_click') and product_id is not null and module_key is null)
  )
);

create index if not exists web_engagement_events_created_idx on public.web_engagement_events (created_at desc);
create index if not exists web_engagement_events_module_idx on public.web_engagement_events (module_key, event_type, created_at desc);
create index if not exists web_engagement_events_product_idx on public.web_engagement_events (product_id, event_type, created_at desc);

alter table public.web_engagement_events enable row level security;
revoke all on public.web_engagement_events from anon, authenticated;
grant all on public.web_engagement_events to service_role;

create or replace function public.web_engagement_report(p_from date, p_to date)
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with selected as (
    select event_type, module_key, product_id, session_key,
      (created_at at time zone 'America/New_York')::date as local_day
    from public.web_engagement_events
    where created_at >= (p_from::timestamp at time zone 'America/New_York')
      and created_at < ((p_to + 1)::timestamp at time zone 'America/New_York')
  ),
  module_counts as (
    select module_key,
      count(*) filter (where event_type = 'page_view') as page_views,
      count(*) filter (where event_type = 'module_click') as clicks
    from selected where module_key is not null group by module_key
  ),
  product_counts as (
    select product_id,
      count(*) filter (where event_type = 'product_view') as views,
      count(*) filter (where event_type = 'product_click') as clicks
    from selected where product_id is not null group by product_id
  ),
  daily_counts as (
    select local_day,
      count(distinct session_key) filter (where event_type = 'page_view') as visits,
      count(*) filter (where event_type = 'page_view') as page_views
    from selected group by local_day
  )
  select jsonb_build_object(
    'visits', (select count(distinct session_key) from selected where event_type = 'page_view'),
    'pageViews', (select count(*) from selected where event_type = 'page_view'),
    'moduleClicks', (select count(*) from selected where event_type = 'module_click'),
    'productViews', (select count(*) from selected where event_type = 'product_view'),
    'productClicks', (select count(*) from selected where event_type = 'product_click'),
    'modules', coalesce((select jsonb_agg(jsonb_build_object('key', module_key, 'pageViews', page_views, 'clicks', clicks) order by page_views desc, clicks desc, module_key) from module_counts), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', pc.product_id, 'name', coalesce(p.name, 'Archived product'), 'views', pc.views, 'clicks', pc.clicks) order by pc.views desc, pc.clicks desc, p.name) from product_counts pc left join public.products p on p.id = pc.product_id), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date', local_day, 'visits', visits, 'pageViews', page_views) order by local_day) from daily_counts), '[]'::jsonb)
  );
$$;

revoke all on function public.web_engagement_report(date, date) from public, anon, authenticated;
grant execute on function public.web_engagement_report(date, date) to service_role;
