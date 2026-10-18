# Product Requirements Document (PRD)

## 1. Product Overview
**Product:** College Training and Placement Management System  
**Purpose:** Provide a centralized platform for students, companies, and TPO/Admin staff to manage placement preparation, job drives, applications, interviews, announcements, and placement insights.

## 2. Problem Statement
Placement workflows can be fragmented across spreadsheets, emails, and manual coordination. The system aims to centralize these workflows, improve visibility, and reduce repetitive administrative work.

## 3. User Roles
- **Student:** Manage profile, discover relevant drives, apply where eligible, review application/interview progress, view announcements, and review personal readiness information.
- **Company/Recruiter:** Manage company information and job drives, review eligible applications, and coordinate interviews according to existing permissions.
- **TPO/Admin:** Manage placement operations, publish announcements, and review authorized institution-wide analytics and oversight information.

> Confirm exact role names and permissions against the current authentication middleware and route definitions.

## 4. Product Goals
- Keep placement information in one system.
- Support transparent application and interview workflows.
- Enforce eligibility and duplicate-application protections.
- Provide useful, privacy-preserving placement analytics.
- Make student preparation and skill requirements easier to understand.

## 5. Functional Requirements
1. Authentication, authorization, and account verification.
2. Student profile management.
3. Company and job-drive management.
4. Job recommendations based on supported profile and drive data.
5. Application submission and status tracking.
6. Interview scheduling and student interview views.
7. TPO/Admin interview oversight where enabled.
8. Announcements with draft and publish workflows.
9. Placement analytics based on actual stored data.
10. Student readiness and skill-gap analysis based on `skills` and `requiredSkills`, where these fields exist.
11. Email and notification workflows supported by the codebase.

## 6. Non-Functional Requirements
- Secure access control and server-side validation.
- Responsive, accessible UI.
- Predictable error responses.
- Testable service/controller boundaries.
- Efficient database queries and pagination for list endpoints.
- No exposure of secrets or unnecessary student personal data.

## 7. Out of Scope Unless Explicitly Approved
- Predictive AI claims without a trained and evaluated model.
- Package analytics derived from unstructured CTC text without normalization.
- Unverified placement or eligibility metrics.
- Unapproved payment, email, or external-service behavior.

## 8. Success Metrics
Measure only from reliable application data:
- Successful application submissions.
- Interview workflow completion.
- Adoption of announcements.
- Accuracy and latency of analytics endpoints.
- Test coverage of authorization and key workflows.

## 9. Acceptance Criteria
- Role-protected APIs reject unauthorized requests.
- Student identity comes from verified authentication, not a client-supplied ID.
- Existing workflows remain regression-tested.
- Empty, invalid, and error states are handled.
- Build, lint, and tests pass, or remaining failures are documented precisely.

## 10. Open Questions
- Confirm production deployment environment and supported browsers.
- Confirm authoritative role definitions and permission matrix.
- Confirm retention policy for student records and interview history.
- Confirm whether notification delivery status is persisted or only attempted.
