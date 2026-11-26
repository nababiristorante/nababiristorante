# Hikvision bridge API contract (firmware-independent)

## Purpose and current state

This contract prepares the Nababi Admin Panel for a secure on-premises bridge between the deployed application and the Hikvision NVR on the restaurant LAN. It deliberately does not assume a Hikvision endpoint, authentication scheme, codec, or firmware capability.

**This document is a contract only.** No bridge service, NVR connection, live stream, recording search, or playback endpoint is implemented by this change. Until a real bridge is deployed and verified, the Admin Panel must show the connection as **Not configured** and keep live view, recording playback, and automatic detections unavailable.

Device currently reported by the site owner: DS-7604NXI-K1(D), LAN address 192.168.1.185 (DHCP). Firmware and channel mapping remain unverified. Do not hard-code the LAN address into browser code or production configuration.

## Trust boundaries

1. The browser communicates only with Nababi's authenticated server API.
2. The Nababi server authenticates the administrator using the existing server-side Supabase Auth verification and checks the existing admin authorization source. A browser-supplied role is never trusted.
3. The bridge makes an outbound, mutually authenticated connection to Nababi. No inbound router port, port-forward, DMZ, public NVR URL, or direct browser-to-NVR request is permitted.
4. The bridge communicates with the NVR only over a protocol and operations verified against the installed device/firmware.
5. NVR credentials are held in a secret store accessible only to the bridge. They must never be returned to the browser, stored in frontend-readable Supabase rows, committed to Git, or sent in chat.
6. Video remains on the NVR. Nababi persists operational metadata and access audit events only; it does not persist video, continuous streams, or video thumbnails.

## Shared connection state

All CCTV-related Admin Panel modules consume one server-authoritative connection state. The server must not infer health from a saved IP address or from a successful browser request to the local login page.

Suggested response for `GET /api/admin/cctv/connection`:

```json
{
  "state": "not_configured",
  "bridge": { "registered": false, "online": false, "last_seen_at": null },
  "nvr": { "reachable": false, "model": null, "firmware": null, "clock_offset_seconds": null },
  "capabilities": {
    "live_view": false,
    "recording_search": false,
    "playback": false,
    "event_push": false
  },
  "checked_at": "2026-11-26T00:00:00Z",
  "reason_code": "BRIDGE_NOT_REGISTERED"
}
```

Allowed states: `not_configured`, `bridge_offline`, `nvr_unreachable`, `compatibility_unverified`, `ready`, `degraded`. Capability flags are independently enabled only after end-to-end tests pass. Do not show a green/connected state for a merely registered bridge.

## Server API

All routes below are server-side routes. Every admin route requires a valid Supabase access token, server-side admin authorization, rate limiting, and an audit record. The bridge channel uses a separate machine identity and mutually authenticated transport; it never reuses a browser token.

| Method and route | Purpose | Required behavior |
|---|---|---|
| GET `/api/admin/cctv/connection` | Shared connection state | Return safe status only; never return secrets, LAN credentials, or raw NVR URLs |
| POST `/api/admin/cctv/recordings/search` | Search historical segments | Validate camera key, time range and permission; return metadata only |
| POST `/api/admin/cctv/playback-sessions` | Create playback session | Return a short-lived, scoped session; audit create/expiry/revoke |
| POST `/api/admin/cctv/live-sessions` | Create live-view session | Enable only for verified channel/capability and authorized admins |
| DELETE `/api/admin/cctv/sessions/{session_id}` | Revoke session | Revoke promptly; idempotent |
| GET `/api/bridge/v1/commands/next` | Bridge outbound poll | Machine-authenticated; return only commands for that registered bridge |
| POST `/api/bridge/v1/heartbeat` | Bridge health/capabilities | Validate bridge identity and schema; record server receive time |
| POST `/api/bridge/v1/results` | Bridge command result | Correlate request ID; validate operation and payload size |
| POST `/api/bridge/v1/events` | Optional validated event metadata | Reject unknown camera keys and invalid timestamps; deduplicate event IDs |

