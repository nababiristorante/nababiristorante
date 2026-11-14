# Nababi Recording Center — Implementation Plan

## Goal

Allow an authorized Nababi administrator to search and play historical CCTV recordings from the Hikvision NVR, including recordings from previous days, without uploading or storing video in the Nababi website, Supabase Storage, or the application database.

## Non-negotiable storage rule

- Original video recordings remain on the Hikvision NVR's local hard drive.
- Nababi must not ingest, mirror, or persist video files or continuous video streams.
- Supabase stores only structured metadata: camera configuration, AI/table events, timestamps, and audit records.
- Any playback shown inside the Admin Panel must be a secure, time-limited playback session/proxy to the NVR or an approved local integration service. Do not expose NVR credentials, RTSP URLs, or private network endpoints in browser JavaScript.
- Do not add cloud video storage or require a new storage subscription as part of this feature.

## Admin workflow

1. Open Admin Panel → AI Monitoring → Recording Center.
2. Select a date (default: today).
3. Select a camera: Dining Room 1, Dining Room 2, Cash Counter, or Kitchen.
4. Optionally select a table/zone when the selected camera has configured zones.
5. Enter a start time and end time, or choose a table-occupancy event from the event list.
6. Search the NVR recording index for that camera and time range.
7. Show matching recording segments and a playback control.
8. When opened from a table event, show the event's occupied/empty interval beside the playback timeline. Allow a small before/after context window where the NVR supports it.
9. Show a clear message if no recording is available, the NVR is offline, the requested period has expired from the NVR disk, or the integration is not configured.

## Search filters and display

Required filters:
- Date
- Camera
- Start time
- End time

Optional filter:
- Table/zone (only after floor-plan zones are mapped to the camera view)

Results should include:
- Camera name
- Recording start and end timestamps
- Duration
- Recording type/status when the NVR exposes it
- Playback action

The playback view should include:
- Video player
- Date/time being played
- Timeline/seek controls where supported
- Selected camera and table/zone
- Link back to the corresponding AI event/report

## Table-event integration

- Use the table/zone event timestamps as search inputs; do not assume the NVR knows table numbers.
- Store table occupancy transitions and derived intervals as metadata only.
- Example event sequence: table becomes occupied at 12:15 and becomes empty at 13:00; the report calculates 45 minutes occupied.
- The event-to-video action requests the NVR recording for the same camera and time interval, optionally with a configurable context window.
- Table detection and table-to-camera zone mapping must be validated against the real camera angle and floor plan before reporting these values as reliable.

## Technical architecture

### Browser / Admin Panel
- Authenticated admin-only UI.
- Calls a server-side integration endpoint for search and playback session creation.
- Never receives NVR administrator credentials or unrestricted RTSP/ONVIF credentials.

### Server-side integration
- A trusted server-side service or secure on-premises bridge communicates with the NVR using only protocols supported by the confirmed model/firmware (for example, vendor API/ISAPI or supported SDK).
- It validates the user's admin authorization, camera permissions, requested time range, and rate limits.
- It returns recording metadata and a short-lived playback URL/session or relays playback securely.
- The implementation must be selected only after confirming whether the NVR is reachable from the deployment environment or requires an on-premises bridge. A normal public website backend may not be able to reach a private LAN NVR directly.
- Do not expose the NVR to the public internet or port-forward its management interface as a shortcut.

### Supabase
- Stores camera/zone configuration, AI event metadata, and access audit records only.
- Does not store video files, video thumbnails, or continuous video segments.

## Dependencies that must be confirmed before live integration

- Exact NVR model and firmware version from the device label/system information.
- Supported playback/search API and authentication method for that model.
- Whether the NVR and cameras are on the same LAN and how the secure bridge can reach them.
- Actual camera channel mapping for the four areas.
- Floor plan and table/zone polygons for the two dining rooms.
- NVR time zone, clock accuracy, recording schedule, and retention/overwrite configuration.
- Admin authorization model and any required network/privacy approvals.

Do not guess the NVR model from the kit name. Do not implement a vendor-specific playback endpoint until the model and firmware are verified.

## Privacy and security requirements

- Recording access is restricted to authorized administrators and is audit-logged.
- Use least-privilege NVR credentials stored only in server-side secret storage.
- Use encrypted transport where supported and short-lived playback sessions.
- Do not enable audio recording or audio playback by default.
- Provide clear access and retention policies. Before employee monitoring is activated, obtain appropriate professional advice and complete applicable workplace/privacy requirements in Italy.
- Do not implement facial recognition or identify staff from faces. Staff-related events remain based on approved QR/staff-ID events.

## Delivery phases

### Phase 1 — Camera-independent preparation
- Define Recording Center UI states and filters.
- Define API contracts for search, playback-session creation, and errors.
- Define event-to-recording navigation using camera key and event timestamps.
- Add mock/demo states clearly labelled as sample data; no fake live playback.

### Phase 2 — NVR compatibility verification
- Read exact model and firmware.
- Confirm supported recording search/playback interface and LAN reachability.
- Choose direct server integration only if network architecture permits; otherwise design a secure on-premises bridge.

### Phase 3 — Secure NVR integration
- Implement server-side credential handling.
- Implement recording search and short-lived playback sessions.
- Validate offline, expired, no-result, and permission-denied cases.
- Verify that video is streamed from the NVR and is not persisted by Nababi.

### Phase 4 — Table-event playback
- Map each dining-room table to a camera zone using the floor plan.
- Validate occupied/empty event timestamps against recorded footage.
- Add “View recording” from table reports and verify time alignment.

## Acceptance checklist

- [ ] Admin can search by date, camera, start time, and end time.
- [ ] Table/zone filter appears only when a valid zone mapping exists.
- [ ] Admin can play a matching historical NVR recording inside the Admin Panel.
- [ ] Search works for previous days while the NVR still retains the recording.
- [ ] No video file or continuous video stream is stored in Supabase or website storage.
- [ ] No NVR credentials or private RTSP URLs are exposed to the browser.
- [ ] Offline, missing, expired, and unauthorized cases are clearly handled.
- [ ] Table event timestamps open the matching camera/time interval.
- [ ] Live integration is not marked complete until tested with the confirmed NVR model and firmware.
