# V2 — Restaurant Operations

This document is the agreed V2 product roadmap. Sprint numbers used while
building Employee Management and Staff Scheduling do not represent completion
of the full V2 scope.

| Module | Scope | Status |
| --- | --- | --- |
| 1. Employee Management | Create, manage, activate and disable staff accounts | Complete |
| 2. Roles & Permissions | Owner/Manager/Supervisor/Staff access control | Complete |
| 3. Staff Scheduling | Availability, weekly schedules and shift management | Complete |
| 4. Order Display System — TV | Public live Preparing, Ready and Completed board | Complete |
| 5. Contact Us | Customer form, stored messages and Admin inbox | Complete |
| 6. Gift Card | Paid online/in-store issuance, balance, redeem and transaction history | Complete |
| 7. Online Payment | Stripe Checkout, webhook payment state, refund and order link | Complete |
| 8. AI Combo Suggestions | Explainable completed-order recommendations and draft creation | Complete |
| 9. QR / Order Tracking | Private QR entry, verified lookup and live customer order status | Complete |

Order confirmation now produces a private tracking QR. Customers without the QR
can look up an order with its order number plus checkout-phone verification.
The existing secure token, Realtime updates and polling fallback remain in use.

Attendance, clock-in and payroll remain outside the agreed scope.

Customer accounts, printable membership cards and configurable product-based
loyalty rewards were added as a supporting customer-platform release. See
`docs/V2-CUSTOMER-ACCOUNTS-PAYMENTS-LOYALTY.md`.

The supporting Staff Member Scanner lets counter staff identify a member and
redeem an issued reward by camera, 2D HID scanner or manual member number. It is
documented together with Module 8 in
`docs/V2-MEMBER-SCANNER-AND-COMBO-SUGGESTIONS.md`.
