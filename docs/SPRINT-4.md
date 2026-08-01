# Sprint 4 — Live Website Settings Bridge

## Completed

- Website now reads the same browser data saved by Admin.
- Product changes, uploaded product images, badges and Sold Out status appear on the storefront after navigation or refresh.
- Promotion slider reads Admin promotions and uploaded banner images.
- Categories and Combo section read Admin data.
- Website Content now controls:
  - Store name
  - Brand tagline (the `CAFE & EATERY` line)
  - Logo
  - Announcement bar
  - Our Story title, text and image
  - Address, phone, email and opening hours
  - Google Maps direction link
  - Footer note
- Header, Footer, Our Story and Map use Website Content instead of hard-coded text.
- Supabase-ready SQL schema expanded for the next cloud migration step.

## Current storage mode

Sprint 4 still stores demo data and uploaded images in browser `localStorage`. This allows the Admin and storefront to stay synchronized on the same browser without requiring Supabase credentials.

## Important browser limitation

Large photos stored as base64 can exceed the browser localStorage limit. Use compressed images for this demo. Supabase Storage will remove this limitation in the cloud migration.

## Test

1. Open `/admin` and login with `admin / 123`.
2. Open **Website Content** and change the Brand Tagline.
3. Save, then click **View Store**.
4. The line below LEVIEN CAFE should show the new tagline.
5. Edit a product or promotion, upload an image and save.
6. Return to the storefront or `/menu`; the changes should be visible.
