# Sprint 5.6A - Security Audit and Production Readiness

Sprint 5.6A prepares LEVIEN CAFE for deployment without changing the storefront,
Admin, Checkout, or Tracking UI.

## Security hardening

- State-changing API routes reject cross-origin browser requests.
- JSON and upload routes reject oversized request bodies before processing them.
- Invalid JSON receives a controlled `400` response instead of an unhandled error.
- Production Admin credentials require a strong password and session secret.
- The Supabase service-role key remains server-only and cannot equal the public key.
- Browser database roles retain read-only access to active catalog data.
- Operational customer and order tables remain inaccessible to browser roles.
- Catalog junction policies no longer reveal links to inactive products, toppings, or combos.

## Required database step

Run this migration in Supabase before production deployment:

`supabase/migrations/20260809000300_sprint_5_6a_security_hardening.sql`

## Verification

```powershell
npm.cmd run verify:production
npm.cmd run build
```
