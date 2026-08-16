# LEVIEN CAFE — Sprint 4

## Run

```powershell
npm.cmd install
npm.cmd run dev
```

Storefront: http://localhost:3000

Menu: http://localhost:3000/menu

Admin: http://localhost:3000/admin

## V2.1A staff access

Admin supports individual Supabase Auth accounts with Owner, Manager,
Supervisor, and Staff roles. Apply the V2.1A migration and create the first
Owner by following `docs/V2.1A-STAFF-AUTH.md`.

The environment-based Admin credentials remain a temporary Owner fallback
during the migration.

Demo login: `admin` / `123`

## Sprint 4 highlight

The storefront now reads the same data saved in Admin. Store name, tagline, logo, announcement, products, uploaded images, categories, combos, promotions, Our Story, contact information and map settings can update without editing source code.

Data is still stored in the current browser for this stage. See `docs/SPRINT-4.md` and `supabase/schema.sql` for the cloud migration preparation.
