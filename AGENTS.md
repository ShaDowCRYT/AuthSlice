# AGENTS.md — Assessment 1: Authentication Slice

## What is this project?

A single, narrow slice of an application: authentication only. This is not the start of a larger app, and it never grows into one. The deliverable is one working flow — create account, verify email, sign in, reset a forgotten password, reach a placeholder dashboard, sign out — built properly, with nothing around it. Full scope, screens, and acceptance criteria are in `PRD.md`. Read it before writing any code.

## What is Locked

- **Stack:** Next.js (App Router) + TypeScript, Prisma + PostgreSQL, bcrypt for password hashing, Zod for validation (shared client/server), Nodemailer for verification and reset emails. Do not substitute or add to this stack.
- **Screens:** exactly the six listed in `PRD.md` — create account, sign in, forgot password, reset password, email verification, placeholder dashboard. No others.
- **File structure:** as laid out below. Don't reorganize it.
- **Engineering requirements:** every constraint in `rules/security.md`, `rules/validation-and-structure.md`, and `rules/git.md` is locked — not a suggestion, not something to trade off for convenience.

## What must never happen

- Never build a landing page, a marketing page, any dashboard feature beyond a name and a sign-out button, profile editing, settings, social sign-in, or two-factor authentication. If a task seems to need one of these, stop and flag it — do not build it.
- Never write a real API key, database URL, or secret into any file. The human adds real values to `.env` by hand. The agent may only create and maintain `.env.example` with commented placeholders.
- Never trust a client-supplied claim (e.g. `isVerified: true` in a request body) for anything security-relevant.
- Never let expiry, rate limiting, or uniqueness be enforced only in the frontend or only in application logic — see `rules/security.md` for where each one is required to actually live (the database, in the query itself).
- Never commit `.env`.
- Never skip logging a real problem in `problems.md` because it's embarrassing or looks like a mistake — the wrong turns are required evidence, not something to clean up.

## How is the work arranged?

```
/app
  /(auth)
    /signup
    /signin
    /forgot-password
    /reset-password
    /verify
  /dashboard
/lib
  /auth
    password.ts
    session.ts
    signup.ts
    signin.ts
    verify.ts
    reset.ts
  /schemas
    auth.ts
  rate-limit.ts
/prisma
  schema.prisma
middleware.ts
problems.md
.env.example
DOCUMENTATION.md
```

Maintain `problems.md` at the root continuously, not retroactively. Every time something breaks, gets investigated, and gets fixed, add an entry the moment it happens — symptom, what was checked (including dead ends), actual cause, fix. This becomes Section 6 of the final documentation and needs to stay honest, including the wrong turns.

## How should the code look?

- One shared Zod schema per form, defined once in `lib/schemas/auth.ts`, imported by both the client (inline feedback) and the API route (the actual gate) — never two separate validation implementations.
- Every `<input>` has a `<label>` programmatically bound to it (`htmlFor`/`id`, or wrapped). Default focus outlines stay visible unless replaced by an equally visible custom style.
- No design system, no custom component library, no visual branding work — plain Tailwind utilities or a lightweight primitive kit (e.g. shadcn/ui) is enough. Speed over polish; this is explicitly not graded.
- Sessions are database-backed rows (`sessions` table), not JWTs — instant revocation on sign-out is a requirement JWTs don't satisfy cleanly here.
- Incremental commits as features land, not one commit at the end.

## What counts as done?

A task is not done when it works. It is done when all three are true:

1. It works, per the acceptance criteria in `PRD.md`.
2. It satisfies the relevant rule in `rules/security.md`, `rules/validation-and-structure.md`, or `rules/git.md` — not just "close enough."
3. There's a note (inline comment or `problems.md`) capturing why this approach was chosen over the alternative — this is the raw material for Section 5's "what I chose against" question later, and it's much easier to capture while the reasoning is fresh than to reconstruct afterward.

## What does the agent do when unsure?

- If a task seems to fall outside the six screens or the stated behaviour in `PRD.md`, stop and flag it rather than guessing and building it anyway.
- If there's a genuine choice between two valid technical approaches (e.g. database sessions vs JWTs, Postgres-backed rate limiting vs Redis), state the tradeoff explicitly before implementing, choose the one that best satisfies `PRD.md`'s stated requirements — not the fastest one to write — and record the rejected alternative and reasoning in `problems.md` or inline.
- If a rule in `rules/` seems to conflict with something that would be faster or simpler to build, the rule wins. Flag the tension rather than quietly working around it.
- If genuinely blocked, surface the blocker early rather than working around it silently — the brief itself says to raise blockers "while there is still time to help you, not on the deadline."