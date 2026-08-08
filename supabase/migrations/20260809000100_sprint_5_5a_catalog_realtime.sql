-- LEVIEN CAFE — Sprint 5.5A Live Catalog Sync
-- Enables realtime events for public storefront catalog and website content.

do $$
declare
  catalog_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach catalog_table in array array[
      'site_content',
      'categories',
      'toppings',
      'products',
      'product_toppings',
      'combos',
      'combo_products',
      'promotions'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = catalog_table
      ) then
        execute format(
          'alter publication supabase_realtime add table public.%I',
          catalog_table
        );
      end if;
    end loop;
  end if;
end;
$$;
