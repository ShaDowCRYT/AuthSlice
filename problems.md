# Problems Log

This file is maintained continuously as issues arise during development — not reconstructed after the fact. Each entry records the symptom, what was investigated (including dead ends), the actual cause, and the fix applied. This becomes Section 6 of DOCUMENTATION.md.

---

<!-- Entries will be added here as problems occur during development. -->

### 1. Missing Dependencies and Scaffolding Incompleteness
- **Symptom**: Running `npx tsc --noEmit` and `npm run lint` failed with errors (e.g., `'eslint' is not recognized`).
- **Investigated**: Checked `node_modules` and found that `npm install` had not been fully completed after the scaffolding files were created.
- **Cause**: Scaffolding process was interrupted before dependency installation.
- **Fix**: Ran `npm install` manually to install all packages defined in `package.json`.

### 2. TypeScript Error in `app/layout.tsx`
- **Symptom**: `tsc` build failed with `app/layout.tsx(20,50): error TS2304: Cannot find name 'LayoutProps'.`
- **Investigated**: Looked at `layout.tsx` to see `export default function RootLayout({ children }: LayoutProps<"/">)`. Wait, `LayoutProps` is not a globally available Next.js type unless specifically imported or generated, and was failing compilation.
- **Cause**: Generated scaffolding used a non-existent `LayoutProps` type without import.
- **Fix**: Replaced `LayoutProps<"/">` with standard React typing: `Readonly<{ children: React.ReactNode }>`.

### 3. Next.js 16.3.4 Middleware Deprecation Warning
- **Symptom**: `npx next build` throws a warning: `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`
- **Investigated**: Checked if we should run the suggested codemod.
- **Cause**: Next.js 16.3.4 (the current locked version) deprecates `middleware.ts`.
- **Fix**: Left as-is to strictly adhere to the `AGENTS.md` locked file structure which requires `middleware.ts`. Will ignore the warning.

### 4. PrismaClient Type Missing
- **Symptom**: IDE reported an error in `lib/prisma.ts`: `Module '"@prisma/client"' has no exported member 'PrismaClient'.`
- **Investigated**: Checked if `npm install` triggered `prisma generate` correctly. Sometimes the postinstall script doesn't execute or misses generating the exact types if the node environment is fresh.
- **Cause**: The Prisma client was not generated locally, so the type definition for `PrismaClient` was missing in `node_modules/@prisma/client`.
- **Fix**: Ran `npx prisma generate` manually to generate the client from `schema.prisma`.

### 5. Placeholder DB Credentials Block Prisma Migration
- **Symptom**: `npx prisma migrate dev --name init` failed with `P1000: Authentication failed against database server, the provided database credentials for 'user' are not valid`.
- **Investigated**: Confirmed `.env` exists and is gitignored; the values are placeholders from `.env.example`.
- **Cause**: The human has not yet supplied a real `DATABASE_URL` (agent is forbidden from writing real secrets).
- **Fix**: None applied yet — blocked until the human adds real credentials. Feature code that doesn't touch the DB still works.

### 6. PRD Requires a User Name But Locked Schema Has None
- **Symptom**: `signupSchema` and the signup form included a `name` field, but the locked `User` model has no `name` column — `prisma.user.create({ data: { name, ... } })` failed type-checking.
- **Investigated**: Re-read `PRD.md` "Data Model (Locked)" — no `name` field exists. The dashboard requirement says "signed-in user's name" but per PRD rules a missing field must be flagged, not silently added.
- **Cause**: Schema in the PRD simply has no name column; "user's name" is ambiguous.
- **Fix**: Flagged to the human, who chose to use the user's **email** as the dashboard display name. Removed `name` from `signupSchema` and the signup UI. (Chosen against adding a `name` column, which would require flagging a schema change.)

### 7. useSearchParams() Requires a Suspense Boundary in Next.js 16
- **Symptom**: `next build` failed with `useSearchParams() should be wrapped in a suspense boundary at page "/reset-password"` during static prerendering.
- **Investigated**: Reset-password page reads `token` from the query string via `useSearchParams()` directly in the page component.
- **Cause**: Next.js requires client components using `useSearchParams()` to be wrapped in `<Suspense>` so the shell can prerender while the hooks resolve.
- **Fix**: Extracted `ResetPasswordForm` (the component using `useSearchParams`) and wrapped it in `<Suspense fallback={...}>`.

