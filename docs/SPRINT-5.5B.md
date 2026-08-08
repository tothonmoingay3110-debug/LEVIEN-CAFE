# Sprint 5.5B — Live Order Sync

- Admin Orders receives secure live change notifications.
- Customer Tracking receives notifications scoped to its UUID tracking token.
- Order data remains behind the existing Admin session and tracking APIs.
- Event streams reconnect automatically and retain 30-second polling as fallback.

Run `supabase/migrations/20260809000200_sprint_5_5b_order_realtime.sql`
once in the Supabase SQL Editor before testing live order updates.
