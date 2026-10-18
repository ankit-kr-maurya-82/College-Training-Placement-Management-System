# API Reference

## 1. General Conventions
- Base URL: configure per environment; do not hard-code production URLs in source.
- Content type: JSON unless an endpoint explicitly supports another format.
- Authentication: use the existing project mechanism.
- Error format and status codes: follow the current API middleware and controllers.

## 2. Endpoint Inventory
Maintain this table from the actual route files; paths below are feature areas, not guaranteed literal routes.

| Feature | Typical operations | Authorization to verify |
|---|---|---|
| Authentication | Sign-in, registration, verification, OAuth | Public/authenticated as defined by route |
| Student profile | Read/update own profile | Authenticated student |
| Companies | Company CRUD and company profile | Role and ownership checks |
| Job drives | Create/list/update drives | Company/TPO permissions as implemented |
| Applications | Submit, list, update status | Student/company/TPO permissions |
| Recommendations | Get recommended drives | Authenticated student |
| Interviews | Schedule and view interviews | Company/student/TPO permissions |
| Announcements | Draft, publish, list, delete | TPO/Admin and active students |
| Analytics | Placement and skill aggregates | TPO/Admin |
| Notifications | List, read, unread count | Authenticated recipient |

## 3. API Documentation Template
For each endpoint document:
- Method and exact path
- Purpose
- Authentication requirement
- Required role/ownership rule
- Query parameters
- Request body schema
- Response example
- Error status codes
- Pagination behavior
- Rate limits
- Side effects and notifications
- Relevant tests

## 4. Validation Rules
- Reject invalid IDs and malformed JSON.
- Validate enums against backend-defined values.
- Validate pagination bounds.
- Validate date formats and reject reversed ranges.
- Never accept a role or owner ID from the request body as authoritative.
- Avoid leaking internal stack traces in production responses.

## 5. Example Error Contract
Use only if consistent with the existing implementation; otherwise document the actual contract.

```json
{
  "message": "Validation failed"
}
```

## 6. API Change Checklist
- [ ] Route registered and mounted
- [ ] Authentication middleware applied
- [ ] Authorization verified
- [ ] Input validation added
- [ ] Response minimized
- [ ] Unit/integration tests added
- [ ] Frontend API client updated
- [ ] API documentation updated
