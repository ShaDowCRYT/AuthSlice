# DOCUMENTATION.md — Assessment 1: Authentication Slice

## Section 1: What This Is

This is a small, self-contained slice of a larger product: authentication, and nothing else. Someone can create an account, confirm it with a six-digit code sent to their email, sign in, recover a forgotten password through a short three-step flow, and land on a plain dashboard that just says who's signed in and lets them sign out. Every one of the eleven engineering requirements in the brief — password hashing, rate limiting, expiry, idempotency, database constraints, protected routes — is enforced at the point where it actually counts, in the query or the handler, not just in what the interface happens to show.

What's missing is on purpose. There's no landing page, no dashboard beyond a name and a sign-out button, no profile settings, no social login, no two-factor. The only thing added outside the original locked schema is a `fullName` field, and that wasn't scope creep — it was a genuine gap between the brief and the data model, flagged and approved before it was built, and explained in Section 4.

---

## Section 2: How To Run It

### Prerequisites

- Node.js 20+
- PostgreSQL — developed against `postgres:16-alpine` in Docker
- npm

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
# Copy .env.example to .env and fill in real values by hand — the agent
# never writes real secrets into this file.
copy .env.example .env

# 3. Generate the Prisma client
npx prisma generate

# 4. Create the database and apply migrations
npx prisma migrate dev

# 5. Start the dev server
npm run dev
# -> http://localhost:3000
```

### Postgres in Docker

```bash
docker run -d --name authslice-postgres -p 5433:5432 \
  -e POSTGRES_USER=authslice -e POSTGRES_PASSWORD=<your-password> \
  -e POSTGRES_DB=authslice postgres:16-alpine
```

### Environment variables

All variables are listed with comments in `.env.example`. None hold real values there — the human supplies them.

| Variable | Purpose | Source |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Your local/managed Postgres instance |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_FROM` / `SMTP_USER` / `SMTP_PASS` | Real mail server config | Your mail provider (unset → falls back to Ethereal, the locked dev default) |
| `APP_URL` | Public app URL, used as email root | You |
| `NODE_ENV` | `development` locally | You |

### Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.3.4 (App Router, Turbopack) + React 19 |
| Language | TypeScript |
| Database | PostgreSQL via Prisma 6 |
| Password hashing | bcrypt (cost factor 12) |
| Validation | Zod — one shared schema per form |
| Email | Nodemailer (Ethereal by default; real SMTP via `.env` override) |

---

## Section 3: The Flow, Step By Step

**Sign up.** The user fills in email and password on `/signup`. The form validates against the shared `signupSchema` client-side (`lib/schemas/auth.ts`) for instant feedback, then submits to `POST /api/auth/signup`. The route re-runs the identical schema server-side, checks the signup rate-limit bucket (5 per 15 minutes) via `enforceRateLimit()` in `app/api/auth/_shared.ts`, and hands off to `lib/auth/signup.ts`'s `createAccount` service. That service hashes the password with bcrypt at cost 12 (`lib/auth/password.ts`) and creates the `User` row alongside a `VerificationCode` row in one transaction. The unique constraint on `User.email` is what actually makes a double-submitted signup resolve as one account: a second insert fails on the constraint (`P2002`), and the handler treats that failure as success — "check your email" — rather than surfacing an error, which is what makes signup idempotent rather than merely deduplicated after the fact. Nodemailer (`lib/email.ts`) sends the six-digit code, and the signup page advances inline to its verify step.

**Verify email.** The user enters the six-digit code (inline on `/signup`, or on the standalone `/verify` page for a returning unverified user). `POST /api/auth/verify` calls `verifyEmail` in `lib/auth/verify.ts`, which looks up a matching `VerificationCode` row for that user with the check written directly into the Prisma query — `expiresAt: { gt: new Date() }` — not checked afterward in application code. A match sets `User.emailVerified = true` and creates a session in the same flow, landing the user on the dashboard. A "resend" control posts to `POST /api/auth/resend-code`, which carries its own tighter rate-limit bucket (3 per 5 minutes — the tightest of any route, since it has a direct cost per request) plus a client-side cooldown countdown (`lib/use-cooldown.ts`) for UX.

