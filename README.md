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

Demo login: `admin` / `123`

## Sprint 4 highlight

The storefront now reads the same data saved in Admin. Store name, tagline, logo, announcement, products, uploaded images, categories, combos, promotions, Our Story, contact information and map settings can update without editing source code.

Data is still stored in the current browser for this stage. See `docs/SPRINT-4.md` and `supabase/schema.sql` for the cloud migration preparation.
