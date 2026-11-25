# Hikvision CCTV integration audit

## Device supplied by the site owner

- NVR model: Hikvision DS-7604NXI-K1(D)
- LAN address reported by the owner: 192.168.1.185 (DHCP enabled)
- The owner confirmed that the NVR login page opens from Safari on the same Wi-Fi.
- Firmware version is not yet confirmed.
- No NVR credentials are stored in this repository.

## Current Admin Panel audit (main branch)

| Admin module | Current implementation | CCTV work required |
|---|---|---|
| AI Monitoring | Reads camera configuration and event metadata; preview is explicitly not connected | Use verified camera/NVR stream and supported event source; never fabricate AI events |
| Table Monitoring | Shows 3 Dining Room 1 and 7 Dining Room 2 placeholder table cards | Map camera channels and validated table zones; show live status only when supported detection is actually running |
| Camera Management | Edits camera display name, area, order and enabled flag in `cctv_cameras` | Add NVR/channel association and connection health through a server-side integration, not browser-held credentials |
| Recording Center | Date/camera/time/zone form; search button is disabled and playback is unavailable | Search NVR recordings and issue short-lived, authenticated playback sessions |
| Fire & Smoke Monitoring | Stores a schedule and reads matching alert metadata; UI explicitly says detection is not active | Only enable after a validated detector/integration exists; never treat this as a certified fire alarm |
| CCTV Operations | Manages manual table tasks, settings, and alerts; UI explicitly says automatic camera detection is not connected | Link approved camera events to tasks only after validated detection and authorization |
| Tables / bookings / reports / cash drawer / staff activity | Existing operational data modules; not direct video players | Where appropriate, link timestamped records to an authorized Recording Center search; do not add video storage or infer events |

## Confirmed versus unconfirmed

Confirmed by owner:
- The device is reported as DS-7604NXI-K1(D).
- Its local address is reported as 192.168.1.185 and DHCP is enabled.
- The login page is reachable from an iPhone on the same Wi-Fi.

Still required before vendor-specific integration:
- Exact firmware/build and regional hardware variant from the NVR's System Information page.
- NVR channel-to-camera mapping (which channel views Dining Room 1, Dining Room 2, cash counter, kitchen).
- NVR clock/time zone, recording schedule and retention period.
- Whether the NVR exposes the required search/playback/live-view APIs on this firmware.
- A secure on-premises bridge host or other approved network path from the private LAN to the deployed application.

## Required architecture

1. The browser calls an authenticated Nababi server endpoint only.
2. A trusted on-premises bridge on the restaurant LAN communicates with the NVR using a protocol verified for the exact firmware (for example ISAPI/SDK/ONVIF where supported).
3. The bridge establishes an outbound authenticated connection; do not open router ports or expose the NVR management interface to the public internet.
4. NVR credentials stay in server-side/bridge secret storage. Never put credentials, RTSP URLs, or private NVR endpoints in frontend JavaScript, source control, or Supabase client-readable rows.
5. Supabase stores camera/channel configuration, table-zone metadata, event timestamps and audit metadata only. Original recordings stay on the NVR disk.
6. Playback sessions must be short-lived, admin-authorized and audit-logged. Audio remains off by default.
7. Do not implement facial recognition or identify staff from faces. Complete applicable Italian workplace/privacy review before enabling employee monitoring.

## Delivery sequence

### Phase A — configuration and compatibility
- Confirm firmware and channel map.
- Confirm NVR time and recording retention.
- Select and secure the on-premises bridge deployment location.
- Verify least-privilege account and supported API calls.

### Phase B — shared connection service
- Implement bridge registration/health, server-side credential handling, admin authorization and audit events.
- Add one shared NVR connection status consumed by Camera Management, AI Monitoring, Table Monitoring, Recording Center, Fire & Smoke Monitoring and CCTV Operations.
- Keep all dependent features clearly unavailable while the bridge or NVR is offline.

### Phase C — live view and playback
- Implement live view and recording search/playback through the bridge.
- Verify real video from each mapped channel and previous-day recordings.
- Ensure video is streamed from the NVR and never persisted by Nababi.

### Phase D — table and event features
- Validate camera framing and table-zone mapping against the floor plan.
- Only then enable table occupancy or other supported detections.
- Link timestamped events to recordings. Keep manual workflows available as fallback.

## Safety / non-goals

- Do not port-forward the NVR, place it in a DMZ, or expose its web interface/RTSP directly to the internet.
- Do not ask the owner to send passwords, QR codes, serial numbers or secret URLs in chat.
- Do not claim camera detection, table occupancy, fire/smoke detection or playback is active until tested against the real device.
- This audit does not change production behavior or create a fake/demo live feed.
