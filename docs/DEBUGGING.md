# Debugging Guide

## 1. General Workflow
1. Reproduce the issue.
2. Record exact command, environment, input, and full error.
3. Check recent Git diff and logs.
4. Narrow to the smallest failing test or request.
5. Identify root cause before editing.
6. Make the smallest safe fix.
7. Add a regression test.
8. Rerun focused tests and the full relevant validation.
9. Report the cause and evidence.

## 2. Backend/API Problems
Check:
- Is the route mounted in the main Express app?
- Is middleware order correct?
- Does authentication populate the expected user field?
- Is the correct role checked?
- Does the controller validate inputs?
- Does the service return the expected shape?
- Are Mongoose query results handled correctly?
- Are errors translated to appropriate status codes?

## 3. MongoDB Problems
For connection/DNS errors:
- Check URI hostname and percent-encoding.
- Verify DNS resolution and network access.
- Check Atlas IP/network allowlist if applicable.
- Verify credentials and database name without printing secrets.
- Check whether the test environment uses a separate database.

For query problems:
- Inspect filter types and casting.
- Confirm references and indexes.
- Check duplicate counting and case normalization.
- Review query execution time and pagination.

## 4. Frontend Problems
Check:
- Browser console and network response.
- Correct API base URL.
- Request headers and token handling.
- Route configuration and role-aware navigation.
- Response shape assumptions.
- Loading/error state cleanup.
- CSS and responsive breakpoints.

## 5. OAuth and Email Problems
- Compare actual callback URL with provider configuration.
- Verify token validation and account mapping.
- Check SMTP host, port, TLS mode, sender configuration, and provider errors.
- Use test/mocked delivery paths; do not send real emails unintentionally.

## 6. Test Environment Restrictions
An error involving sockets, permissions, DNS, or ports is not automatically an environment issue. Capture the full stack trace, reproduce independently where possible, and compare with the same test in a supported local environment. Never classify failures without evidence.

## 7. Useful Git Commands
```bash
git status --short
git diff --check
git diff --stat
git diff
```
Do not use destructive Git commands to make the working tree look clean unless explicitly authorized.
