# Git Rules — Assessment 1

## Commit granularity

- One commit per logical unit of work — a single route, a single handler, a single schema change, a single fix. Not one commit per file, not one commit for a whole feature area at once.
- The scaffolding step ends with its own commit before any feature logic begins.
- Never batch multiple unrelated changes (e.g. a bug fix and a new screen) into one commit.
- Target: by submission, the commit log should read as a story of how the slice was built, step by step — a reviewer should be able to reconstruct the build order from `git log` alone.

## Commit messages

- Present tense, imperative mood: "Add signup schema validation," not "Added" or "Adds."
- One line summarizing what changed, specific enough to be useful without opening the diff — "Add rate limiting to signin route," not "Update auth."
- If a commit is a fix for something logged in `problems.md`, reference it: "Fix verification code expiry not checked server-side (see problems.md)."

## Before every commit

- Run `git diff --staged` and actually read it before committing — don't commit blind.
- Confirm no real secret, API key, or `.env` file is staged. If `.env` ever appears in `git status`, stop and flag it immediately rather than proceeding — do not commit past it.
- Confirm `.gitignore` includes `.env`, `.env.local`, `node_modules`, and any local Prisma dev artifacts.

## What must never happen

- Never commit `.env` or any file containing a real secret, even once, even if removed in a later commit — git history retains it. If a secret is ever accidentally committed, stop and report it rather than quietly force-pushing over it.
- Never use `git commit --amend` or force-push to rewrite history that's already been shared or reviewed — the incremental history itself is graded evidence and must stay intact.
- Never leave uncommitted work at a stopping point in a session — commit or explicitly flag why not before ending a task.

## Branching

- Work directly on `main` for this slice — a single small repo with one contributor doesn't need a branching strategy. Keep it simple.

## Before final submission

- Confirm, by opening the repository in a private/incognito browser window (not by checking local memory of what was committed), that no `.env` or secret is visible anywhere in the repo or its history.