**Sign in.** `POST /api/auth/signin` validates against `signinSchema`, checks the signin rate-limit bucket (5 per 15 minutes), and calls `signIn` in `lib/auth/signin.ts`. That service looks up the user by email inside a try/catch (no raw database error ever reaches the client), and — whether or not a user was found — always runs a bcrypt comparison: a dummy hash when the user doesn't exist, the real `passwordHash` when they do. This keeps the response time from leaking which emails have accounts. On a genuine match, `lib/auth/session.ts`'s `createSession` inserts a `Session` row and sets an httpOnly, `SameSite=Lax`, `Secure`-in-production cookie containing only that row's ID — nothing else is encoded into it. The user is redirected to `/dashboard`.

**Forgot / verify code / reset password.** This is a three-step flow shared between `/forgot-password` and `/reset-password` via one client component (`reset-flow.tsx`). Step one: the user submits their email to `POST /api/auth/forgot-password` (rate-limited at 2 per 15 minutes), which calls `requestPasswordReset` in `lib/auth/reset.ts` — this creates a `PasswordResetToken` row holding a six-digit code (generated with `crypto.randomBytes` and rejection sampling for a uniform distribution, not `Math.random()`), and emails it. Step two: the user enters that code, which posts to its own dedicated route, `POST /api/auth/verify-reset-code` (its own rate-limit bucket, separate from the final reset), calling `verifyResetCode` — this checks the code against an unexpired, unused `PasswordResetToken` row with both conditions inside the query, the same pattern as email verification. Step three: the user sets a new password, posting to `POST /api/auth/reset-password`, which re-validates the code, updates `User.passwordHash`, and flips `PasswordResetToken.used` to `true` in the same transaction — so the same code can never be replayed even if someone captures it in transit.

**Dashboard access.** Two layers protect `/dashboard`. First, `proxy.ts` (the Next.js 16 replacement for the deprecated `middleware.ts` convention — see Section 6) runs at the edge and checks only for the *presence* of a session cookie against the route matcher `/dashboard/:path*`; a missing cookie 307-redirects to `/signin` before the page ever renders. This layer deliberately cannot do more than that, because the Edge runtime has no Prisma access. Second, `app/dashboard/page.tsx` calls `getSession()` server-side, which verifies the session row actually still exists and hasn't expired (expired rows are deleted outright) before rendering any protected content. The edge check is a fast first gate; the page-level check is the authoritative one.

**Sign out.** A `"use server"` action (`signout`, in `lib/auth/session.ts`) — not an API route, since it needs no validation and carries no rate-limit cost — calls `deleteSession`, which removes the matching `Session` row from the database and clears the cookie. The session is gone server-side the moment the button is pressed, not merely forgotten client-side.

---

## Section 4: The Data Model

The schema is locked by the PRD and by `rules/security.md`. One field was added after an explicit, flagged decision: `User.fullName` (see Section 6). Everything else is exactly the locked shape.

