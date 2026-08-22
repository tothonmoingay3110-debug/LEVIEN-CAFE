# V2 Module 4 — Order Display System (TV)

The public pickup board is available at:

```text
/order-display
```

Admin and operational staff can also open it from Admin → Orders → Open TV
Display. The link opens a separate tab so the Admin order queue remains open.

## Display behavior

- `New` and `Preparing` orders appear under **Preparing**.
- `Ready` orders appear under **Ready for Pickup**.
- `Completed` orders remain under **Completed** for 20 minutes.
- `Cancelled` orders never appear on the public board.
- A Full screen button switches a supported browser into kiosk-style display.
- Supabase Realtime pushes order changes to the board.
- A 15-second polling fallback keeps the board current if the realtime stream
  temporarily disconnects.

## Privacy boundary

The public endpoint returns only:

- Order number
- Status
- Created time
- Updated time

It does not return customer names, phone numbers, email addresses, delivery
addresses, purchased items, totals or payment information. The display page is
also marked `noindex`.

## Database and deployment

No new migration is required. The module reuses the existing `orders` table,
its `updated_at` trigger and the order Realtime publication introduced by:

```text
supabase/migrations/20260809000200_sprint_5_5b_order_realtime.sql
```

## Verification

1. Open `/order-display` and select Full screen.
2. Create a test web order; confirm it appears under Preparing.
3. In Admin → Orders, change it to Preparing and then Ready.
4. Confirm the board moves the order without a manual refresh.
5. Change the order to Completed; confirm it appears in Completed.
6. Change a test order to Cancelled; confirm it is absent from the board.
7. Inspect `/api/orders/display`; confirm no customer or payment data exists.
8. Run `npm.cmd run smoke:production -- https://your-production-domain.com`.
