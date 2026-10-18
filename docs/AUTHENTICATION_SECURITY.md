# Authentication and Security

## 1. Core Principles
- Authentication establishes identity; authorization decides what that identity may do.
- Frontend route guards improve UX but do not replace backend authorization.
- Every sensitive endpoint must enforce access control server-side.
- Client-supplied IDs, roles, and ownership values are untrusted.

## 2. Authentication
Document the actual implementation:
- Token/session type and expiry
- Token storage and transport
- Refresh/logout behavior, if supported
- Password hashing algorithm and configuration
- Google OAuth flow and callback URLs
- Email verification and resend limits

Do not document secrets or live tokens.

## 3. Authorization Matrix
Maintain an accurate matrix from the current route middleware.

| Capability | Student | Company | TPO/Admin |
|---|---:|---:|---:|
| Manage own profile | Yes, within policy | Company profile only | Administrative access as explicitly implemented |
| Apply to eligible drives | Yes | No | Only if a specific administrative workflow exists |
| Manage company drives | No | Authorized company only | As implemented |
| View own applications/interviews | Yes | No | Oversight only where authorized |
| Review applications | No | Authorized company/drive scope | As implemented |
| Publish announcements | No | No | Authorized TPO/Admin |
| Institution-wide analytics | No | No | Authorized TPO/Admin |

Verify each cell against actual middleware and controller logic before treating this table as authoritative.

## 4. Input and Output Safety
- Validate IDs, dates, enums, pagination, and request bodies.
- Use Mongoose query patterns safely; avoid allowing user input to become arbitrary query operators.
- Minimize response fields and prevent mass assignment.
- Escape untrusted content where rendered as HTML.
- Avoid stack traces and internal details in production responses.

## 5. Secrets and Configuration
- Keep `.env` out of Git.
- Use separate secrets per environment.
- Rotate exposed credentials.
- Limit OAuth scopes and external-service permissions.
- Avoid logging authorization headers, verification tokens, or passwords.

## 6. Abuse Prevention
Review existing protections for:
- Login and verification rate limits
- Brute-force attempts
- Request size limits
- CORS allowlist
- Security headers
- Email resend abuse
- Duplicate application submission
- Pagination and expensive aggregate query limits

## 7. Security Testing
Test unauthenticated requests, wrong roles, wrong ownership, invalid inputs, data leakage, expired credentials, and abuse boundaries. Never weaken a test to conceal a security regression.
