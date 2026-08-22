# V2 Module 6 — Gift Cards

> This original stored-value foundation is extended by the Customer Platform
> release. For paid online/in-store creation, encrypted code recovery and email
> delivery, follow `V2-CUSTOMER-ACCOUNTS-PAYMENTS-LOYALTY.md` and apply its
> migration after this one.

LEVIEN CAFE now supports secure Gift Card issuing, public balance lookup,
checkout redemption and a complete transaction history.

## Customer experience

- `/gift-card` lets a customer check a card balance without signing in.
- Checkout accepts one Gift Card per order.
- The order uses the smaller of the available balance and the order total.
- A partially covered order keeps the selected pay-at-store payment method for
  the remaining amount.
- A fully covered order records `Gift Card` as its final payment method.
- Success and tracking pages show the amount applied and the remaining amount
  due.

Online card charging is not part of this module. It remains Module 7.

## Admin management

Owner and Manager can open Admin → Store Management → Gift Cards to:

- Issue a card with an initial balance, recipient, optional email, note and
  expiry date.
- Copy the full generated code from the one-time result.
- Search and filter cards by state.
- Disable or reactivate an eligible card.
- Review issue, redemption and refund transactions with linked order numbers.

Supervisor and Staff cannot access this module or its API.

## Security and accounting rules

- The full code is never stored. Supabase stores its SHA-256 hash and final four
  characters only.
- The full code is displayed once immediately after issue. The operator must
  deliver or save it at that time.
- Browser roles receive no direct grants or RLS policies on Gift Card tables.
- Public and Admin operations use validated server routes.
- Redemption and order creation run in one PostgreSQL transaction while the
  Gift Card row is locked, preventing double spending during concurrent
  checkouts.
- Cancelling an order returns its redeemed amount exactly once. A cancelled
  order cannot be reopened, preventing refund/redeem cycles.
- History rows are append-only through the application; there is no manual
  balance adjustment or deletion workflow.

## Database rollout

After the existing checkout/order and V2.1A staff migrations are installed,
run this incremental migration once in the same Supabase project:

```text
supabase/migrations/20260823000100_v2_module_6_gift_cards.sql
```

Run the migration before deploying the matching application code because both
new checkout and order-status updates call its database functions. Do not run
the full `supabase/schema.sql` against an existing project; it is a reference
snapshot.

## Verification

1. Sign in as Owner or Manager and issue a small-value test Gift Card.
2. Copy the full code from the one-time result.
3. Open `/gift-card`, enter the code and confirm its balance.
4. Add a product, continue to checkout and apply the Gift Card.
5. Place the order and confirm the applied amount and amount due are correct.
6. Confirm the redemption appears in Admin → Gift Cards history.
7. Cancel the order in Admin → Orders and confirm one refund transaction.
8. Refresh and confirm the card balance is restored and no second refund is
   created.
9. Confirm Supervisor and Staff accounts cannot see Gift Cards.
10. Run `npm.cmd run build`.
11. After deployment, run
    `npm.cmd run smoke:production -- https://your-production-domain.com`.
