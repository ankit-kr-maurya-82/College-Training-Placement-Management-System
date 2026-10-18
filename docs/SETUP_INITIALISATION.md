# Setup and Initialisation

## 1. Prerequisites
Confirm supported versions from `package.json`, lockfiles, CI configuration, and deployment files:
- Node.js and npm
- MongoDB local instance or approved hosted database
- Git
- A modern browser

## 2. Clone / Open Existing Repository
Use the existing repository. Do not initialize a new project over it.

```bash
git status --short
git branch --show-current
```

## 3. Install Dependencies
```bash
cd backend
npm install

cd ../fronted
npm install
```
Use `npm ci` instead when the repository lockfile is authoritative and a clean reproducible install is intended.

## 4. Environment Configuration
- Inspect `.env.example`, config modules, and `process.env` references.
- Create local environment files from documented examples.
- Configure database URI, token/session secrets, OAuth credentials, SMTP settings, and frontend API base URL only when required by the actual source.
- Never paste real secrets into issues, logs, or commits.

## 5. Database
- Ensure the database service is reachable.
- Use a dedicated test database for tests that need persistence.
- Verify connection configuration without printing credentials.
- Do not run destructive reset/seed commands against production.

## 6. Start Development Servers
Inspect scripts first:
```bash
cat backend/package.json
cat fronted/package.json
```
Then use the actual `dev` scripts documented there, each in its own terminal.

## 7. Initial Verification
```bash
cd backend
npm test

cd ../fronted
npm run build
npm run lint
```

## 8. Common Setup Failures
- **MongoDB DNS/connection error:** verify hostname, URI encoding, network access, DNS resolution, and database allowlist.
- **Port in use:** identify the process before stopping anything.
- **Missing environment variable:** compare required config reads with local example files.
- **OAuth redirect mismatch:** compare provider console settings with the actual callback URL.
- **SMTP failure:** verify host, port, TLS mode, credentials, and sender policy without sending unintended messages.
