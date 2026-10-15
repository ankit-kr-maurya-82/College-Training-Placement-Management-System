project repo - https://github.com/ankit-kr-maurya-82/College-Training-Placement-Management-System.git

reactjs- run  - npm run dev
 

User :
1. Public
2. Student
3. Recruiter
4. TPO/Admin



hi hello ankit bhoi
akka - ankit 2
main - ankit
mad - bhrantik

backend 
Student
company

## Google student sign-in

Google sign-in uses Google Identity Services in the React app to obtain an ID
credential. The frontend posts that credential to `POST /api/v1/auth/google`;
the backend verifies its signature, issuer, expiry, audience, and verified
email using `google-auth-library`, then creates or signs in a student and
returns the same bearer-token session shape as the existing student login.
Unlinked accounts with a matching email are not linked automatically.

### Google Cloud setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a Google Cloud project.
3. Configure the OAuth consent screen for your application and add any required
   test users while the app is in testing mode.
4. Create an OAuth client ID for a **Web application**.
5. Add the actual frontend origins to **Authorized JavaScript origins**, such as
   `http://localhost:5173` for local Vite development and your production
   frontend origin (for example, `https://placement.example.edu`). An origin is
   only scheme, host, and optional port—do not include a path or trailing slash.
6. Copy the same OAuth client ID to `GOOGLE_CLIENT_ID` in `backend/.env` and
   `VITE_GOOGLE_CLIENT_ID` in `fronted/.env.local`. These IDs must match.
   The frontend client ID is public; do not put a client secret or other secret
   in the frontend environment.
7. Set `CORS_ORIGIN` in `backend/.env` to the comma-separated, exact frontend
   origins allowed to call the API. Set `VITE_API_BASE_URL` to the backend's
   HTTPS API URL in production; production frontend and API origins must use
   HTTPS.
8. This implementation uses Google's popup credential flow; it does not need
   an OAuth redirect URI. Do not configure one unless the flow is changed.
9. Restart the backend and frontend after setting the environment variables,
   then test the Google button on both student login and registration.

The Vite development server sets `Cross-Origin-Opener-Policy:
same-origin-allow-popups` for Google's popup flow. Production hosting must
serve the same response header. If Google reports that an origin is not
allowed, add the exact origin shown in the browser address bar to the OAuth
client's Authorized JavaScript origins and wait for the change to take effect.

No Google Cloud credentials are included in this repository. Copy
`backend/.env.example` to a separate local file only if you need a template;
do not replace an existing `backend/.env` with it. Likewise, use
`fronted/.env.example` as the frontend template.

Before applying the schema changes to an existing MongoDB database, back up
the `students` collection and inspect its indexes and legacy values. The
`googleId_1` index is unique and sparse; unset/null Google IDs must not be
turned into repeated indexed `null` values. The optional `rollNumber` index is
also sparse so passwordless and unassigned-roll-number students can coexist.
If the database already has a non-sparse `rollNumber_1` index, inspect it and
verify existing non-empty roll numbers are unique, then drop that old index
before deploying so Mongoose can create the sparse version. Do not delete or
rewrite existing student accounts. Google sign-in should remain blocked until
the required indexes can be created safely.

For a MongoDB shell connected to the target database, start with:

```javascript
db.students.getIndexes()
db.students.countDocuments({ googleId: { $type: "null" } })
db.students.aggregate([
  { $match: { googleId: { $type: "string" } } },
  { $group: { _id: "$googleId", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
db.students.aggregate([
  { $match: { rollNumber: { $type: "string", $ne: "" } } },
  { $group: { _id: "$rollNumber", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
```

Resolve any existing duplicate/null Google IDs before creating `googleId_1`.
Only after backing up and confirming the old `rollNumber_1` index options,
drop it with `db.students.dropIndex("rollNumber_1")` when it is the old
non-sparse unique index; the application will then create the new sparse
unique index. This repository cannot inspect or migrate a live MongoDB
deployment automatically.

### Run and verify

```sh
cd backend
npm install
npm run dev
```

In another terminal:

```sh
cd fronted
npm install
npm run dev
```

Backend unit tests mock Google's ID-token verification; they validate our
audience/issuer/expiry handling and account/session behavior but are not a
live Google Cloud integration test. Run checks with:

```sh
cd backend && npm test
cd fronted && npm run lint && npm run build
```

Student authentication continues to use the existing JSON bearer-token
contract. The session token is handled by the existing frontend auth context;
this change does not introduce a separate cookie/session format.