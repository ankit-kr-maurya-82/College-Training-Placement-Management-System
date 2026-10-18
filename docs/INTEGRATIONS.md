# Integrations

## 1. Known / Reported Integration Areas
- Google OAuth login
- SMTP email through Nodemailer
- MongoDB
- Any additional services discovered in the current repository

Treat this as a starting inventory and verify the actual code and environment configuration.

## 2. Integration Register
For each integration document:
- Provider and purpose
- Owner
- Environments used
- Required configuration keys (names only, never values)
- OAuth scopes/permissions
- Timeout and retry behavior
- Rate limits
- Data shared
- Failure handling
- Monitoring and tests
- Credential rotation process

## 3. Google OAuth
- Keep authorized origins and redirect URIs aligned with actual frontend/backend configuration.
- Validate provider tokens server-side.
- Match accounts safely and avoid unsafe account linking.
- Do not expose client secrets in frontend variables.
- Test login failure, cancelled consent, invalid tokens, and existing-account behavior.

## 4. SMTP / Email
- Verify configuration without sending a real email when possible.
- Do not send real emails in automated tests.
- Handle provider failure without falsely reporting delivery.
- Distinguish queued, attempted, accepted, delivered, bounced, and failed only when the provider and persisted data genuinely support those states.
- Rate-limit verification and resend endpoints.

## 5. MongoDB
- Use environment-specific URIs and least-privilege database credentials.
- Avoid logging the connection string.
- Set connection timeouts and handle disconnects.
- Use a separate test database/fixture.

## 6. Adding a New Integration
1. Document use case and data flow.
2. Review privacy, security, cost, and terms.
3. Create a minimal adapter/service.
4. Store secrets securely.
5. Add timeout, retry, and failure handling.
6. Add mocked tests.
7. Add a manual verification checklist.
8. Document how to disable the integration safely.
