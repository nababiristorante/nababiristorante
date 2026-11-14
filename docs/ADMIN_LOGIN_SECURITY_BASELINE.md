# Nababi Admin Login Security Baseline

## Purpose
Harden access to the existing Nababi Admin Panel without interrupting current sign-in, staff QR attendance, CCTV recording, or the public website.

This document is an implementation and verification plan. It does not claim that MFA, CAPTCHA, or additional server-side protections are already enabled.

## Current application observations
- Admin V2 signs in with Supabase Auth email/password.
- The browser checks the signed-in user against `admin_users`, the configured `ADMIN_USER_ID`, or an active `staff` record.
- Module visibility is controlled in the client, so database Row Level Security (RLS) must independently enforce every data permission.
- A client-only failed-login counter is not a security boundary and must not be used as a substitute for server-side protections.

## Required protections

### 1. Multi-factor authentication (MFA)
- Enable Supabase Auth TOTP MFA for administrator accounts.
- Provide an enrollment and verification flow before enforcing MFA.
- Enforce the appropriate assurance level (AAL2) in database policies for sensitive admin operations, after all authorized administrators have enrolled and recovery has been tested.
- Do not lock out existing administrators by enabling enforcement before enrollment.
- Staff MFA policy should be decided separately according to their access level.

### 2. Login abuse protection
- Configure Supabase Auth rate limits and CAPTCHA/bot protection using supported project settings.
- Use verified email/password recovery flows.
- Never implement a frontend-only lockout as the main brute-force defense.
- Do not expose whether an email address belongs to an account in public error messages.

### 3. Authorization and database
- Keep the service-role key exclusively on trusted server-side systems; never place it in browser code.
- Audit RLS on every table and Storage bucket used by the Admin Panel.
- Verify that admin and staff policies enforce role and module permissions at the database layer, not only by hiding navigation items.
- Restrict privileged CCTV/NVR integration credentials to a server-side integration or trusted LAN bridge.

### 4. Session and account hygiene
- Review Supabase session lifetime, refresh-token behavior, password reset redirect allowlist, and allowed authentication providers.
- Require unique strong passwords and remove access for departed staff promptly.
- Keep production HTTPS enabled.
- Avoid logging passwords, access tokens, MFA secrets, NVR credentials, or private stream URLs.

### 5. Audit and response
- Record security-relevant actions (successful/failed sign-in where supported, role changes, permission changes, CCTV configuration changes, and emergency disable actions) without storing secrets.
- Alert administrators to unusual sign-in activity using trusted server-side signals.
- Maintain a tested recovery path and an emergency procedure that does not disable NVR recording.

## Safe rollout sequence
1. Review Supabase Auth settings and current RLS policies without changing production behavior.
2. Enroll and test MFA on one administrator account, including recovery.
3. Add an MFA verification experience to Admin V2 if needed.
4. Enforce AAL2 for sensitive admin actions only after enrollment is complete.
5. Configure CAPTCHA/rate limits and verify sign-in and password recovery.
6. Test admin, staff, and unauthenticated access against RLS; confirm normal CCTV recording remains uninterrupted.

## Acceptance checklist
- [ ] Admin sign-in still works over HTTPS.
- [ ] MFA enrollment, verification, and recovery work for an administrator.
- [ ] Sensitive operations reject sessions that do not meet the required assurance level once enforcement is enabled.
- [ ] Staff cannot gain admin access by changing browser-side state or calling Supabase directly.
- [ ] RLS prevents unauthorized reads and writes even when requests bypass the UI.
- [ ] Auth abuse protections are configured in Supabase, not only in JavaScript.
- [ ] No service-role key, NVR password, RTSP URL, or MFA secret appears in frontend assets or logs.
- [ ] Security changes do not interrupt NVR recording or existing attendance flows.

## Important deployment note
Do not enable MFA enforcement or alter production RLS policies solely by merging this planning document. First inspect the live Supabase project configuration and test the complete recovery path.
