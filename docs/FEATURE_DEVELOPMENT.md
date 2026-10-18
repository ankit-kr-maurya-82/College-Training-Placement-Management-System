# Feature Development Workflow

## 1. Start With an Audit
- Check `git status --short`.
- Read the relevant page, API client, route, controller, service, model, and tests.
- Search for existing functionality before adding new code.
- Record the problem and measurable acceptance criteria.

## 2. Write a Small Plan
Specify:
- User story
- Roles and permissions
- API changes
- Data changes
- UI changes
- Tests
- Risks and rollback considerations

## 3. Backend Development
- Validate request bodies and query parameters.
- Use verified identity for user-specific operations.
- Enforce role and ownership checks server-side.
- Keep business rules in services when they are shared.
- Return minimal response fields.
- Use database transactions or atomic operations where required by the actual workflow.

## 4. Frontend Development
- Reuse existing routing, API helpers, and components.
- Keep loading, empty, error, and success states explicit.
- Avoid relying on hidden navigation for authorization.
- Prevent duplicate submissions when appropriate.
- Make tables and forms usable on mobile and keyboard navigation.

## 5. Feature-Specific Tests
Test:
- Valid input
- Missing/invalid input
- Unauthorized access
- Wrong owner or role
- Empty results
- Boundary conditions
- Duplicate requests
- External service failure
- Existing workflows affected by the change

## 6. Review
```bash
git diff --check
git diff
git status --short
```
Check for secrets, accidental generated files, unrelated edits, and changes to lockfiles.

## 7. Handoff
Report changed files, endpoints, permissions, test commands/results, manual checks, and limitations. Never commit or push without explicit authorization.
