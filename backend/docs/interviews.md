# Interview scheduling API

Interview times are entered in the company's browser timezone. The frontend sends ISO 8601 timestamps with a UTC offset, and the backend stores them as UTC `Date` values alongside the company's IANA `timeZone` (for example, `Asia/Kolkata`). Student and company pages display the stored instants in that recorded timezone, so both sides see the same scheduled local time.

All write operations require an `Idempotency-Key` header. The frontend reuses a key for a retry of the same submission. Keys are persisted with event history, so retrying a successful schedule/reschedule/cancel action returns the prior interview without sending a second email.

## Company routes

- `GET /api/v1/companies/me/interviews?period=upcoming|past|all&status=SCHEDULED|COMPLETED|CANCELLED&page=1&limit=20`
- `POST /api/v1/companies/me/interviews` with `applicationId`, `startAt`, `endAt`, `timeZone`, `mode`, and mode-appropriate `meetingLink` or `venue`; `instructions` is optional.
- `PATCH /api/v1/companies/me/interviews/:id/reschedule` with the new schedule fields.
- `PATCH /api/v1/companies/me/interviews/:id/cancel` with an optional `note`.
- `PATCH /api/v1/companies/me/interviews/:id/complete`.

## Student route

- `GET /api/v1/students/me/interviews?period=upcoming|past|all&status=SCHEDULED|COMPLETED|CANCELLED&page=1&limit=20`

Interview lifecycle states are `SCHEDULED`, `COMPLETED`, and `CANCELLED`. Rescheduling leaves the state as `SCHEDULED` and adds a `RESCHEDULED` event with the previous schedule preserved in event history. Only scheduled interviews can be rescheduled, cancelled, or completed. One scheduled interview is allowed per application; a completed or cancelled application interview does not block a later schedule.

Student update emails use the existing SMTP transport. Delivery status is stored on the corresponding event; email failure does not roll back the interview operation and the API response reports the delivery result. Notification delivery is at-most-once per idempotency key; failed email attempts are recorded and are not automatically retried.
