# Testing and Quality Assurance

## 1. Quality Goals
- Verify business rules and permissions.
- Prevent regressions in existing placement workflows.
- Make test results reproducible.
- Separate product defects from verified environment limitations.

## 2. Test Levels
### Unit tests
Validate pure functions and service logic such as eligibility, recommendation scoring, skill matching, and metric calculations.

### API/integration tests
Validate route registration, middleware, authorization, request validation, persistence behavior, and response contracts.

### Frontend checks
Run lint and production build. Add component tests if the project already has an appropriate framework.

### Manual end-to-end checks
Verify critical flows using dedicated test accounts and a non-production database.

## 3. Baseline Commands
Run from the project root, adjusting only if package scripts differ:
```bash
cd backend
npm test

cd ../fronted
npm run build
npm run lint

cd ..
git diff --check
git status --short
```

## 4. Critical Regression Scenarios
- Student login and profile updates
- Company login and company CRUD
- Drive publishing and eligibility rules
- Application creation and duplicate protection
- Recommendations
- Interview scheduling and student interview visibility
- TPO/Admin interview oversight
- Announcement draft/publish visibility
- Placement analytics and skill-readiness results
- Google OAuth and email verification
- Notification behavior

## 5. Security Cases
- No token
- Invalid/expired token
- Wrong role
- Wrong resource owner
- Client-supplied identity/role tampering
- Invalid IDs, dates, filters, and pagination
- PII leakage in aggregate endpoints
- Repeated requests and rate-limit boundaries

## 6. Failure Triage
For every failing test:
1. Capture the full error and exit code.
2. Reproduce the specific test.
3. Compare with the last known baseline.
4. Inspect changed files and shared setup.
5. Verify whether a network/socket/database restriction is real.
6. Fix genuine defects; do not skip or weaken tests.
7. Rerun the focused test and full suite.

## 7. QA Report Template
- Commit/branch or working-tree baseline
- Commands run
- Pass/fail counts and exit codes
- Failures with cause and evidence
- Build/lint results
- Manual tests performed
- Known limitations
