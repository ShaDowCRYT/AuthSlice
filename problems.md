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
