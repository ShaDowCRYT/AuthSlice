# Validation & Structure Rules — Assessment 1

## Validation

- Every input has exactly one Zod schema, defined once in `lib/schemas/auth.ts`.
- The client imports and uses the same schema for inline form feedback (e.g. via `safeParse`).
- The API route imports and uses the same schema again server-side before touching the database. Never assume client validation was sufficient.
- Validation errors return field-level messages the frontend can map back to individual inputs.

## Accessibility (the one UI requirement that's graded)

- Every `<input>` has a `<label>` programmatically bound to it via `htmlFor`/`id` (or the input is wrapped by its label).
- Default browser focus outlines are not removed unless replaced with an equally visible custom focus style.
- No design system, no custom component library, no visual branding work. Use plain Tailwind utility classes or a lightweight kit (e.g. shadcn/ui primitives) — speed over polish.

## Scope discipline

- If a task isn't listed in `PRD.md`, don't build it, even if it seems like a natural addition (e.g. "remember me" checkbox, password strength meter beyond minimum length). Flag it instead of adding it silently.
- Keep the dashboard to literally one line of text (the user's name) and a sign-out button. Resist styling it further.

## Environment & secrets

- `.env.example` must list every variable by name with a comment on where its real value comes from — no real values, ever, even placeholder-looking real keys.
- The agent does not write real secrets into `.env` under any circumstance — that's a human-only action.

## Commit hygiene

- Incremental commits as features land — not one large commit at the end. This is checked in the submission checklist.
