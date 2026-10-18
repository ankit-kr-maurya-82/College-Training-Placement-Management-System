# College Training and Placement Management System

## Overview
A web application intended to support college placement workflows for students, companies/recruiters, and TPO/Admin staff.

## Technology
Known project context:
- React + Vite frontend in `fronted/`
- Node.js + Express backend in `backend/`
- MongoDB + Mongoose
- Existing authentication, job-drive, application, interview, announcement, notification, and analytics functionality

Confirm the current repository before relying on this inventory.

## Main Features
- Student and company accounts
- Student profile management
- Company and job-drive management
- Application and eligibility workflows
- Smart job recommendations
- Interview scheduling and student interview views
- TPO/Admin announcements
- Placement analytics and skill-readiness insights
- Email/notification workflows where configured

## Repository Structure
```text
project-root/
├── backend/
│   ├── src/
│   └── test/
├── fronted/
│   └── src/
├── PRD.md
├── DESIGN.md
├── ARCHITECTURE.md
├── DATABASE.md
├── API.md
├── AGENTS.md
└── docs/
```
This is an illustrative structure; retain actual existing directories and filenames.

## Setup
1. Install the supported Node.js version.
2. Install backend and frontend dependencies in their respective directories.
3. Configure environment variables using the documented example files.
4. Start MongoDB or configure the approved database URI.
5. Start backend and frontend using scripts defined in each `package.json`.

Do not invent environment variable names; inspect the code and `.env.example` files.

## Development Validation
```bash
cd backend
npm test

cd ../fronted
npm run build
npm run lint
```

## Security
- Never commit `.env`, private keys, database credentials, OAuth secrets, or SMTP credentials.
- Use separate development and test databases.
- Keep server-side role checks authoritative.
- Review [AUTHENTICATION_SECURITY.md](AUTHENTICATION_SECURITY.md).

## Documentation Index
See the individual Markdown files in this documentation pack. Exact routes, schema fields, and environment variables must be synchronized with the current source code.
