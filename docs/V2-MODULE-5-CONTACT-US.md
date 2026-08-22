# V2 Module 5 — Contact Us

The storefront Contact link now opens a real customer contact form at `/#contact`.
Messages are stored in Supabase and managed in Admin → Overview → Contact
Messages.

## Customer experience

- Name, email, subject and message are required.
- Phone is optional.
- Subjects cover general questions, order support, catering, feedback and other
  requests.
- The form stays on the storefront and shows a clear success or retry state.
- Contact email and phone continue to come from Website Content.
- Desktop, tablet and mobile layouts use the existing LEVIEN visual system.

## Admin inbox

Owner and Manager can:

- Search customer, email, phone, subject and message text.
- Filter active, new, in-progress, resolved, archived or all messages.
- Change a message through `New`, `In progress`, `Resolved` and `Archived`.
- Save a private internal note with the customer request.
- Refresh manually; the inbox also refreshes every 30 seconds and when the tab
  becomes active.

Supervisor and Staff do not receive the Contact Messages navigation item and
the server rejects their direct API requests.

## Privacy and security boundary

- Browser roles have no direct grants or RLS policies on `contact_messages`.
- Public submission and staff management go through server routes using the
  server-only Supabase service role key.
- Admin reads and updates require an authenticated staff session plus the
  `manage_contacts` permission, which is limited to Owner and Manager.
- Mutating requests require same-origin requests and enforce body-size and field
  limits.
- A hidden honeypot field discards common automated submissions without
  revealing the filter.
- Status updates are recorded in the staff activity log.

## Database rollout

After V2.1A staff profiles are installed, run this migration once in the same
Supabase project:

```text
supabase/migrations/20260822000300_v2_module_5_contact_messages.sql
```

Do not paste the full `supabase/schema.sql` into an existing production project.
That file is a reference snapshot; the migration above is the incremental
update.

## Verification

1. Open the storefront, select Contact and submit a valid test message.
2. Confirm the success notice appears without leaving the page.
3. Sign in as Owner or Manager and open Overview → Contact Messages.
4. Confirm the test message appears and customer details are correct.
5. Change it to In progress, add an internal note and save.
6. Refresh the inbox and confirm both values persist.
7. Resolve or archive the message and verify the matching filter.
8. Sign in as Supervisor or Staff; confirm Contact Messages is absent.
9. Run `npm.cmd run build`.
10. After deployment, run
   `npm.cmd run smoke:production -- https://your-production-domain.com`.
