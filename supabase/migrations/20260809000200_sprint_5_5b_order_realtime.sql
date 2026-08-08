-- LEVIEN CAFE — Sprint 5.5B Live Order Sync
-- Order rows remain protected by RLS. Server-authenticated event streams relay
-- change notifications without exposing the orders table to anonymous clients.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'orders'
    )
  then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
