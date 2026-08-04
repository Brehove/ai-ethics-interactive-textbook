# ADR 0006: Permit scoped chapter Live Save through immutable public projections

- Status: Accepted (Phase 0, 2026-08-03; accepted under the explicit Unified Reader–Authoring implementation directive)
- Supersedes: the clauses identified below in ADR 0004 and ADR 0005
- Governing implementation plan: [Unified Reader–Authoring Experience](../../UNIFIED_READER_AUTHORING_IMPLEMENTATION_PLAN.md)

## Context

ADR 0004 correctly established a narrow human-and-agent authority boundary. ADR 0005 correctly established immutable public delivery and rollback. Their original publication clauses prevent the approved product flow: an authenticated instructor or explicitly authorized agent must be able to Save one validated chapter and make that immutable projection public without a separate GitHub review or whole-site deployment.

This decision changes that routine chapter-content path only. It does not turn the anonymous reader into an authoring surface, loosen OAuth or CSRF controls, grant database credentials to browsers or agents, or make code, schema, authority, infrastructure, rights clearance, or release control mutable through Save.

## Decision

1. The reader remains anonymous and non-mutating. The reader origin serves only sanitized, immutable public chapter projections and static fallback content.
2. The instructor editor runs on the dedicated `editor.ethicsandai.your-digital-life.org` origin. It reaches the Content API only through the authenticated gateway under exact-origin CORS and session-bound CSRF enforcement.
3. An authenticated allowlisted instructor may perform **Save live** for one D1-authoritative chapter. An agent may do so only with a short-lived, registered, document-bounded bearer capability that includes `content:live-save`, and only when the user has explicitly requested the Save.
4. Save live is one idempotent, compare-and-swap-guarded server transaction: validate semantic operations; create an immutable revision; materialize a sanitized immutable public projection; advance that chapter's public head; and write audit, history, and delivery-status evidence. A response is live only after the actual public route verifies the matching revision and projection identity. A committed but unconfirmed delivery returns the plan's pending state rather than claiming success.
5. Public projection delivery may use the approved same-D1 design only through the reviewed Public Projection Worker, generated query allowlist, and tests restricting it to `public_*` data. The anonymous Site Worker has no D1 binding and no editorial API. A projection failure or unavailable projection service falls back to the complete static chapter and emits only an internal diagnostic header.
6. **Protected release** remains separate and mandatory for code, schema, renderer, authority-map, rights-policy, infrastructure, and whole-book changes. It continues to use the protected release workflow and immutable deployment/rollback controls.
7. PKCE, GitHub identity validation, instructor allowlisting, host-only Secure HttpOnly cookies, token rotation, short-lived scoped agent authorization, step-up controls, emergency revocation, exact-origin enforcement, CSRF protection, audit history, immutable revisions, and restore drills remain required implementation gates. The session starts at one hour; the instructor session cookie is `SameSite=Strict` and the short-lived OAuth state/PKCE cookie is `SameSite=Lax`.
8. Restoring a prior chapter revision creates a new draft; saving it creates a new immutable public head. No browser or agent action rewrites or deletes historical revisions. Protected-release rollback remains a release-pointer/deployment operation.

## Clause-by-clause mapping

| Earlier ADR clause | Disposition | Unified Reader–Authoring rule |
| --- | --- | --- |
| 0004 Decision: GitHub OAuth, instructor allowlist, and server-side role/scope checks | Retained | GitHub identity and allowlist remain the human identity path; authorization remains server-side. |
| 0004 Decision: exact approved origin, session CSRF, Secure same-site cookies, named-origin CORS | Retained and narrowed | Mutations originate only from the dedicated editor through the gateway. The public reader is removed from authoring CORS after canary; cookie and PKCE-state behavior is specified in Decision 7. |
| 0004 Decision: public reader is never a mutation origin | Retained | The reader has no authoring credential, mutation route, or editorial API. |
| 0004 Decision: short-lived registered, audience/run-bound scoped bearer tokens; no browser cookies for agents | Retained | Agent capabilities remain short-lived and document/operation bounded bearer credentials. |
| 0004 Decision: agent scopes exclude schema, identity, rights, credentials, and release state | Retained | `content:live-save` adds one chapter-publication operation only; it does not grant any excluded authority. |
| 0004 Decision: browser credential cannot publish; protected GitHub environment approval is required for production promotion | Replaced for routine chapter Save; retained for protected release | An instructor may Save live one validated D1-authoritative chapter; an explicitly capable agent may do the same. Code, schema, renderer, authority, infrastructure, and whole-book promotion still require the protected release workflow. |
| 0004 Consequences: OAuth configuration, JWKS caching, PKCE, token rotation, emergency access, and step-up verification are gates | Retained | These remain gates; OAuth return-state handling and session duration are further specified by the governing plan. |
| 0004 Rollback: revoke client/tokens or remove instructor; suspend rather than bypass controls if OAuth fails | Retained | Emergency revocation and fail-closed authoring remain available without changing content. |
| 0005 Decision: private immutable snapshot and signed candidate manifest pin release inputs | Retained for protected releases; replaced for routine chapter Save | Protected releases retain a complete pinned release candidate. Save live instead writes a validated immutable chapter revision and immutable public projection in one guarded transaction. |
| 0005 Decision: protected build emits content-addressed assets and validates projections before one immutable static deployment | Retained for protected releases | Code/renderer/whole-book releases continue to require this path. |
| 0005 Decision: public reader never queries D1/R2 editorial APIs at page view | Replaced with a narrower public-projection boundary | The reader never directly queries editorial APIs or mutable drafts. It may obtain only immutable accepted `public_*` projections via the reviewed internal projection service; the static chapter is the fallback. |
| 0005 Consequence: failed or stale builds cannot partially change a chapter | Retained by a different mechanism | Save live advances only an accepted immutable projection after guarded validation and atomic head advancement. |
| 0005 Consequence: rollback is a serialized complete-release pointer/deployment change | Retained for protected releases; replaced for chapter content | Protected releases roll back by guarded release pointer/deployment change. A chapter rollback restores as a new draft and advances a new immutable chapter head only after Save live. |
| 0005 Consequence: snapshot, artifact, attestation, receipt, active-pointer history, retention, and restore drills | Retained | Chapter revisions/projections and protected-release artifacts retain auditable history and restore evidence. |
| 0005 Rollback: rebuild from prior R2 snapshot/pinned code, never current mutable D1 rows | Retained for protected releases | Protected-release recovery remains pinned and immutable. Routine chapter recovery uses the retained immutable revision/projection history, never mutable working rows. |

## Consequences

- Routine editorial publication gains the approved Pressbooks-like one-click Save path without making public reading mutable.
- The Content API and Public Projection Worker become high-assurance boundaries: their operation allowlists, transaction tests, response-header verification, and browser tests are mandatory before production use.
- Existing static releases remain the compatibility and incident fallback; this ADR authorizes no production OAuth redirect, public-projection serving, deployment, or database migration by itself.

## Rollback

Disable `content:live-save`, revoke an instructor or agent capability, or disable the unified authoring flag to stop new routine Saves. Restore an earlier chapter only by creating a new draft and performing a new guarded Save; never rewrite history. For a code/schema/renderer/authority/infrastructure incident, use ADR 0005's protected-release rollback procedure.
