# Hik-Connect OpenAPI integration contract

## Purpose and current state

This document defines the intended cloud/P2P integration for the NABABI Admin Panel using the owner's Hik-Connect OpenAPI access. It replaces the earlier assumption that a separate on-premises bridge is the required integration path.

Known device facts supplied by the owner:
- NVR model: `DS-7604NXI-K1(D)`
- LAN address reported by owner: `192.168.1.185` (DHCP enabled)
- Four camera channels display video on the NVR.
- The four camera live views are available in the owner's Hik-Connect mobile app.
- The owner reports having a Hik-Connect OpenAPI App Key and Secret.

These facts do **not** yet prove that the OpenAPI application is approved, that this NVR is associated with the same authorized Hik-Connect account/team, or that the API permissions and streaming SDK are ready.

**Current implementation status:** the repository contains CCTV admin UI foundations and a shared status notice, but no Hik-Connect API client, server-side OpenAPI integration, JSDecoder/WASM SDK, live-view session, or playback session. Do not display a connected/ready state until end-to-end tests succeed.

## Supported integration path

Hikvision's official Hik-Connect Integration page describes:
- a RESTful Hik-Connect OpenAPI for partner applications;
- an application process involving a Hik-Connect account, API Key application, Technology Partner Portal registration and approval;
- a downloadable OpenAPI Developer Guide and WASM (JSDecoder) development kit;
- JSDecoder for web-browser live view and playback;
- P2P connectivity without port mapping or a static device IP.

The exact API host/region, authentication/signature rules, request schemas, stream-token flow, device identifiers, permissions and JSDecoder initialization must be taken from the owner's approved developer guide and matching SDK package. Do not guess these values or copy endpoints from unrelated Hik-Connect Team, Hik-Partner Pro, HikCentral, EZVIZ or unofficial examples.

## Architecture

1. The Admin Panel authenticates the administrator using the existing Supabase Auth session and existing admin authorization checks.
2. Browser requests go only to authenticated Nababi server-side functions.
3. A Supabase Edge Function (or another existing trusted server runtime, if deployment configuration proves that is the active backend) stores and uses the Hik-Connect App Key/Secret. Secrets must never be embedded in frontend JavaScript, HTML, public Supabase rows, logs, Git commits, or chat.
4. The server-side function calls only the approved Hik-Connect OpenAPI endpoints documented for the owner's application and region.
5. The server returns only the minimum scoped data needed by the authorized admin, such as camera metadata, short-lived stream authorization data, and capability state.
6. The browser uses the official matching JSDecoder/WASM kit for supported live view and playback. Do not substitute a normal HTML video element or raw RTSP URL for an EZOPEN/P2P stream unless the official guide explicitly documents that protocol path.
7. Keep video on Hik-Connect/NVR infrastructure. Do not store continuous video in Supabase.

No inbound router port, port forwarding, DMZ, public NVR URL, or direct browser-to-NVR request is part of this design. The NVR's LAN IP remains diagnostic/configuration information and is not the cloud P2P connection method.

## Required server-side safeguards

- Store App Key and Secret as server-side deployment secrets only.
- Verify Supabase access token and administrator authorization on every admin endpoint.
- Validate device/camera identifiers against the authorized account's returned device list.
- Enforce rate limits and request timeouts.
- Never return App Secret, raw authorization headers, reusable access tokens, device verification codes, NVR passwords, private LAN URLs or unrestricted stream URLs to the browser.
- Use short-lived, camera-scoped stream sessions where supported by the official API.
- Avoid logging secrets, tokens, stream URLs, or video content.
- Record administrator ID, camera, action, result, timestamp and session expiry/revocation for audit.

## Shared connection states

The existing CCTV modules must use one server-authoritative state:
- `not_configured`: server-side credentials or approved app configuration are absent;
- `api_auth_failed`: Hik-Connect rejects application authentication;
- `device_not_authorized`: the NVR is not available to the approved API account/team or permission is missing;
- `device_offline`: API reports the device offline;
- `compatibility_unverified`: device is listed but live/playback capability has not passed tests;
- `ready`: required device, channel and stream tests passed;
- `degraded`: API or one or more capabilities are unavailable.

The server derives state from real API responses and end-to-end tests. A saved IP, model number, serial number, mobile-app success, or successful visit to the local NVR login page must never by itself produce `ready`.

## Existing Admin Panel modules

The same verified state is shared by:
- Camera Management;
- AI Monitoring;
- Table Monitoring;
- Recording Center;
- Fire & Smoke Monitoring;
- CCTV Operations.

Until the relevant capability is verified:
- keep Live View and Playback unavailable;
- keep manual table-task workflows working;
- do not generate automatic AI, occupancy, cash-drawer, fire or smoke events;
- do not imply that camera analytics are a certified safety/fire alarm system;
- do not identify employees from faces or add facial recognition.

## Channel and recording checks

After API access is confirmed:
- map each of the four actual NVR channels to its real restaurant area;
- verify device time, timezone, recording schedule and retention;
- test live view on every channel;
- search and play back a known recording from today and a previous day;
- verify session expiry and revocation;
- enable individual capabilities only after their tests pass.

## Privacy and operational safeguards

- Audio stays disabled by default.
- Before enabling employee monitoring, complete the applicable Italian workplace/privacy review and configure transparent notices, purpose limitation, access restrictions and retention with qualified advice.
- Restrict footage access to authorized administrators and log access.
- Do not treat camera analytics as a certified fire or safety system.

## Implementation gates

- [ ] Confirm the App Key/Secret belong to the approved **Hik-Connect OpenAPI** application (not Team OpenAPI or Hik-Partner Pro).
- [ ] Confirm the application approval, API region/host and authorized Hik-Connect account.
- [ ] Obtain the matching official OpenAPI Developer Guide and WASM (JSDecoder) development kit from the Technology Partner Portal.
- [ ] Confirm the NVR is visible and authorized in the same Hik-Connect account/application.
- [ ] Implement server-side API authentication using the exact official guide.
- [ ] Implement safe device/channel discovery and shared connection state.
- [ ] Integrate the official JSDecoder/WASM kit and test all four channels.
- [ ] Test real recording search and playback, including previous-day footage.
- [ ] Verify secrets never reach browser responses, logs or Git.
- [ ] Complete privacy review before enabling staff monitoring or analytics.

## Why implementation is not faked in this commit

The public Hikvision integration page confirms the product flow and SDK availability, but the detailed developer guide and SDK download are behind the Technology Partner Portal. The exact signing rules, API endpoints, regional host and JSDecoder package are therefore not available in the repository. Implementing guessed request signatures or fake stream URLs would create a non-working or unsafe integration. The next coding step must use the approved developer guide and matching SDK, not invented endpoints.
