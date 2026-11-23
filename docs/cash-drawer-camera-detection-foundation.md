# Cash Drawer camera-detection foundation

## Current status

This is database groundwork only. It does not connect to Hikvision, access an NVR,
run computer vision, or automatically add money to the cash drawer. The existing
manual Cash Drawer remains unchanged and remains the only active way to record
cash movements.

## Intended future flow

1. Verify the exact Hikvision camera/NVR model, firmware, channel, stream access,
   lens/framing, lighting, and the real 3–5 metre view of the cash-counting area.
2. Build and test a server-side video/event integration and a banknote detector
   against representative euro-note footage. A 4MP label alone does not establish
   that denominations can be read reliably at this distance.
3. Convert each distinct, sufficiently reliable detection into a structured event
   in `public.cash_drawer_camera_detections`.
4. Deduplicate source events and validate direction, denomination, quantity, and
   confidence before any ledger posting. Low-confidence or ambiguous events must
   be held for review rather than silently changing the balance.
5. Only after the detector and transaction logic have been validated should the
   backend create a linked row in `public.cash_drawer_entries`.

## Data and privacy boundaries

- Store event metadata and numeric detection results only.
- Do not upload camera frames, snapshots, or video to Supabase or the website.
- Keep recordings and any snapshots on the Hikvision NVR, subject to verified
  device capabilities and configuration.
- Do not expose NVR credentials, camera passwords, or service-role keys in browser
  code or Git.
- The table is readable by authorised admins. Inserts/updates are reserved for
  trusted server-side service-role code; no browser-side camera ingestion exists.

## Migration

Apply `supabase/migrations/202611230002_cash_drawer_camera_detection_foundation.sql`
in Supabase SQL Editor after the existing cash-drawer migration. Applying it only
creates the event table and policies; it does not activate detection.
