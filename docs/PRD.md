# PRD — Assessment 1: The Authentication Slice

## Overview

A complete authentication system with its own interface, ending at a placeholder dashboard. This is a single slice — not an application. Nothing exists in this repository outside of what's listed below.

**Stack:** Next.js / TypeScript / Prisma / PostgreSQL
**Time budget:** 14–18 hours
**Deadline:** Wednesday, 17 September 2026

## Screens (exactly these, nothing more)

1. Create account
2. Sign in
3. Forgot password (request form)
4. Reset password (reached via emailed link)
5. Email verification (code entry + resend control)
6. Placeholder dashboard — signed-in user's name + sign-out button. Nothing else.

## User Behaviour (acceptance criteria)

- [ ] A new user can create an account, verify their email, and reach the dashboard
- [ ] A returning user can sign in
- [ ] A user who forgets their password can reset it and sign in with the new one
- [ ] A signed-out user who types the dashboard URL directly is sent to sign in
- [ ] Sign out ends the session properly (not just clears the cookie client-side)

## Explicitly Out of Scope — do not build

- No landing page
- No marketing page
- No dashboard features beyond name + sign-out button
- No profile editing
- No settings
- No social sign-in
- No two-factor authentication

## Engineering Requirements (all must be present and documented)

1. Password hashing — adaptive algorithm (bcrypt), not a general-purpose hash
2. Server-side validation on every input, declared as a schema — client-side validation mirrors it
3. Rate limiting on: signin, signup, password-reset-request, verification-code-resend
4. Session management with correctly configured session cookie
5. Email verification codes that expire in the database, not only in the UI
6. A resend cooldown enforced server-side
7. Password reset tokens: single-use and time-limited
8. Unique constraint on email at the database level
9. Idempotent signup endpoint — a double submission creates one account
10. Protected route handling — dashboard unreachable without a valid session
11. Input groups with labels programmatically bound to inputs, and visible focus states

## Data Model (Locked)

This is the schema. Do not add, remove, or rename tables or fields, and do not change a constraint, without flagging it first — this shape is fixed by the engineering requirements above and by `rules/security.md`.

```prisma
model User {
  id             String    @id @default(cuid())
  email          String    @unique
  passwordHash   String
  emailVerified  Boolean   @default(false)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  verificationCodes    VerificationCode[]
  passwordResetTokens  PasswordResetToken[]
  sessions             Session[]

  @@map("users")
}

model VerificationCode {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  code      String
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@map("verification_codes")
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId])
  @@map("password_reset_tokens")
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@map("sessions")
}
```

**Why each locked constraint is what it is** (for reference — this reasoning belongs in Section 4 and Section 5 of the final documentation, not just here):

- `User.email @unique` — the database-level backstop for idempotent signup; makes a duplicate account impossible even under a race condition, not just checked-then-inserted in application code.
- `onDelete: Cascade` on every foreign key — a deleted user can never leave an orphaned session, code, or token behind.
- `expiresAt` as a real `DateTime` column on both `VerificationCode` and `PasswordResetToken` — must be checked inside the query (`WHERE expiresAt > now()`), never only in application logic or the frontend countdown.
- `PasswordResetToken.token @unique` + `used Boolean` together — makes token replay structurally impossible, not just discouraged.
- `Session` is a real table, not a JWT — required for instant revocation on sign-out per `rules/security.md`.

The agent implements types, indexes beyond what's shown, and migration details against this shape — it does not redesign the shape itself. If a requirement seems to need a field or table not listed here, stop and flag it before adding one.

## Concepts to Document (Section 5 of DOCUMENTATION.md)

- Password hashing
- Rate limiting
- Client-side vs server-side validation
- Session management (and why sessions vs tokens)
- Token/code expiry, and why expiry must live in the database
- Idempotency
- Database constraints as a last line of defence
- Protected routes

## Required Evidence (for DOCUMENTATION.md)

- Screenshot of `users` table showing a stored hash — no plaintext password visible
- The exact curl command hitting the signup endpoint directly, bypassing the browser, and the server's response
- Evidence of a rate limit triggering, including the status code returned
- Screenshot of a verification code in the database, and the same record after expiry

## Grading Bands (self-check before submission)

**Pass:** all screens work, all 11 engineering requirements present, documentation complete with all 8 sections.

**Excellent:** validation rules declared once and shared client/server; curl evidence shows the server rejecting what the browser would have blocked; every Section 5 concept answers the "what I chose against" question properly; rate limit returns correct status code with a retry indication.

## Known Traps (avoid these)

- Validating only on the client and calling that validation
- Building out the dashboard instead of the authentication
- Verification codes with no server-side expiry (UI countdown as theatre)
- Committing `.env`
- Rate limiting signin but forgetting resend (the one with a real cost per request)