The bridge API may use an outbound WebSocket instead of polling if the deployment supports it, but the trust boundary and machine authentication requirements remain the same. Do not expose a public bridge-registration endpoint that accepts an unauthenticated device identity.

## Request and response shapes

### Recording search

Request:

```json
{
  "camera_key": "dining_room_1",
  "from": "2026-11-25T18:00:00+01:00",
  "to": "2026-11-25T19:00:00+01:00"
}
```

Validation:
- `camera_key` must reference an enabled, administrator-configured camera/channel mapping.
- `from` and `to` must be valid timestamps; `to` must be after `from`.
- Enforce a configurable maximum search interval and rate limit.
- Return segment IDs, start/end times, duration and supported recording type only. Never return NVR credentials or direct RTSP/ISAPI URLs.

### Playback/live session

A session response contains only an opaque session ID, an application-controlled playback URL, expiry time, and supported controls. The URL must be short-lived, scoped to one administrator, one camera, one time interval (for playback), and one session. It must not contain credentials or a raw NVR address. Session URLs must be non-cacheable and protected against cross-origin use.

### Bridge heartbeat

Heartbeat reports:
- bridge software version and stable registered bridge ID;
- NVR reachability as observed from the bridge;
- detected model/firmware only when read successfully;
- verified capabilities and the test timestamp for each capability;
- NVR clock/time-zone observations;
- camera channel mapping status (configured/verified, not inferred).

The server timestamps receipt. A bridge must not self-assert `ready`; the server derives state from fresh heartbeat, compatibility checks, and successful end-to-end probes.

## Admin Panel behavior

The same connection summary is shown consistently in:
- Camera Management;
- AI Monitoring;
- Table Monitoring;
- Recording Center;
- Fire & Smoke Monitoring;
- CCTV Operations.

While state is not `ready`:
- show the specific unavailable reason and last successful check;
- keep Live View and Playback disabled;
- keep existing manual table-task workflows available;
- do not create automatic AI, occupancy, cash-drawer, fire, or smoke events;
- do not imply that a camera is recording merely because it is configured.

Tables, bookings, cash-drawer records, reports, and staff activity may link to a recording search only after the camera mapping and session authorization are verified. Do not identify employees from faces or add facial recognition.

## Required audit events

Record administrator ID, action, camera key, requested time range, result, bridge ID, timestamp, and session expiry/revocation. Never log passwords, authorization headers, session tokens, playback secrets, or raw stream URLs.

## Italian privacy and operational safeguards

- Keep audio disabled by default.
- Before enabling employee monitoring, complete applicable Italian workplace/privacy review and configure transparent notices, access restrictions, retention and documented purposes with qualified advice.
- Do not present camera analytics as a certified fire alarm or safety system.
- Preserve manual operational workflows when the bridge or NVR is offline.

## Readiness and acceptance gates

- [ ] Bridge is installed on an approved always-on host on the restaurant LAN.
- [ ] Bridge establishes outbound authenticated transport; no inbound router exposure is required.
- [ ] NVR model, firmware, regional variant and supported API operations are verified.
- [ ] NVR clock/time zone, recording schedule and retention are verified.
- [ ] Each configured channel is physically checked and mapped to its actual area.
- [ ] Server-side admin authorization, machine identity, secret storage and audit logging pass review.
- [ ] Connection state correctly distinguishes unconfigured, bridge offline, NVR unreachable and ready.
- [ ] Recording search and playback are tested against real recordings, including previous-day footage.
- [ ] Browser responses contain no NVR credentials, private NVR endpoints or unrestricted stream URLs.
- [ ] Video remains on the NVR and session expiry/revocation is tested.
- [ ] No automated detection is enabled until its specific detector is validated end-to-end.

## Next implementation stage

After this contract is reviewed, implement the server API and bridge runtime in the repository's actual deployment architecture, then wire the shared connection state into the existing Admin Panel pages. Vendor-specific NVR operations remain behind a capability adapter and are added only after the exact device firmware is verified.
