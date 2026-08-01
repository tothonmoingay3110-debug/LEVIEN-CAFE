LEVIEN Order Sync Fix

1. Stop the server with Ctrl + C.
2. Copy the components folder into the LEVIEN-CAFE project and choose Replace.
3. Run: npm.cmd run dev
4. Place a new order, then open Admin > Orders.

Fixed:
- Admin no longer overwrites newly placed orders.
- Orders resync on storage events, focus, and tab visibility changes.
- Admin order status changes are saved back to the shared order storage.