### 8. useActionState State Types Mismatched Between Pages and Server Actions
- **Symptom**: `tsc` errors: the action passed to `useActionState` declared its own narrower state type than the hook's inferred state, and server action `prevState` params were narrower than the page's `{ error } | { success: true } | null` state.
- **Investigated**: `useActionState` in React 19 infers state from the return type of the action. Pages passed a `prev` type like `{ error: string } | null` while returning `{ error } | { success } | null`, so the union didn't match.
- **Cause**: The `prevState` parameter type in the page wrapper and the server action didn't include the union members the hook could actually hand back.
- **Fix**: Standardized every page action wrapper and every server action `_prevState` to the full union: `{ error: string } | { success: true } | null`.

### 9. Invalid Dummy bcrypt Hash in Signin Timing Check
- **Symptom**: Noticed at review: the "user not found" branch ran `bcrypt.compare(password, "$2b$12$abcdefghijklmnopqrstuv0123456789abcdefghijkl")`, but bcrypt hashes must be exactly 60 chars (22-char salt + 31-char hash). The dummy string was only 51 chars and would throw inside `bcrypt.compare`.
- **Investigated**: Generated a real 60-char bcrypt hash locally with `node -e "bcrypt.hash(...)"`.
- **Cause**: Hand-typed placeholder did not match bcrypt's fixed output length.
- **Fix**: Replaced the dummy string with a valid precomputed hash: `$2b$12$FDJ2LsvWgjpMxCxr8FkmT.4zPOUYpbODZ0JUWG3e3qWrxpNFFSode`.

### 10. Raw Prisma Error Leaks to Client During Runtime
- **Symptom**: Submitting `/signin` with the placeholder DB credentials produced a `500` and the raw `PrismaClientInitializationError` stack trace ("Authentication failed against database server...") appeared in the browser console — not a clean, expected error response.
- **Investigated**: Traced through `lib/auth/signin.ts`. The `prisma.user.findUnique` call was not wrapped in a try/catch, so the DB failure propagated straight back to the client as a server action rejection.
- **Cause**: Only `signup.ts`'s user creation had error handling (for the P2002 idempotency case); the other DB operations in `signin.ts`, `verify.ts`, and `reset.ts` were unwrapped.
- **Fix**: Wrapped every DB-touching operation in all four auth server actions (`signup`, `signin`, `verifyEmail`, `resendCode`, `requestPasswordReset`, `resetPassword`) in try/catch that returns the generic message "Something went wrong. Please try again." — a raw database exception can never reach the client. (Note: the root trigger was placeholder credentials in `.env`; that still requires the human to supply a real `DATABASE_URL`.)

### 11. Prisma Migration Timed Out Acquiring Advisory Lock
- **Symptom**: First `npx prisma migrate dev` after fixing credentials failed with `P1002: The database server was reached but timed out... Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(...))`.
- **Investigated**: Postgres runs in a Docker container (`authslice-postgres`, postgres:16-alpine) on port 5433. Credentials validated fine; the lock wait itself timed out.
- **Cause**: Transient — the advisory lock wait hit its 10s timeout (Docker + freshly started container).
- **Fix**: Simply re-ran `npx prisma migrate dev`; the migration applied on the second attempt (`20260910144753_init`).

### 12. Windows EPERM Renaming Prisma Query Engine DLL
- **Symptom**: `prisma generate` failed after a successful migration: `EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp' -> '...query_engine-windows.dll.node'`.
- **Investigated**: Enumerated node processes via `Get-CimInstance Win32_Process` — the running `next dev` server (`npm run dev`, `next dev`, start-server, and two turbopack workers) held the DLL open in memory.
- **Cause**: Windows cannot rename an open file; the running dev server blocked the client binary swap.
- **Fix**: Stopped the `next dev` server, re-ran `npx prisma generate` — succeeded. (Left unrelated `chrome-devtools-mcp` processes untouched.)
