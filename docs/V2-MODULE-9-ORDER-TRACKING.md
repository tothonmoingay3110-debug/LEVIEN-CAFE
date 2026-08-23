# V2 Module 9 — QR / Order Tracking

## Delivered experience

- Every confirmed online order displays a QR for its private tracking link.
- Customers can copy the same link and reopen it on another device.
- `/order/track` accepts a manual order number plus at least the final four
  digits of the checkout phone number.
- The existing live Supabase status stream remains primary, with the existing
  periodic refresh fallback when Realtime is unavailable.
- Cancelled orders and the full New → Preparing → Ready → Completed lifecycle
  remain visible through the existing tracking UI.

## Privacy and abuse controls

The QR contains the order UUID used as a private tracking token. It does not
contain customer contact details. A public order number by itself is not enough
to access the order: manual lookup also verifies checkout-phone digits.

Manual lookup is restricted to same-origin requests, accepts a small JSON body,
and is rate-limited per client address. Verification failures use a generic
response so callers cannot learn which part was incorrect.

## Deployment

No SQL migration or additional environment variable is required. Deploy the
application normally after a successful production build.

## Verification

1. Place a test order and open its confirmation page.
2. Scan the QR with another device and confirm the correct tracking page opens.
3. Open `/order/track` without query parameters.
4. Enter the order number and the last four checkout-phone digits; confirm the
   same order opens.
5. Enter an incorrect phone suffix and confirm no order details are returned.
6. Change the order status in Admin and confirm the customer tracking page
   updates live or through the polling fallback.
