# Optional Event Certificates

- Admin-only module; certificates are created only when a Super Admin chooses to create one.
- Birthday Party and Special Event use separate automatic Italian wording.
- The admin enters the recipient name and event date; a portrait photo is optional.
- The Nababi logo is read from the existing `site_settings.restaurant_logo_url` value and placed at the top of the print layout.
- Certificates are saved in `public.event_certificates`; optional portraits use the existing `nababi-media` Storage bucket under `certificates/`.
- No booking/event is automatically converted into a certificate. No Booking or Events records are modified.
- Print layout is A4 landscape with a gold and burgundy border. Browser print dialog is used.
- Apply `supabase/migrations/202611230003_event_certificates.sql` before using the module.
