# Sprint 5.1 — Supabase Foundation

## Scope

- Add browser and server Supabase clients.
- Add a versioned initial database migration.
- Add typed database definitions.
- Enable Row Level Security on every exposed table.
- Allow public read access only to storefront catalog/content tables.
- Keep orders, customers and existing Local Storage behavior unchanged.
- Add `/supabase-test` as a temporary connection test page.

## Apply the migration

1. Open Supabase Dashboard → SQL Editor → New query.
2. Open `supabase/migrations/20260805000100_sprint_5_1_foundation.sql`.
3. Copy all SQL, paste it into SQL Editor and click **Run** once.
4. Restart the local Next.js server.
5. Open `http://localhost:3000/supabase-test`.

A green **Supabase connected** page confirms that the URL, publishable key, schema and RLS read policy all work.

## Security

- `.env.local` stays outside Git through `.gitignore`.
- Never place a Supabase secret/service-role key in a `NEXT_PUBLIC_*` variable.
- Operational tables have no anonymous read/write policy in this sprint.
- Secure server-side order writes and Admin authentication are later sprint work.

## Rollout

This is a non-destructive foundation sprint. The existing website continues to use Local Storage until the catalog and order migration phases are tested.
