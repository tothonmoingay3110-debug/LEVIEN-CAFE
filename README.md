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

## V2.1B employee management

Owner and Manager accounts can now manage employees directly from
Admin → Employees. The workspace supports account creation, role and contact
updates, planned weekly hours, hourly pay, account locking, and secure temporary
password resets. Compensation remains private to Owner and Manager.

Apply `supabase/migrations/20260816000200_v2_1b_employee_management.sql` after
the V2.1A migration. See `docs/V2.1B-EMPLOYEE-MANAGEMENT.md` for the rollout and
test checklist.

## V2.2 shift registration and scheduling

Every Supabase Auth staff account now has a Schedule workspace. Employees can
register preferred date-specific shifts and view their published schedule.
Owner and Manager can review requests, publish direct assignments, prevent
overlapping shifts, and edit or cancel scheduled work.

Apply `supabase/migrations/20260816000300_v2_2_shift_scheduling.sql` after V2.1B.
See `docs/V2.2-SHIFT-SCHEDULING.md`. Attendance and clock-in remain out of scope.

## V2.3 labor planning

Owner and Manager now have a private Labor Planning workspace that compares
planned weekly hours with published schedule hours and calculates a weekly labor
cost forecast. Reports include daily coverage, employee variance, and CSV export.

V2.3 reuses V2.1B compensation and V2.2 schedule data, so it does not require a
new SQL migration. See `docs/V2.3-LABOR-PLANNING.md`.

## V2.4 time off requests

All individual staff accounts can submit date-range time-off requests. Owner and
Manager can approve, decline, or cancel approved availability. Approved time off
appears in Schedule and blocks overlapping shift creation or approval.

Apply `supabase/migrations/20260822000100_v2_4_time_off_requests.sql` once. See
`docs/V2.4-TIME-OFF.md`. Paid leave and payroll calculations remain out of scope.

## V2.5 copy weekly schedule

Owner and Manager can copy seven days of published shifts into a future week.
The copy operation preserves the source and existing target schedules while
skipping conflicts, approved time off, inactive accounts, and restricted Owner
assignments. See `docs/V2.5-COPY-WEEK.md`. No new SQL migration is required.

## V2.11 staff operations suite

V2.6 through V2.11 are delivered together as one cumulative staff-operations
release. My Workspace gives each authenticated employee a private inbox,
upcoming schedule, time-off summary, and manager-reviewed shift coverage flow.
Owner and Manager also receive date-range Staff Reports with CSV export and an
append-only Activity Log for schedule, coverage, and time-off actions.

Apply `supabase/migrations/20260822000200_v2_11_staff_operations.sql` after the
V2.4 migration. See `docs/V2.11-STAFF-OPERATIONS.md`. This release does not add
attendance, clock-in, payroll, SMS, or email delivery.

## V2 Module 4 order display system

The public TV pickup board at `/order-display` shows Preparing, Ready for Pickup,
and recently Completed order numbers. It updates through the existing Supabase
order Realtime stream with a polling fallback and never exposes customer,
delivery, item, total, or payment data. Staff can open it from Admin → Orders.

No new migration is required after Sprint 5.5B. See
`docs/V2-MODULE-4-ORDER-DISPLAY.md` for operation and verification, and
`docs/V2-RESTAURANT-OPERATIONS-ROADMAP.md` for the agreed nine-module V2 scope.

## V2 Module 5 contact us

The storefront now includes a responsive Contact Us form for general questions,
order support, catering, feedback and other requests. Submissions are saved in
Supabase and appear in Admin → Overview → Contact Messages, where Owner and
Manager accounts can search, filter, update status and keep a private follow-up
note. Supervisor and Staff accounts cannot access the inbox.

Apply `supabase/migrations/20260822000300_v2_module_5_contact_messages.sql`
once. See `docs/V2-MODULE-5-CONTACT-US.md` for the privacy boundary, rollout and
verification checklist.

## V2 Module 6 gift cards

Owner and Manager accounts can issue, search, disable and reactivate Gift Cards
from Admin → Store Management → Gift Cards. Customers can securely check a
balance at `/gift-card` and redeem all or part of a card during checkout. Order
cancellation returns the redeemed amount exactly once, and the Admin history
records every issue, redemption and refund.

Only a SHA-256 hash and the final four characters of each code are stored. The
full code is displayed once when the card is issued. Apply
`supabase/migrations/20260823000100_v2_module_6_gift_cards.sql` once before
deploying this code. See `docs/V2-MODULE-6-GIFT-CARDS.md` for rollout and tests.

Demo login: `admin` / `123`

## Sprint 4 highlight

The storefront now reads the same data saved in Admin. Store name, tagline, logo, announcement, products, uploaded images, categories, combos, promotions, Our Story, contact information and map settings can update without editing source code.

Data is still stored in the current browser for this stage. See `docs/SPRINT-4.md` and `supabase/schema.sql` for the cloud migration preparation.
