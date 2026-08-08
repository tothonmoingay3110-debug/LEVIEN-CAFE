# Sprint 5.5C — Production Hardening

- Checkout revalidates availability, combo membership, toppings and prices against Supabase.
- Supabase values replace browser-supplied product names and prices before Order creation.
- Checkout request size and customer input lengths are bounded.
- Admin credential comparisons use fixed-length constant-time hashes.
- Global response headers block framing, MIME sniffing and unnecessary device permissions.
- Admin and Tracking expose connection state and recover from transient network failures.
