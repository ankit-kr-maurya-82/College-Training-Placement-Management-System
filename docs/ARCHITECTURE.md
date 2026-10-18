# System Architecture

## 1. Current Architecture (Known Context)
- **Frontend:** React with Vite, in `fronted/`.
- **Backend:** Node.js and Express.js, in `backend/`.
- **Database:** MongoDB accessed through Mongoose.
- **Authentication:** Existing token-based authentication and Google OAuth integration have been reported; confirm current implementation in source.
- **Email:** Nodemailer/SMTP workflow has been used; confirm current configuration and delivery tracking.
- **Testing:** Node test runner and project-specific test utilities have been used.

## 2. Logical Components
```text
Browser
  |
  v
React/Vite frontend
  |
  v
Express API
  |-- Authentication and authorization middleware
  |-- Route modules
  |-- Controllers
  |-- Services / business rules
  |-- Mongoose models
  |
  v
MongoDB
  |
  +--> External services where configured (Google OAuth, SMTP)
```

## 3. Backend Layer Responsibilities
- **Routes:** URL mapping and middleware composition.
- **Middleware:** Authentication, role authorization, validation, rate limiting, and common request handling.
- **Controllers:** HTTP input/output and status codes.
- **Services:** Reusable business logic, eligibility rules, recommendation calculations, and analytics.
- **Models:** Schema validation, indexes, and persistence.

## 4. Frontend Responsibilities
- Route and page composition.
- Role-aware navigation (UI visibility is not a security boundary).
- API calls and request-state handling.
- Form validation for usability; backend validation remains authoritative.
- Reusable components for tables, cards, filters, and messages.

## 5. Security Boundaries
- Every protected API verifies identity server-side.
- Authorization is checked for each sensitive operation.
- Never trust client-provided roles, ownership fields, or student IDs.
- Secrets remain in environment variables and must not be committed.
- Aggregate reports should omit direct identifiers unless explicitly required and authorized.

## 6. Data Flow
1. Frontend sends an HTTP request.
2. Authentication middleware verifies credentials.
3. Role middleware authorizes the action.
4. Controller validates and normalizes inputs.
5. Service applies business rules and queries models.
6. Controller returns a minimal response.
7. Frontend renders success, empty, or error state.

## 7. Architectural Decisions
- Reuse the existing application structure.
- Avoid adding dependencies without a clear benefit.
- Prefer shared service functions for business rules.
- Use pagination for large collections.
- Keep external-service failures from corrupting core workflows.

## 8. Verify Before Editing
This document is a baseline, not a substitute for repository inspection. Confirm actual mount paths, middleware, route names, and deployment setup from the current code.
