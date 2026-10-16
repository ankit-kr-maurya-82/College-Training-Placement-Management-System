# Student job recommendations

`GET /api/v1/drives/recommendations` requires an active student bearer token. The profile used for matching comes from the verified token identity and active-student middleware; client-supplied student IDs are ignored. Query options include `eligibility=ELIGIBLE|INCOMPLETE|NOT_ELIGIBLE`, `jobType`, `workMode`, `search`, `sort=match|deadline|newest`, `page`, and `limit`.

The endpoint uses the same availability conditions as the public drive list: a drive must be `Published`, its application deadline must be in the future, and its company must be active. Application status is included from the authenticated student's existing applications. Applying remains `POST /api/v1/applications`, preserving its eligibility and duplicate-application checks.

## Match scoring

Configured criteria are weighted as follows: required skills 40 points, allowed branches 20, minimum CGPA 20, graduation year 10, and maximum active backlogs 10. The score is the sum of matched points divided by the total weight of criteria configured on that drive, rounded to the nearest whole percentage. Required skills receive partial credit in proportion to the exact case-insensitive skill names matched. Missing student data contributes zero for a configured criterion. If a drive has no supported matching criteria, its score is `null` rather than a fabricated percentage.

Eligibility is separate from the recommendation score and follows the existing application rules. `ELIGIBLE` means all configured academic requirements are present and met; `INCOMPLETE` means required profile information is missing; `NOT_ELIGIBLE` means at least one available profile value fails a configured requirement. Skills affect match score but are not hard application eligibility rules in the existing system. Student profile fields do not include location or work-mode preferences, so those fields are displayed and filterable but are not scored.