```prisma
model User {
  id            String    @id @default(cuid())
  fullName      String    @default("")
  email         String    @unique
  passwordHash  String
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  verificationCodes   VerificationCode[]
  passwordResetTokens PasswordResetToken[]
  sessions            Session[]

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

**Why each locked constraint is what it is:**

- `User.email @unique` — the database-level backstop for idempotent signup. A duplicate account is impossible even under a race condition, not merely checked-then-inserted in application code.
- `onDelete: Cascade` on every foreign key — deleting a user can never orphan a session, code, or token.
- `expiresAt` as a real `DateTime` column on `VerificationCode` and `PasswordResetToken` — checked inside the query itself, so expiry survives anything application logic or a frontend countdown could mishandle.
- `PasswordResetToken.token @unique` + `used` — a used code is structurally impossible to replay.
- `Session` as a real table, not a JWT — revocation on sign-out is a `DELETE`, immediate and observable, not dependent on a token expiring on its own schedule.

**The one documented deviation:** `User.fullName` was not in the PRD's locked schema, yet the PRD also required the dashboard to show "the signed-in user's name" — an inconsistency in the original spec, not an invented feature. This was flagged per `AGENTS.md`'s instruction to stop and flag rather than silently add fields, and approved before the migration was written. The empty-string default avoids a null dual-state and keeps existing rows migratable.

---

## Section 5: The Concepts

### Password Hashing

**What it is.** Hashing turns a password into a fixed-length string that can't be reversed back into the original. bcrypt specifically is an *adaptive* function — its cost is a tunable parameter, not a fixed property of the algorithm.

**Why it is needed.** A general-purpose hash like SHA-256 is built for speed, which is exactly the wrong property for password storage — an attacker with a stolen hash dump can brute-force it offline at full CPU speed. A slow, tunable hash makes that same attack expensive per guess.

**How I implemented it.** bcrypt at cost factor 12, in `lib/auth/password.ts`. Every comparison goes through `bcrypt.compare()`; the plaintext password is never logged, stored, or reflected in any error. Verified in `evidence/users-table-hash.txt`, which shows only `$2b$12$...` hashes in the database.

**What I chose against, and why.** SHA-256 — it's fast by design, which is the disqualifying property for this use case, not a competing tradeoff.

### Rate Limiting

**What it is.** A cap on how many requests a given identity can make to a route within a time window.

**Why it is needed.** Without it, an attacker can automate unlimited login guesses, or spam the resend-code endpoint to run up real email-sending costs.

**How I implemented it.** Per-IP, in-memory sliding-window counters in `lib/rate-limit.ts`, enforced at the HTTP boundary via `enforceRateLimit()` in each `app/api/auth/*` route. The store is hoisted onto `globalThis` rather than kept at bare module scope, specifically so Next.js dev-mode hot reloads under Turbopack can't silently re-instantiate and wipe the buckets mid-testing (see Section 6). Buckets: signin 5/15min, signup 5/15min, forgot-password 2/15min, resend-code 3/5min (tightest — real cost per request), verify 3/15min, verify-reset-code 5/15min, reset-password 5/15min. Every block returns 429 with a `Retry-After` header — verified in `evidence/rate-limit-signin.txt`.

**What I chose against, and why.** Redis or a Postgres-backed table — both are reasonable at production scale, but add real infrastructure for a single-server dev/assessment scope where in-memory, done correctly, already satisfies every requirement.

### Client-Side vs Server-Side Validation

**What it is.** Client-side validation gives immediate in-browser feedback; server-side validation is the actual gate on data the server receives, regardless of what sent it.

**Why it is needed.** Client-side checks can be bypassed entirely by anyone calling the API directly — they exist for UX, not security.

**How I implemented it.** One Zod schema per form, defined once in `lib/schemas/auth.ts`. The client runs it via `safeParse` for inline feedback; the API route imports the same schema and re-runs it before touching the database. `evidence/signup-curl.txt` demonstrates the server enforcing a rule independent of any browser.

**What I chose against, and why.** Two separate validation implementations, one per side — the drift risk (client and server silently disagreeing over time) outweighs any benefit of writing them apart.

### Session Management

**What it is.** The mechanism that keeps a user recognized as signed in across multiple requests after login.

**Why it is needed.** HTTP is stateless; without a session, every request would require re-authenticating.

**How I implemented it.** Database-backed sessions. `lib/auth/session.ts` inserts a `Session` row and sets a cookie containing only that row's ID — `httpOnly`, `SameSite=Lax`, `Secure` in production, 7-day expiry. Sign-out deletes the row directly.

**What I chose against, and why.** Stateless JWTs — they remain valid until their own expiry regardless of how many times a client-side cookie is cleared, which conflicts directly with the requirement that sign-out end the session immediately and server-side.

### Token/Code Expiry

**What it is.** A hard cutoff, enforced in the database, after which a code or token stops being valid — regardless of what the UI displays.

**Why it is needed.** A countdown shown only in the interface is cosmetic; if the server doesn't independently check the timestamp, waiting out a visible countdown and resubmitting the same code would still succeed.

**How I implemented it.** `expiresAt` as a real column on both `VerificationCode` and `PasswordResetToken`, checked with `expiresAt: { gt: new Date() }` directly inside the Prisma query — not fetched and checked afterward. `evidence/verification-code-expiry.txt` shows the identical database row accepted while fresh and rejected once `expiresAt` has passed, with invalid and expired codes returning the same generic message so neither can be used to enumerate valid accounts.

**What I chose against, and why.** Checking expiry in application code after the row is fetched — that's one future refactor away from silently being skipped, whereas a query-level condition can't be bypassed by a code path that forgot to check.

### Idempotency

**What it is.** A property where repeating the same request produces the same result as making it once.

**Why it is needed.** A network retry or a double-click on submit could otherwise create duplicate accounts.

**How I implemented it.** The database-level `@unique` constraint on `User.email` as the actual guarantee, with the signup handler catching Prisma's `P2002` violation and returning success rather than an error — a double submission creates one account and the user sees the same "check your email" outcome either way.

**What I chose against, and why.** "Check if the email exists, then insert" in application code — this is a race condition: two near-simultaneous requests can both pass the check before either insert completes. The constraint is enforced at the one layer that can't be raced.

### Database Constraints as a Last Line of Defence

**What it is.** Rules enforced by the database itself, which hold even if application code has a bug.

**Why it is needed.** Application-level checks can be skipped by a bug, a race, or a future change that doesn't know a rule exists.

**How I implemented it.** `email @unique` (idempotency), `onDelete: Cascade` on every foreign key (no orphaned sessions/codes/tokens), `PasswordResetToken.token @unique` + `used` (single-use enforcement), `expiresAt` as a real queryable column (expiry).

**What I chose against, and why.** Relying solely on Zod validation and application logic — that only protects requests that go through the API; a constraint protects the data itself, regardless of how it's written.

### Protected Routes

**What it is.** Routes that require a valid session and redirect anyone without one.

**Why it is needed.** Without server-side enforcement, a signed-out user could reach `/dashboard` simply by typing the URL.

**How I implemented it.** Two layers: `proxy.ts` runs at the edge and checks only for cookie *presence* (fast, but Edge has no database access so it can't fully validate); `app/dashboard/page.tsx` calls `getSession()` server-side, which is the authoritative check — it confirms the session row exists and hasn't expired before anything renders. Verified in `evidence/signin-and-route-guard.txt`, which shows a 307 to `/signin` for an unauthenticated request.

**What I chose against, and why.** Edge-only cookie presence as the sole check — the Edge runtime has no database, so it can't know whether a session was revoked; a deleted row could still have a lingering cookie. Trusting a client-supplied flag was also explicitly ruled out by `rules/security.md`.

### Email Transport

**What it is.** The mechanism that sends verification codes and reset codes to the user.

**Why it is needed.** Without a working transport, neither verification nor password reset can function.

**How I implemented it.** A single shared `lib/email.ts`, defaulting to Ethereal's `nodemailer.createTestAccount()` (the locked dev default — every send yields a preview URL usable as evidence). When `SMTP_HOST` is set in `.env`, a real transport is used instead. Timeouts are set deliberately short (8s connect/greeting, 10s socket) so a down mail server fails fast rather than hanging a request.

**What I chose against, and why.** Hardcoding Gmail SMTP as the only option — the security rule locks Ethereal as the default specifically because of prior friction with Gmail SMTP authentication; the override exists as an escape hatch for when Ethereal itself is unreachable on a given network, not as a replacement for the default.

---

## Section 6: What Went Wrong

**Problem 1 — Rate limiting wasn't actually per IP, and the counters kept disappearing.**
Every route called `checkRateLimit` with its own bucket, so nothing looked missing on a first pass. Testing turned up two real defects underneath. Every server action had `const ip = "127.0.0.1"` hardcoded — meaning the "per IP" promise in `rules/security.md` wasn't real at all; every client, on every route, shared one bucket, so five attempts from anyone rate-limited everyone. Separately, the counter store was a plain `Map` at module scope, and under Turbopack's dev-mode hot reload, editing any file in `lib/auth/*` would silently re-instantiate that module and wipe every bucket. The fix was two parts: a real `getClientIp()` reading `x-forwarded-for` → `x-real-ip` → a fallback, swapped in for all six hardcoded IPs, and moving the store onto `globalThis` so it survives being re-evaluated by hot reload. Investigating this also surfaced a bigger issue — the forms were server actions, which can't return an actual HTTP 429 or a `Retry-After` header — which led straight into the next problem.

**Problem 2 — Server actions couldn't produce a real 429, so the forms got rebuilt on actual API routes.**
Both `rules/security.md` and the PRD wanted a 429 status code with a `Retry-After` header as evidence, but the forms were Next.js server actions, which just resolve to a 200 with an in-page error — there's no way to set a real status code or header from inside one. This wasn't a workaround-able gap; server actions genuinely don't expose that layer of the response. The fix was converting every form to post to a real `/api/auth/*` route, moving all rate limiting into a shared `enforceRateLimit()` used by every route, and swapping the pages from `useActionState` to a small `useApiForm` hook. Verified end to end with curl against signin: five 400s, then a 429 with `retry-after: 899` on the sixth. Sign-out stayed a server action, since it needs no validation and has no rate-limit cost.

**Problem 3 — A successful signup was silently turning into a 400 because of an unrelated email timeout.**
Signup was returning a 400 after 8.3 seconds, even though the account and verification code had both already been created successfully in the database. Tracing the timing showed bcrypt hashing took about 0.3 seconds, the database writes were fast, and the remaining 8 seconds was the app waiting on an SMTP server that turned out to be unreachable from this network. One shared `try/catch` around the whole signup function meant that timeout was treated exactly like a database failure — a real success got reported as an error. The fix was splitting it into two separate `try/catch` blocks, one for the database work and one for sending the email, so a slow or unreachable mail server can no longer turn a real signup into a false failure. The user still proceeds to the verify step and can use the existing resend control if the email genuinely never arrived.

**Problem 4 — Next.js quietly deprecated the file the whole session-check layer was built on.**
A build warning appeared saying the `middleware` file convention was deprecated in favor of `proxy`. Checking Next's own migration docs directly (rather than assuming it was a soft warning) confirmed `middleware.ts` is genuinely scheduled for removal in a future version, not just discouraged. The fix was renaming the file to `proxy.ts` and the exported function from `middleware` to `proxy` — same signature, same route matcher, same behavior — then re-verifying the dashboard redirect still worked. This is a case where a filename locked in `AGENTS.md` became impossible to keep; it was flagged rather than silently changed.

*(The full log — 23 entries, including several UX changes made at the human's request and a handful of smaller environment quirks — lives in `problems.md` at the project root.)*

---

## Section 7: What This Slice Does Not Handle

**What breaks at scale:** the in-memory rate limiter is per-process — it doesn't share state across multiple server instances, so a deployment behind a load balancer with more than one Node process would let an attacker get more attempts than intended by hitting different instances. This tradeoff was accepted deliberately (see Section 5) for a single-server dev/assessment scope, not overlooked.

**What I'd need before real users:** monitoring/alerting on failed-login spikes or repeated rate-limit triggers; a way for a signed-in user to see and revoke their own active sessions (currently there's no visibility into or management of sessions beyond the one in the current browser); an account-lockout policy beyond rate limiting for genuinely persistent attackers.

**Left out because it was outside the brief:** account settings, profile editing, two-factor authentication, social sign-in — all explicitly excluded by the PRD's "do not build" list.

**Left out because of time:** device/location metadata on sessions, which would let a user recognize an unfamiliar sign-in; a password-strength meter beyond the minimum-length check in the shared schema.

---

## Section 8: If I Built This Again

The single biggest change would be committing and documenting each deviation the moment it happened, rather than letting real work (the `proxy.ts` rename, an email-provider switch, several UX changes) accumulate as an uncommitted backlog alongside a `problems.md` entry that had gone stale relative to what was actually in the code. The gap between "what the docs say happened" and "what's actually on disk" is exactly the kind of thing a defense interview would catch immediately, and closing it after the fact took more effort than logging accurately as I went would have.







