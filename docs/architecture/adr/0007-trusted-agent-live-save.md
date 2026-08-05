# ADR 0007: Trust the authenticated textbook agent to publish requested chapter saves

- Status: Accepted (2026-08-05, by explicit instructor direction)
- Supersedes: ADR 0006 Decision 3 and Decision 7 only where they require a separate per-change Live Save approval
- Retains: all Content API, D1 authority, immutable revision, audit, delivery, rights, and protected-release boundaries from ADR 0006

## Context

ADR 0006 permitted agent-authored chapter publication but implemented it as two consecutive instructor decisions: the user first told the agent to publish, then opened a verification page and approved the exact same pending revision. That second interaction adds friction without adding a distinct editorial judgment when the instructor has already connected a trusted Codex client and explicitly requested publication in the current task.

The system already enforces the material publication invariants after authorization: only D1-authoritative chapters are writable; semantic operations are validated; the canonical head and working version use compare-and-swap checks; idempotency prevents duplicate revisions; every accepted revision and projection is immutable and attributed; and the public route must verify the matching delivery identity.

## Decision

1. A newly approved native MCP OAuth connection includes `content:live-save` and the `commit_live` operation for the 18 code-pinned chapter IDs.
2. The chapter, checkpoint, and media skills may call `commit_live` directly only when the user's current request explicitly says to Save or publish. Draft, revise, preview, inspect, or review language does not imply publication.
3. No per-change verification URL or code is required for the trusted OAuth path. Existing OAuth grants keep their original scopes and require one revoke/reconnect cycle before trusted publishing is available.
4. Access tokens remain short-lived, refresh tokens rotate, grants remain revocable, and the server verifies the persisted grant, actor, scope, operation, and chapter allowlist on every call.
5. The existing exact-revision `request_live_save_authorization` route remains temporarily available for older grants and conformance tests, but the versioned textbook skills do not use it.
6. Direct trusted publication changes authorization only. `commit_live` continues to require D1 authority, server validation, exact base revision, exact working version, an idempotency key, immutable history, audit attribution, sanitized projection creation, and public delivery verification.
7. Trusted chapter publication cannot approve rights, change the authority registry, deploy code or schema, promote or roll back a protected release, hard-delete history, or write D1/R2 directly.

## Consequences

- When the instructor says "publish" or "save live," a trusted agent can finish the chapter operation in one task without interrupting the instructor for a redundant approval.
- OAuth consent now accurately names editing and chapter-publishing authority. This is a stronger standing grant than ADR 0006's ordinary editing grant, so revocation, token rotation, fixed chapter IDs, explicit skill language, and server-side publication invariants remain mandatory.
- A compromised active OAuth grant could attempt chapter publication until revoked. It still cannot publish a Git-authoritative chapter, bypass concurrency or validation, alter rights or authority, deploy application code, erase history, or silently create duplicate revisions with the same idempotency key.
- Production activation requires reviewed deployment of the auth and MCP Workers, a one-time MCP reconnect, a controlled D1-authoritative chapter canary, and verification of the resulting immutable revision and public delivery receipt.

## Rollback

Remove `content:live-save` and `commit_live` from newly issued baseline OAuth grants, revoke existing trusted grants, and restore the versioned skills' per-change authorization path. Existing public revisions remain immutable. A prior chapter revision is restored only as a new draft followed by a guarded Save.
