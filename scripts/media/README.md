# Media quarantine runner requirements

This workflow never accepts a public upload trigger. A protected `media-quarantine`
environment must require an authorized reviewer and supply these environment values:

- secrets: `MEDIA_R2_ACCESS_KEY_ID`, `MEDIA_R2_SECRET_ACCESS_KEY`,
  `MEDIA_CALLBACK_TOKEN`, and `MEDIA_CLAMAV_DB_URL` (a short-lived signed URL)
- variables: `MEDIA_R2_ENDPOINT_URL`, `MEDIA_R2_QUARANTINE_BUCKET`,
  `MEDIA_R2_MEDIA_BUCKET`, `MEDIA_R2_JOBS_BUCKET`, and `MEDIA_CLAMAV_DB_SHA256`

The workflow receives only a job ID, exact private-R2 envelope key, and envelope
SHA-256. It downloads that immutable envelope from `MEDIA_R2_JOBS_BUCKET`; no
checked-in or caller-selected repository JSON file is accepted.

`MEDIA_CLAMAV_DB_URL` must deliver a prebuilt ClamAV database tarball containing
`main.cvd` or `main.cld`; its SHA-256 must match the protected environment variable.
The database must be refreshed by a separate trusted operations job at least daily.
This is intentional: GitHub-hosted runners cannot be relied upon to obtain fresh
ClamAV definitions from public mirrors. Missing, unreadable, or mismatched database
material fails the job before any quarantine object is read; the object remains in
the quarantine bucket and no callback is made.

The callback receiver must verify `x-media-signature` as an HMAC-SHA-256 over the
canonical JSON body, enforce the `idempotency-key`, and accept completion only from
the configured media callback endpoint. The raw `source` is intentionally excluded
from the output bucket upload.

`MEDIA_CALLBACK_TOKEN` in the protected GitHub environment and
`MEDIA_CALLBACK_SECRET` in the Content Worker are the two deployment-side names
for the same 32-byte-or-longer shared callback secret. Neither value is committed.
