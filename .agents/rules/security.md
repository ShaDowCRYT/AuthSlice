---
trigger: always_on
---

# Security Rules — Assessment 1

These are enforceable, not aspirational. Every rule below maps directly to a graded engineering requirement.

## Passwords

- Passwords are hashed with bcrypt, cost factor 12, before ever touching the database.
- The plaintext password must never be logged, stored, or included in any error message.
- Password comparison always happens via `bcrypt.compare()` — never manual string comparison.

## Sessions

- Sessions are stored server-side in a `sessions` table (id, user_id, expires_at). Do not use JWTs for this slice — instant revocation on sign-out is a stated requirement, which JWTs don't give you without extra infrastructure.
- The session cookie contains only the session ID. Nothing else goes in the cookie.
- Cookie flags: `httpOnly: true`, `sameSite: 'lax'`, `secure: true` in production (conditionally `false` only in local dev over HTTP).
- Sign-out must delete the session row server-side, not just clear the cookie client-side.

## Rate Limiting

- Every one of these routes must be rate-limited, independently: `/api/auth/signin`, `/api/auth/signup`, `/api/auth/forgot-password`, `/api/auth/resend-code`.
- The resend-code route gets the tightest limit — it has a direct cost per request (email sending).
- A rate-limited request returns HTTP 429 with a retry indication (e.g. `Retry-After` header).
- **Implementation: in-memory `Map`, held at true module scope in a single shared instance in `lib/rate-limit.ts`** — not re-instantiated per import, so it survives Next.js dev-mode hot reloads. No Redis in this stack; a Postgres-backed table was considered and rejected as unnecessary complexity for a single-server dev/assessment scope. Document this tradeoff in Section 5 of `DOCUMENTATION.md`.

## Email (dev environment)

- Use Ethereal (`nodemailer.createTestAccount()`) for local development and for gathering evidence — no real SMTP account needed, and every send generates a preview URL usable as evidence for the verification/reset email flow.
- Do not use Gmail SMTP for this project. Past experience with Gmail SMTP auth configuration was a recurring source of friction; Ethereal avoids that entirely for a dev/assessment context.

## Expiry

- `verification_codes.expires_at` and `password_reset_tokens.expires_at` must be checked inside the database query itself (`WHERE expires_at > now()`), never only in application logic after the fact, and never only in the frontend.
- An expired code or token must fail the same way as an invalid one — do not leak which reason caused the failure.

## Idempotency

- `users.email` has a unique constraint at the database (schema) level — not only checked in application code before insert.
- The signup handler must catch the unique-constraint violation and return a clean, expected error — never let a raw database exception reach the client.

## Protected Routes

- All access control for `/dashboard` is enforced in `middleware.ts`, centrally — not duplicated per-page.
- An expired or missing session redirects to `/signin`. No protected data is rendered before this check completes.

## Never do this

- Never trust a client-supplied flag (e.g. `isVerified: true` in a request body) for anything security-relevant.
- Never return different error messages for "email not found" vs "wrong password" on sign-in — this leaks which emails have accounts.
- Never commit `.env`. Only `.env.example` with placeholders is committed.