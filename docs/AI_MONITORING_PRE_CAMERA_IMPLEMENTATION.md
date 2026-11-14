# Nababi AI Monitoring — Pre-camera implementation plan

## Purpose

Complete all work that does not depend on the exact Hikvision NVR model, camera network addresses, or the restaurant floor-plan image. The existing AI Monitoring page and the `cctv_cameras` / `cctv_events` tables are the first deployed foundation. This document is the implementation contract for the remaining camera-independent work and the later hardware integration.

## Confirmed scope

- Four camera areas: Dining Room 1 (3 tables), Dining Room 2 (7 tables), Cash Counter, Kitchen.
- One Nababi Admin Panel dashboard.
- Staff identity comes from the existing Staff QR / staff records, not facial recognition.
- No POS integration, order preparation tracking, or order receipt linkage.
- No purchase of additional hardware until the existing Hikvision kit is inspected and tested.
- No public exposure of NVR, RTSP, ONVIF, camera passwords, or video stream URLs.

## Work that can be completed before the NVR model and floor map arrive

1. **Dashboard and database contract**
   - Keep camera inventory and event metadata in Supabase.
   - Add an explicit connection state per camera: not configured, testing, connected, or error.
   - Show last successful connection check and last event time.
   - Keep video/audio out of the database.
   - Do not store NVR passwords or stream credentials in browser-visible tables or JavaScript.

2. **Event contract**
   - Standardize event types before connecting any detector:
     - `person_detected`
     - `person_entered_zone`
     - `person_left_zone`
     - `occupancy_changed`
     - `table_occupied`
     - `table_cleared`
     - `cash_counter_activity`
     - `device_offline`
     - `device_online`
     - `kitchen_qr_entry`
     - `kitchen_qr_exit`
   - Every event records camera/area, timestamp, optional staff ID, and structured metadata.
   - Events must identify whether their source is a camera detector, an authenticated staff QR action, or an administrator test. Never present a test event as a real camera detection.

3. **Staff kitchen entry/exit**
   - Treat kitchen entry/exit as a separate event from the staff member's shift check-in/check-out.
   - Reuse the existing staff identity/QR account system only after reviewing its current server-side validation.
   - Require authenticated server-side validation and prevent duplicate consecutive entry or exit events.
   - Do not use face recognition.
   - Do not change the existing attendance records or shift rules.

4. **Dining-room table map**
   - Wait for the user's actual floor-plan/map and table labels before assigning table coordinates or claiming which camera sees which table.
   - The current known counts (3 and 7) may be shown as planning totals only.
   - Once the map is supplied, create table-to-zone/camera mapping and verify every table is visible in the intended camera view.
   - Do not invent table names, positions, camera angles, or coverage.

5. **Cash counter**
   - Camera-based activity can be evaluated after a live stream is available.
   - Drawer-open detection must not be promised from video alone; confirm whether the cash drawer has a sensor or whether a supported POS event exists. POS integration is not currently in scope.

6. **Privacy and access**
   - Admin-only access to camera configuration and event history.
   - No audio recording/analysis by default.
   - No facial recognition or identity inference from video.
   - Before employee monitoring is activated, obtain appropriate Italian employment/privacy review, staff notice, lawful basis/authorisation where required, access controls, retention period, and deletion process.
   - Prefer event metadata over retaining copied video. Video remains on the NVR unless a later approved design requires otherwise.

## Hardware-dependent work — deliberately blocked

These steps must wait for the exact NVR model and physical setup:

- Confirm exact NVR and camera model, firmware, channel count, and PoE arrangement.
- Confirm the four camera channels and LAN topology.
- Test supported ONVIF/RTSP/ISAPI access on the local network.
- Determine whether the NVR supports the required stream profile and concurrent viewing.
- Select a secure local bridge/service only after testing compatibility and network isolation.
- Configure server-side secrets and access controls; never put device credentials in frontend code.
- Verify stream stability, latency, camera time synchronisation, and recording retention.
- Prove each AI detector with real footage before enabling alerts or reporting.

## Acceptance checklist for final completion

- [ ] All four camera records show an accurate connection state.
- [ ] Admin can see camera status and recent event metadata.
- [ ] No RTSP URL, password, or private stream is exposed to the browser.
- [ ] Staff QR kitchen entry/exit works independently of shift attendance.
- [ ] Duplicate or out-of-order kitchen QR events are rejected safely.
- [ ] Floor map and all ten dining tables are mapped using the user's supplied layout.
- [ ] Table visibility is verified against the correct camera feed.
- [ ] People/occupancy detectors are tested and their limitations documented.
- [ ] Cash drawer sensor/POS dependency is resolved or explicitly marked unsupported.
- [ ] Privacy, staff notice, permissions, and retention are reviewed before employee monitoring is enabled.
- [ ] End-to-end test is completed on the live Nababi site.

## Information to collect later

When available, request only:
1. A clear photo of the NVR model label (hide serial number, QR code, passwords, and verification codes).
2. The floor map showing camera positions, camera viewing directions, room boundaries, and table labels.
3. A simple note identifying which camera is intended for each area.

No additional hardware should be purchased until compatibility and the actual detection requirements have been tested.
