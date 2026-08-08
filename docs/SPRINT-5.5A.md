# Sprint 5.5A — Live Catalog Sync

- Storefront catalog and website content subscribe to Supabase Realtime.
- Admin changes refresh open storefront tabs and devices automatically.
- Related table events are debounced into one catalog reload.
- Returning to a tab or reconnecting to the network triggers a safe refresh.
- Existing Supabase, local storage and static fallbacks remain unchanged.

Run `supabase/migrations/20260809000100_sprint_5_5a_catalog_realtime.sql`
once in the Supabase SQL Editor before testing cross-device updates.
