# Sprint 5.6B - Production Health Check and Smoke Test

Sprint 5.6B adds repeatable post-deployment checks without changing the customer
or Admin interface.

## Health endpoint

`GET /api/health` checks server-side Supabase connectivity and returns only a
minimal service status. It never returns credentials, database records, or error
details. Responses are not cached or indexed.

- Healthy: HTTP `200` with `status: "ok"`.
- Database unavailable or server configuration invalid: HTTP `503` with
  `status: "degraded"`.

## Automated smoke test

After deployment, run:

```powershell
npm.cmd run smoke:production -- https://your-production-domain.com
```

The command verifies:

- Storefront, Menu, and Admin pages are reachable.
- Global security headers are present.
- The health endpoint can reach Supabase and is not cached.
- Invalid order tracking tokens are rejected without reading order data.

The smoke test is read-only and does not create or modify orders.
