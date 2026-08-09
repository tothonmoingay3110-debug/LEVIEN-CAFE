# LEVIEN CAFE Production Checklist

## Environment

- Configure all six variables listed in `.env.example` on the hosting platform.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` server-only.
- Use an HTTPS Supabase project URL.
- Use an Admin password of at least 12 characters and a random session secret of at least 32 characters.
- Run `npm.cmd run verify:production` without sharing its environment values.

## Database

- Back up the production database before applying migrations.
- Apply all migrations in `supabase/migrations` in filename order.
- Confirm the Sprint 5.6A migration completed successfully.
- Confirm anonymous clients cannot read customers, orders, or order items.

## Application

- Run `npm.cmd run build` and deploy the generated Next.js application.
- Test storefront catalog loading and live catalog updates.
- Place one pickup order and one delivery order.
- Test Admin login, catalog image upload, order status updates, and logout.
- Test the private Tracking URL and live order-status updates.
- Confirm invalid or expired tracking tokens cannot read an order.

## Release

- Commit to `develop` and push it to GitHub.
- Open a new pull request from `develop` into `main`.
- Review the file diff and merge only after deployment checks pass.
