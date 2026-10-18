# Database Documentation

## 1. Database Technology
The project has been described as using MongoDB with Mongoose. Confirm the active connection and environment configuration before running database operations.

## 2. Known Domain Entities
Reported entities/features include:
- Student profiles
- Companies
- Job drives
- Applications
- Interviews and interview event history
- Announcements
- Notifications
- Skill/readiness and placement analytics derived from student and drive data

Exact model names, fields, enum values, references, and indexes must be verified from the current model files.

## 3. Relationships (Conceptual)
```text
Student 1 ---- * Applications * ---- 1 Job Drive
Company 1 ---- * Job Drives
Student 1 ---- * Interviews * ---- 1 Job Drive
Company 1 ---- * Interviews
Admin/TPO ---- * Announcements
Student skills <---- compared with ----> Job Drive required skills
```
The diagram is conceptual; use actual schema references to confirm cardinality.

## 4. Data Integrity
- Validate required fields and enums in Mongoose schemas and request handlers.
- Check referenced record existence and authorization before mutation.
- Prevent duplicate applications using the existing business rule and any supporting database constraint.
- Normalize skill comparisons consistently; avoid counting duplicate skills or duplicate student profiles.
- Define behavior for deleted, inactive, or expired records.
- Add indexes only after checking query patterns and existing indexes.

## 5. Sensitive Data
- Do not return passwords, password hashes, verification tokens, OAuth tokens, or secrets.
- Minimize student fields returned to companies and administrative views.
- Prefer aggregate counts for institution-wide reports.
- Do not log authentication secrets or unnecessary personal data.

## 6. Migration and Schema Changes
Before a schema change:
1. Inspect current schema and production data assumptions.
2. Define backward-compatible behavior.
3. Add/adjust indexes carefully.
4. Update model tests and API validation.
5. Document rollout and rollback steps.

## 7. Database Operations
- Never run destructive operations against production without an approved backup and explicit confirmation.
- Use a dedicated test database or in-memory test fixture.
- Keep database URLs out of source control.
- Document backup/restore procedures for the actual deployment environment.

## 8. Schema Inventory Template
For every model, record:
- File path
- Collection name
- Fields and types
- Required fields and defaults
- Enums
- References
- Indexes
- Data sensitivity
- Routes/services that use it
