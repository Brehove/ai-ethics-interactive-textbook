# ADR 0004: Reuse GitHub identity with constrained human and agent authority

- Status: Accepted (Phase 0, 2026-08-02)

## Context

The editor, API, preview, MCP, and release path need one comprehensible identity model. Browser sessions must resist cross-origin mutation; agents need narrowly delegated authority and must never inherit publishing power.

## Decision

Use GitHub OAuth and an instructor allowlist for human sign-in. The API validates the authenticated GitHub identity and enforces role/scope server-side. Browser mutations require the exact approved origin, a session-bound CSRF token, and secure same-site cookies; CORS permits only the named editor and preview origins. The public reader is never a mutation origin.

Agents receive short-lived, scoped OAuth tokens bound to a registered client, audience, run, and permitted chapter/content operations. They use bearer tokens, not browser cookies. Scopes permit only semantic draft operations such as edit, checkpoint, media placement, validation, preview, diff, restore-as-new-draft, and submit; they cannot alter schemas, identities, rights approval, credentials, or release state. An authenticated instructor may approve or reject the exact immutable submitted snapshot in the browser review surface, but the browser credential cannot publish. Production promotion additionally requires approval of the protected GitHub `content-production` environment for that signed candidate.

## Consequences

- Existing GitHub identities avoid a second instructor directory or CMS account.
- Access revocation is allowlist removal/token revocation, with audit records tied to GitHub subject and agent run.
- OAuth configuration, JWKS caching, PKCE, token rotation, emergency access, and step-up verification are implementation gates, not optional UI details.

## Rollback

Disable a client, revoke its tokens, or remove an instructor from the allowlist without changing content. If GitHub OAuth is unavailable, suspend authoring and publishing rather than bypassing origin/CSRF/scope controls; restore only through a separately approved identity ADR.
