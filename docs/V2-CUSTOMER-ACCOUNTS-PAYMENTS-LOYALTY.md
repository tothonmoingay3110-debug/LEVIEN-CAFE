# V2 Customer Platform — rollout and operations

This release adds verified customer accounts, My Account, printable membership
cards, Stripe Checkout, practical Gift Card sales, and configurable product-based
loyalty rules. Attendance, payroll and points based only on dollars spent remain
outside this release.

## What customers can do

- Create an account, verify email, sign in, reset password and update profile.
- See orders linked to their verified email, loyalty progress, rewards and Gift Cards.
- Print a wallet-size membership card whose QR contains only the membership number.
- Pay for orders with hosted Stripe Checkout. The cart clears only after payment.
- Buy a digital Gift Card after signing in; the card activates only after Stripe pays.
- Redeem a Gift Card and one eligible free-product reward at checkout.

## What Owner and Manager can do

- Create rules such as “buy 5 of Product A, receive Product B” or “receive a teddy bear”.
- Pause programs and fulfill physical-gift rewards using the unique reward code.
- Create an in-store Gift Card only with cash/card-terminal receipt evidence.
- Create complimentary Gift Cards only as Owner.
- Cancel a paid Stripe order; the server refunds Stripe before cancelling the order
  and restores reserved Gift Card/reward value exactly once.

## Database rollout

1. Back up the Supabase database.
2. Run earlier migrations through `20260823000100_v2_module_6_gift_cards.sql`.
3. Run `supabase/migrations/20260824000100_v2_customer_accounts_payments_loyalty.sql` once.
4. Confirm the new tables, functions and `Pending Payment` order status exist.
5. Do not rerun old migrations out of order.

## Supabase Auth

Enable Email/Password sign-in. Set the production Site URL and add these redirect URLs:

- `https://YOUR_DOMAIN/auth/callback`
- `https://YOUR_DOMAIN/account/reset-password`

Use a production SMTP provider before launch. In the confirmation email template,
use the Supabase confirmation URL or a token-hash URL targeting `/auth/confirm`.
Test sign-up, confirmation, recovery and changed-password sign-in with a real inbox.

## Stripe

Create a webhook endpoint:

`https://YOUR_DOMAIN/api/payments/stripe/webhook`

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`

Add `STRIPE_SECRET_KEY` and that endpoint's `STRIPE_WEBHOOK_SECRET` to Vercel.
Use Stripe test mode first. Webhooks are authoritative; the success page performs
an idempotent confirmation fallback but is not the only fulfillment path.

## Gift Card email and encryption

Generate the encryption key once and preserve it across deployments:

`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Set `GIFT_CARD_ENCRYPTION_KEY`, `RESEND_API_KEY`, and a verified
`GIFT_CARD_FROM_EMAIL`. Losing or rotating the encryption key without a migration
makes existing full codes unrecoverable. If email delivery is unavailable, the sale
is marked `manual_required` or `failed`; the purchaser can still reveal the code in
My Account after payment.

## Acceptance test

1. Register and confirm a customer account; print the member card.
2. Create a loyalty rule in Admin, complete eligible orders, and confirm progress/reward.
3. Redeem a free-product reward only when that product is in the cart.
4. Complete and cancel a Stripe test order; confirm one refund and restored benefits.
5. Buy a test Gift Card; confirm activation, email/manual status, My Account reveal,
   partial redemption, balance, and cancellation restore.
6. Run `npm.cmd run build`, `npm.cmd run verify:production`, then the production smoke test.
