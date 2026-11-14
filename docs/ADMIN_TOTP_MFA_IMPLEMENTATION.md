# Admin TOTP MFA — staged implementation

- Adds an Admin Security menu for existing admin-authorized accounts only.
- Uses Supabase Auth TOTP enrollment, QR setup, and six-digit verification.
- Requires a Supabase MFA challenge at Admin Panel sign-in after an admin has a verified TOTP factor; also checks restored sessions.
- Does not modify Supabase project-wide settings, database policies, or AAL2 enforcement.
- Does not generate backup codes. Recovery requires the trusted project owner and must be tested before wider enforcement.
- The app-side gate is not a substitute for RLS/AAL2 checks: API requests outside the UI still require database-side protection.
- Accounts without a verified TOTP factor can still sign in so the owner can enroll without lockout.
## Verify after deployment
1. Enroll the primary admin account and scan the QR code.
2. Verify the six-digit code.
3. Sign out, sign in again, and verify the MFA challenge.
4. Test invalid and expired codes.
5. Test recovery before changing AAL1 session limits or adding AAL2 policy enforcement.
