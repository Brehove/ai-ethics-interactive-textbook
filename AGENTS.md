# AI Ethics Textbook agent guide

This file is the operating handoff for agents working in this repository. Read it before changing content, the instructor editor, the Content API, authentication, the textbook MCP, media, or deployment code.

## Project boundary

- Production reader: <https://ethicsandai.your-digital-life.org>
- Instructor editor: <https://editor.ethicsandai.your-digital-life.org>
- OAuth/auth gateway: <https://auth.ethicsandai.your-digital-life.org>
- Textbook MCP endpoint: <https://mcp.ethicsandai.your-digital-life.org/mcp>
- Canonical repository: `Brehove/ai-ethics-interactive-textbook`
- The public reader stores no student responses, creates no student accounts, and ships no student analytics beacon.
- Canvas remains the submission, identity, discussion, and grading system. Do not add those responsibilities to the textbook.

Git is canonical for application code and for chapters whose authority registry entry is `git`. A chapter becomes directly editable through the browser/API only after an explicit D1 authority cutover that binds its exact revision and normalized content hash. Never infer authority from the presence of an editor route.

## Current implementation state — 2026-08-05

The skill-prefix foundation was merged into `main` through [PR #76](https://github.com/Brehove/ai-ethics-interactive-textbook/pull/76) at `c26cd19`. The agent-native OAuth/MCP publishing work was then rebased onto that result and merged through [PR #77](https://github.com/Brehove/ai-ethics-interactive-textbook/pull/77), ending at `a14fa76`. Both PRs passed the public-boundary audit, full Astro/editor/security build, and Cloudflare Workers build.

The original production deployment was made from pre-rebase commit `368df4c`; its equivalent source is now represented on `main` through the rebased PR #77 commits.

Production deployments from this branch:

- Editor auth Worker `ethicsandai-editor-auth`: version `21153846-367d-4f72-a13b-8d358a6db13d`
- Content API Worker `ethicsandai-content-api`: version `89d76194-89f0-4443-b09b-cffc2a4f032c`
- Textbook MCP Worker `ai-ethics-textbook-mcp`: version `138782bb-99af-4f50-8e0a-d03dbd5091d9`
- Instructor editor Worker `ai-ethics-instructor-editor`: version `e882b4e8-dd43-45ff-a796-a2c5169fa33b`
- Auth-state D1 migration `0003_mcp_oauth.sql` is applied remotely; the remote migration check reported no pending migrations.

Live verification completed:

- OAuth authorization-server and MCP protected-resource discovery
- Public loopback-client registration
- PKCE authorization-code exchange through GitHub instructor identity
- Codex OAuth credential storage and `codex mcp list` reporting `Auth: OAuth`
- Refresh/revocation behavior in automated tests
- The production OAuth grant documented by PR #77 contains `request_live_save_authorization` but not standing `commit_live`; ADR 0007 changes new OAuth connections to trusted direct chapter publishing after the revised auth and MCP Workers are deployed
- Plugin/skill bundle validation and complete repository validation/builds

Three OAuth interoperability problems were found and fixed during the live Codex login:

1. The protected resource is the exact MCP endpoint, `https://mcp.ethicsandai.your-digital-life.org/mcp`, not the domain root.
2. Repeated approval submissions are idempotent and return the same still-valid, PKCE-bound authorization code.
3. Approval renders a secure completion page with an automatic callback plus a visible **Return to Codex** link because Chrome may block an automatic HTTPS-to-loopback handoff.

No chapter prose, checkpoint, media placement, or public content revision was changed during this infrastructure deployment and authentication test. A real authenticated read-only MCP tool call and a controlled Chapter 7 Live Save canary remain the next end-to-end application checks.

## Supported agent surface

The versioned Codex plugin is `plugins/ai-ethics-textbook/`. Its MCP registration is in `.mcp.json`; its repository marketplace entry is `.agents/plugins/marketplace.json`.

It packages these four skills:

- `ai-ethics-author-textbook-chapter`
- `ai-ethics-manage-prompt-checkpoints`
- `ai-ethics-publish-textbook-media`
- `ai-ethics-release-steward`

Repository skill sources are in `.agents/skills/`. Plugin copies must remain byte-identical; `npm run test:skills` enforces that requirement.

Use only the `ai-ethics-textbook` MCP connection for agent-native textbook work. If the tools are absent or OAuth is required, ask the instructor to authenticate or reconnect the MCP. Do not fall back to:

- `TEXTBOOK_MCP_ACCESS_TOKEN` or another standing bearer
- direct Content API calls
- direct database writes
- repository/local chapter edits presented as current D1 state
- raw HTML, CSS, SQL, iframe markup, or generic patch payloads

### Unsupported MCP requests

Before changing cards, card placement, layouts, media, checkpoints, or other chapter structures, inspect the live MCP catalog and valid options for the exact document. If the requested result is not supported by the current typed MCP tools and live catalog, stop and tell the instructor plainly:

- which requested behavior is unsupported
- which currently supported options are closest
- whether fulfilling the request would require application code, contract/schema changes, a migration, deployment, or another platform-level change

An unsupported chapter-authoring request does **not** authorize platform development. Do not edit repository code, create a branch or pull request, add a migration, or deploy services merely to make the request possible. Proceed with that work only after the instructor separately and explicitly authorizes the proposed platform change. Routine chapter card and layout changes should otherwise remain MCP-only and should not produce a GitHub pull request.

Codex discovers MCP tools when a task/conversation starts. Registering or authenticating an MCP does not hot-refresh the tool list of a task that is already running; begin a new task after first-time registration or authentication.

For an MCP-only Codex registration:

```bash
codex mcp add ai-ethics-textbook \
  --url https://mcp.ethicsandai.your-digital-life.org/mcp
codex mcp login ai-ethics-textbook
```

Do not add `--bearer-token-env-var`. The supported flow is native OAuth with PKCE.

## Chapter authoring workflow

1. Call `get_authoring_view` for the exact document.
2. Call `get_passage` for every passage that may change.
3. Call `create_or_resume_changeset`.
4. Use typed semantic tools with the exact `changeSetId`, `documentId`, `baseRevisionId`, `expectedVersion`, and a fresh UUID `idempotencyKey`.
5. Use `replace_passage_text` for narrow prose changes and `replace_chapter_document` only for a deliberate whole-chapter replacement.
6. Manage checkpoints, media, embeds, and person features as typed records with stable passage anchors.
7. Call `preview_changes` and inspect `get_version_history` before the terminal action.
8. Leave the isolated draft unless the user's current request explicitly says to Save or publish live.

Do not restore the old validate/submit/review ceremony to routine chapter saving. Validation remains server-enforced, but the user-facing model is Pressbooks-like: edit, preview as needed, and Save.

## Live Save and publication boundary

The trusted OAuth grant can read, draft, preview, restore history as a new draft, manage checkpoints and media, and publish one D1-authoritative chapter when the user's current request explicitly says to Save or publish. It includes `content:live-save` and `commit_live`; a per-change verification page is not part of the normal flow.

For an explicit Save/publish request:

1. Call `commit_live` directly with the exact changeset, document, base revision, expected working version, and idempotency key.
2. Do not call `request_live_save_authorization` or wait for a second instructor confirmation.
3. If trusted publishing is unavailable, reconnect the `ai-ethics-textbook` MCP once so OAuth can issue the revised grant, then begin a new task.
4. If delivery is pending, poll `get_live_commit_status`; do not create a second commit or idempotency key.

The access token remains short-lived and refresh-token rotation, revocation, Content API validation, D1 authority checks, optimistic concurrency, idempotency, immutable history, and delivery verification remain enforced. The trusted grant authorizes the operation; the user's explicit Save/publish language authorizes its use in the current task.

`commit_live` creates one immutable public chapter revision and projection. It does not approve rights, change an authority registry entry, deploy code/schema, promote a protected whole-site release, or authorize rollback.

## Checkpoints

Chapters may contain zero, one, or many checkpoints. Multiple checkpoints may share one passage anchor, stages may repeat, and collection order controls display order.

- Use `upsert_checkpoint` for creation or revision.
- Preserve `checkpointId` when revising.
- Use `reorder_checkpoint` only for ordering.
- Use `remove_checkpoint` by stable ID.
- Always preview both inline placement and sidebar behavior.

Do not impose a one-checkpoint-per-chapter or one-checkpoint-per-stage rule.

## Media and embeds

Search for a cleared reusable asset before uploading. New media requires a persisted review package covering rights, teaching use, and accessibility.

The media helper supports a two-step agent-native flow:

```bash
node .agents/skills/ai-ethics-publish-textbook-media/scripts/upload-media.mjs \
  --inspect --file <local-file> --mime-type <mime-type>

node .agents/skills/ai-ethics-publish-textbook-media/scripts/upload-media.mjs \
  --file <local-file> --mime-type <mime-type> \
  --upload-url <ticket-url> --upload-token <one-time-token>
```

The upload ticket is short-lived, single-use, and bound to actor, MIME type, byte count, and SHA-256. Never persist the ticket or expose a standing OAuth bearer to the helper. Audio/video requires a substantive transcript equivalent; video also requires reviewed poster metadata.

Use `resolve_provider_url` before `upsert_embed`. Supported provider behavior and fallbacks are registry-controlled; never paste third-party embed HTML.

## Code map

- Public Astro reader: `src/`, `content/`, `public/`
- Instructor editor UI/Worker: `apps/instructor-editor/`
- OAuth and capability issuer: `workers/editor-auth/`
- Private Content API: `workers/content-api/`
- Hosted MCP: `workers/textbook-mcp/`
- Public projection and protected preview: `workers/public-projection/`, `workers/textbook-preview/`
- Codex plugin: `plugins/ai-ethics-textbook/`
- Canonical skill sources: `.agents/skills/`
- Deployment guide: `docs/DEPLOYMENT.md`
- Production checklist: `docs/operations/production-deployment-checklist.md`

## Required validation

Use Node 22. For content or broad application changes, run:

```bash
npm ci
npm run content:generate
npm run validate
npm run build
```

For focused MCP/auth/plugin work, also run the relevant targeted checks:

```bash
npm run test:editor-auth
npm run test:content-api
npm run test:mcp
npm run test:skills
npm run build:instructor-editor
```

Run `git diff --check` before committing. Use Wrangler dry runs for every affected Worker before production deployment.

## Deployment and Git rules

- Work on an isolated branch; preserve unrelated user changes.
- Do not write or force-push `main`.
- Default to a draft PR for substantive work.
- Do not merge or deploy production without explicit user authorization.
- Apply D1 migrations before deploying code that depends on them, and verify the remote migration table afterward.
- For this OAuth/MCP slice, deploy in dependency order: auth migration → auth Worker → Content API when changed → MCP Worker → instructor editor when changed.
- Record deployed Worker version IDs and smoke evidence, never tokens.
- A successful code deployment is not a protected whole-site content release. Follow `docs/operations/production-deployment-checklist.md` for promotion, recovery, rollback, and release-state audit.

As of 2026-08-05, both PR #76 and PR #77 are merged and `main` contains the deployed OAuth/MCP implementation. Verify live GitHub and Cloudflare state rather than relying on this dated status after subsequent changes.
