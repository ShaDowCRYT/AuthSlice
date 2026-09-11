# Evidence

This directory holds screenshots, curl outputs, and other evidence captured incrementally during development. Evidence is referenced from DOCUMENTATION.md Section 7.

## Captured Evidence

| File | What it proves | PRD requirement |
|------|---------------|----------------|
| `signup-curl.txt` | Direct signup bypassing the browser returns `{"success":true}` | Idempotent signup; server-side validation on input |
| `users-table-hash.txt` | bcrypt hash stored in DB; no plaintext password visible | Password hashing with adaptive algorithm |
| `verification-code-expiry.txt` | Fresh code (expiresAt in future) → same row after expiry → server rejects with "Invalid or expired code." | Verification codes that expire in the DB, not only in the UI |
| `rate-limit-signin.txt` | 5× 400 → 6th returns **429 + `retry-after: 899`** header | Rate limiting with correct HTTP status and retry indication |
| `e2e-happy-path.txt` | signup → verify (session cookie: HttpOnly, SameSite=lax) → dashboard shows "Welcome, E2E User" | Full new-user journey; session cookie correctly configured |
| `signin-and-route-guard.txt` | Returning user signs in → dashboard with greeting; unauthenticated `GET /dashboard` → 307 to `/signin` | Returning-user flow; protected route handling |