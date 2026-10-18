# AGENTS.md — Coding Agent Instructions

## Project Rule
Work only in the existing College Training and Placement Management System. Do not scaffold a replacement project or change architecture without approval.

## Before Every Task
1. Read this file and relevant project documentation.
2. Run `git status --short`.
3. Inspect relevant code, tests, routes, models, and middleware.
4. Identify the smallest safe change.
5. Preserve all user changes, including untracked files.
6. Audit existing functionality before adding a feature.

## Implementation Rules
- Follow current naming, module, error-handling, and test conventions.
- Reuse existing middleware, services, UI components, and dependencies.
- Do not create duplicate APIs or business rules.
- Keep business logic in reusable services where appropriate.
- Validate all untrusted input on the server.
- Derive user identity and roles from verified authentication.
- Never trust client-supplied ownership or role fields.
- Do not invent data fields, AI capabilities, metrics, or integrations.
- Keep secrets and `.env` files out of commits.
- Do not weaken security to make tests pass.

## Regression Protection
Preserve existing authentication, Google OAuth, email verification, student profiles, company CRUD, drives, applications, eligibility checks, recommendations, interviews, announcements, notifications, and analytics.

## Testing
Run relevant focused tests first, then the full backend suite, frontend build, frontend lint, and `git diff --check` where available. Investigate failures instead of skipping tests or assuming they are environmental.

## Git Rules
- Never commit, push, reset, rebase, or discard user changes unless explicitly authorized.
- Report exact files changed and the validation results.
- Do not claim a command passed unless it was actually run and its exit status verified.

## Final Response
Include:
1. What changed
2. Files changed
3. Security considerations
4. Tests and exact results
5. Manual verification
6. Known limitations
7. Git status
