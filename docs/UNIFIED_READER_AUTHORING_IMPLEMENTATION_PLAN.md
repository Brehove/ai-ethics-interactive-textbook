# Unified Reader–Authoring Experience

> Ordering update (August 5, 2026): [ADR 0007](./architecture/adr/0007-ordered-chapter-flow.md) supersedes every schema-v2 assumption in this plan that derives checkpoint or managed-placement position from passage anchors, `displayOrder`, `position`, or `orderAtAnchor`. Schema v3 uses explicit `checkpointRef` and `placementRef` nodes in `chapter.body`; passage identifiers retain contextual and deep-link meaning only. Historical v2 descriptions below remain migration context, not current write guidance.

## Detailed implementation plan

- **Status:** Implemented, deployed, and production-verified across all 18 chapters
- **Plan version:** 2.0
- **Last updated:** 2026-08-04
- **Target repository:** Brehove/ai-ethics-interactive-textbook
- **Operating target:** At or below $5/month for Cloudflare infrastructure
- **Final application baseline:** `d9f450e4b842259db318c10e7584ae50d9c4d5f1` (documentation-only completion records follow this commit)
- **Final production scope:** Chapters 1–18
- **Confidence:** High; exact production revisions, public projections, editor parity, scholar/media rendering, reader-editor continuity, and browser/agent publication were verified

---

## Completion record — 2026-08-04

This plan is complete. The detailed material below is retained as the implementation specification and operational reference; proposal language and estimates describe the route taken, not unfinished work.

| Phase | Result | Verification |
|---|---|---|
| 0 — decisions and spike | Complete | Superseding ADR/security boundaries accepted; editor engine and reader-identical projection validated |
| 1 — content contract and migration | Complete | Stable IDs, person relations, zero-to-many checkpoints, managed placements, and deterministic migration/round-trip tests |
| 2 — shared projection/renderer | Complete | Reader, editor, public D1 delivery, print, and fallbacks consume the shared projection; visual cards replace raw HTML |
| 3 — atomic commit/public projection | Complete | One-click Save creates an immutable revision, advances the guarded D1 head, materializes the projection, and verifies exact public delivery |
| 4 — deep-link authentication | Complete | Dedicated editor origin, GitHub OAuth return state, same-chapter/passage deep links, Done return, CSRF/origin/session tests |
| 5 — continuous authoring UI | Complete | Continuous chapter surface; formatted prose; contextual checkpoint, media, embed, and person-feature dialogs; whole-chapter paste/import |
| 6 — history/API/MCP/Skills | Complete | Immutable version history, safe restore-as-draft, OpenAPI 1.7.1, capability-scoped hosted MCP tools, and versioned Codex Skills |
| 7 — verification | Complete | Contract, migration, API, security, accessibility, browser, visual, build, Cloudflare bundle, and public boundary gates passed |
| 8 — canary/cutover | Complete | Chapters 5 and 7 passed reader/editor media and scholar-card QA; protected release cut over all 18 chapters to D1 |
| 9 — full rollout/retirement | Complete | All public routes and editor deep links are live; routine content updates no longer require commits, PRs, validation clicks, or whole-site deploys |

### Final experience verified

~~~text
public chapter
  → chapter menu → Edit chapter
  → GitHub sign-in only when the session is absent
  → same chapter and passage in the continuous visual editor
  → edit prose, checkpoints, scholar cards, images/GIFs, captions, or embeds
  → Save
  → immutable version created and exact public delivery verified
  → Done
  → same public chapter and passage
~~~

Production browser acceptance confirmed:

- Chapter 7 opened at `revision_c6bb0561dc5598fa89d9f35d`, showed exactly three current checkpoint cards, two rendered Wikimedia media placements, working **Checkpoint**, **Media**, **Embed**, **Person / Scholar**, **History**, **Save**, and **Done** controls, and no stale production-verification checkpoint.
- Chapter 5 showed the Thomas Aquinas person feature—including image, dates, description, and primary text—in both the public reader and signed-in editor.
- **Done** returned from the editor to the matching public chapter and preserved the passage anchor.
- The production browser emitted no application console errors during final Chapter 7 checkpoint/media selection and Chapter 5 Thomas Aquinas selection. The managed-card selection lifecycle correction is merged in PRs 70–71.
- A stale browser idempotency key can no longer resume an old/submitted/approved draft: the server resumes only an open change set based on the exact current canonical revision, and the editor uses a fresh in-memory request key.

### Final service and release identity

- Reader: `https://ethicsandai.your-digital-life.org`
- Editor: `https://editor.ethicsandai.your-digital-life.org`
- MCP: `https://mcp.ethicsandai.your-digital-life.org`
- Release: `release_eaf83ab480c87235ddb35acc`, sequence 25
- Candidate: `candidate_7456f60599709b8533a96d01`; manifest `b12ec90898a8ae8b5adbbc16039197cd3bb819d4744ee68a4b66d7ff7e366b0e`
- Reader Worker: `7e8f8162-cf1f-4960-b252-f0794b1a0ee9` at 100% traffic
- Content API: `f7f73e58-2b3f-4961-a8b5-cccce840779f`
- Instructor editor: `29fc2a09-92d1-45eb-8555-497a61f9eae0`
- Deployment receipt: `receipt_a6f67c6401eace78ec148d6a`; transaction `deployment_228ef47767a6764c4609ff78`
- Release workflow: [30933681192](https://github.com/Brehove/ai-ethics-interactive-textbook/actions/runs/30933681192)
- Final application commit: `d9f450e4b842259db318c10e7584ae50d9c4d5f1` (PR 68 implementation; PRs 70–71 managed-card lifecycle correction)
- Release audit: all 18 authority records and all 18 release documents verified; state `valid: true`

Cloudflare R2 usage billing remains enabled with the operating target at **$5/month**. The $4 early-warning and $5 target alerts, quarterly restore/rollback exercise, provider-health checks, and routine cost review are ongoing operations rather than implementation gates.

---

## 0. Purpose and authority of this plan

This document defines the implementation needed to make the PHIL 123 textbook feel like one product when reading and editing. It is a focused successor to the browser-editor, rendering, API, and publication sections of the [Agent-Native Authoring and Media Platform plan](./AGENT_NATIVE_AUTHORING_PLATFORM_IMPLEMENTATION_PLAN.md).

The earlier plan established the D1/R2 content control plane, Chapter 7 canary, media and embed contracts, GitHub authentication, MCP, Skills, revision history, and protected release machinery. This plan defined the product and architectural gap that the completed implementation closed:

> An instructor should be able to move from a published chapter to an identical-looking editing view, edit prose or managed content, click Save once, and immediately see a new public version without entering a separate administrative application or running a validation/review ritual.

This plan also fixes the underlying reason that scholar cards and some media appear in the reader but disappear or degrade in the editor.

Where this document conflicts with [ADR 0004](./architecture/adr/0004-auth-and-agent-scopes.md) or [ADR 0005](./architecture/adr/0005-immutable-publish-and-rollback.md), Phase 0 requires an explicit superseding ADR before implementation begins. The intended changes are narrow:

- keep the public reader outside the mutation trust boundary;
- allow an authenticated instructor to publish a single validated chapter revision with Save;
- allow an agent with an explicit content:live-save capability to do the same;
- preserve full protected releases for code, schema, authority, and infrastructure changes;
- serve only immutable, sanitized public chapter projections at request time.

The superseding ADR must also explicitly retain or replace ADR 0004’s PKCE, token rotation, short-lived scoped agent authorization, step-up controls, emergency revocation, rollback, and origin/CSRF requirements. Product approval does not silently supersede an accepted security ADR.

The completion record above is the authoritative implementation status. The sections below retain the pre-implementation specification so future maintainers can trace each production behavior to its requirement, migration, verification gate, and rollback rule.

---

## 1. Executive decision

Build a **reader-identical instructor editor on a dedicated editor origin**, backed by one canonical chapter model and one shared renderer.

The target system has five defining properties:

1. **Seamless entry and exit.** The public chapter menu opens the matching chapter on the editor origin. GitHub authentication returns to that same chapter and passage. Done returns to the public chapter at the same place.
2. **Continuous-document editing.** The instructor edits prose as one document, not as a visible list of database blocks. Internally structured nodes remain necessary, but they are an implementation detail.
3. **True visual parity.** Reader, editor, protected preview, print, and live D1 output consume the same projection and renderer. Scholar cards, captions, GIFs, and embed fallbacks do not have separate implementations.
4. **One-click live Save.** Save performs validation, immutable revision creation, audit logging, public projection materialization, and public-head advancement as one server operation. There is no separate Validate, Review, Submit, or Merge step for routine content edits.
5. **Agent-native parity.** Browser actions and agent actions use the same typed semantic operations. An explicitly authorized agent can save a chapter live and receives the exact revision, projection hash, and public URL.

### 1.1 The instructor experience

The common path must be:

~~~text
Read chapter
  → chapter menu
  → Edit chapter
  → GitHub sign-in only when needed
  → same chapter and passage in authoring mode
  → edit prose, checkpoint, scholar card, media, or embed
  → Save
  → Saved and live
  → Done
  → same public chapter and passage
~~~

The common path must not require:

- choosing the chapter again;
- navigating to /admin/;
- seeing raw HTML;
- pressing Validate;
- submitting for review;
- opening a separate preview tab;
- creating a Git commit or pull request;
- waiting for a whole-site deployment.

### 1.2 What remains deliberately separate

- The public reader stays anonymous, student-data-free, and free of authoring code and credentials.
- The editor runs on editor.ethicsandai.your-digital-life.org even though it shares the reader’s appearance.
- GitHub remains the authority for code, schemas, renderers, migrations, tests, Skills, and infrastructure.
- Full immutable releases remain required for code, schema, renderer, authority-cutover, and infrastructure changes.
- Unknown or unsafe raw HTML, scripts, iframes, CSS, and arbitrary embed code remain prohibited.
- New media must finish required processing and have sufficient accessibility and rights metadata before it can become public.

### 1.3 Publication vocabulary

The implementation must distinguish two operations:

| Term | Meaning | Who may do it |
|---|---|---|
| **Save live** | Publish one validated content revision for one D1-authoritative chapter and advance that chapter’s public projection | Authenticated instructor; agent with explicit content:live-save scope |
| **Protected release** | Deploy code, schema, renderer, authority-map, or whole-book changes | Existing protected release workflow only |

Save live does not deploy code, change chapter authority, change schemas, approve rights, or alter infrastructure.

---

## 2. Current-state findings that drive the design

### 2.1 The reader and editor are different applications

The public chapter routes use [ReaderShell.astro](../src/components/ReaderShell.astro), while [/admin/](../src/pages/admin/index.astro) mounts [EditorShell.astro](../src/components/editor/EditorShell.astro). The editor:

- defaults to Chapter 7;
- presents a global chapter picker and separate workspaces;
- does not accept a chapter slug, passage anchor, or public return URL;
- uses a custom browser renderer rather than the reader renderer.

Adding only an Edit link to /admin/ would reduce one click but would not produce the requested Substack-like experience.

### 2.2 There are multiple drifting renderers

The repository currently has at least four chapter-rendering paths:

1. Astro static reader rendering;
2. the site Worker’s D1 string renderer;
3. the browser editor renderer;
4. the protected preview renderer.

They do not support the same node types. The result is predictable: content can look correct in one surface and disappear, become a placeholder, or expose markup in another.

### 2.3 Scholar cards are not runtime Wikimedia embeds

The Thomas Aquinas card is assembled from:

- the chapter’s world relation;
- a curated person record;
- a locally stored portrait originally sourced from Wikimedia Commons;
- local biography, role, source, credit, and license data;
- client-side placement logic in [InlineScholarFigures.astro](../src/components/InlineScholarFigures.astro).

Students’ browsers do not need the Wikimedia API to render the card. The current failure occurs because the Git-to-D1 import reduces a person relation to entityId and relation, discarding featured and passageIds, and because the editor has no scholar-card node or renderer.

There are currently 19 featured scholar placements. The migration must cover all of them, including chapters with multiple featured thinkers.

### 2.4 Current Save is not one atomic browser operation

The current editor:

1. sends chapter.replaceBody;
2. then sends changeset:saveLive.

If the first request succeeds and the second fails, the server and browser can disagree about the save state. The working draft is recoverable, but the user sees an error and must reason about two hidden states.

### 2.5 Only Chapter 7 has a live public D1 projection

[workers/site/src/index.mjs](../workers/site/src/index.mjs) is hardcoded to chapter_ch07. Saving another chapter to D1 would not make the public reader show the update until a later static deployment.

### 2.6 The accepted ADRs no longer match the desired product

ADR 0004 says the browser and agents cannot publish. ADR 0005 says the public reader never reads a live D1/R2 projection. Those decisions were conservative and coherent for the original migration, but they cannot produce Pressbooks-like one-click publication.

The replacement architecture retains their safety goals while changing their mechanism:

- only accepted immutable revisions are projected publicly;
- drafts and editorial tables remain inaccessible;
- the public site has no mutation route;
- every Save is versioned and reversible;
- static HTML remains the operational fallback;
- full code releases remain protected.

---

## 3. Product requirements

### 3.1 Reader-to-editor continuity

- Every public First Read chapter has a chapter overflow menu.
- The menu includes Copy link, Print/PDF, Download, and Edit chapter.
- The reader does not probe authentication on ordinary page load.
- Selecting Edit records the nearest visible stable passage or heading.
- The editor opens the matching chapter at that passage.
- A valid existing session bypasses the visible GitHub round trip.
- A missing or expired session begins GitHub OAuth and returns to the same chapter and passage.
- Done returns to the same public URL and anchor.
- Browser Back, Cancel, session expiry, and failed Save do not destroy unsaved work.

### 3.2 Continuous editing

- The page looks like the published chapter, with the same typography, width, spacing, colors, and managed content.
- Prose editing behaves as one continuous document.
- Whole-chapter paste supports plain text and sanitized rich text.
- Headings, paragraphs, lists, links, emphasis, blockquotes, tables, and approved callouts preserve their semantics.
- Internal stable IDs survive ordinary edits and moves.
- Managed nodes are visible in place but cannot be corrupted by character editing.
- Undo and redo cover prose and managed-node insertion, removal, and movement.

### 3.3 Prompt checkpoints

- A chapter may have zero, one, or any practical number of checkpoints.
- Multiple checkpoints may share a stage, conceptual slot, or passage.
- Commit–Work–Reconcile remains a suggested pedagogical pattern, not a schema cardinality rule.
- Checkpoint inserts never create an empty invalid block.
- The instructor can edit prompt, trigger, title, guidance, response structure, word guidance, stage, strategy, passage anchor, sidebar visibility, and display order.
- The editor shows both the inline checkpoint presentation and its side-panel presentation.
- Moving or removing a checkpoint is a typed operation with version history.

### 3.4 Scholar cards

- Every existing scholar card appears in the editor exactly where it appears for readers.
- A card is a typed person-feature placement, not pasted HTML.
- The instructor can add a person feature, choose the person, role, display preset, and passage placement, then move or remove it.
- Biography, portrait, dates, source links, image credit, and license remain centralized in the person/media records.
- Wikimedia is a maintenance-time source and provenance record, not a browser runtime dependency.

### 3.5 Media and embeds

- Media and Embed toolbar buttons always open a visible, keyboard-focused insertion flow.
- Images and GIFs render in the editor as they will render publicly.
- Captions, alt text, credits, license, teaching use, focal point, and display preset are editable contextually.
- Animated media does not autoplay and has a static poster plus Play/Stop controls.
- YouTube, Vimeo, X, Spotify, SoundCloud, Bluesky, and rich-link fallbacks use typed adapters.
- The editor shows the authored fallback presentation by default.
- External provider activation is optional and explicit; no provider receives a request before activation.
- Unsupported URLs become safe rich-link cards rather than arbitrary embed HTML.

Provider support remains registry-driven:

| Support tier | Formats/providers | Unified-editor requirement |
|---|---|---|
| Native/launch | uploaded images, animated GIF/WebP, short audio/video, PDF/document cards | Complete WYSIWYG figure/card, accessibility/rights metadata, poster/fallback, print/offline behavior |
| Adapter/launch | YouTube, Vimeo, X | Typed URL resolution, authored first-party fallback, explicit click-to-load provider view |
| Adapter/extended | Spotify, SoundCloud, Bluesky | Same fallback-first contract and provider-specific browser/CSP tests |
| Demand-driven | TikTok; Instagram/Facebook; Mastodon; Reddit; Giphy/Tenor; TED; SlideShare/Scribd/Issuu; podcast/RSS | Safe rich-link card until a reviewed adapter and real chapter requirement exist |
| Prohibited | arbitrary iframe, script, embed HTML, shortcode, or runtime generic oEmbed HTML | Reject in editor, API, MCP, import, and build |

Adding a new adapter must not require a schema redesign: implement normalize/validate, fallback projection, activated projection, CSP manifest, health behavior, print/offline output, and browser tests behind the provider registry.

### 3.6 Save and version history

- The primary action is Save.
- Save validates automatically and publishes immediately when valid.
- Ordinary prose, checkpoint, caption, and placement edits do not require a second review action.
- Every successful Save creates an immutable revision.
- History shows time, actor, agent run when applicable, content summary, and semantic diff.
- Restoring an earlier revision creates a new draft; saving it creates a new head revision.
- No history operation deletes or rewrites an earlier revision.

### 3.7 Agent-native control

- The OpenAPI contract is authoritative for browser, MCP, and Skill behavior.
- Agents use semantic operations, not raw database access, HTML, CSS, or JSON Patch.
- An agent can read the complete authoring view, update prose, manage checkpoints, place media/embeds/person features, preview, commit live, inspect history, and restore an old revision as a draft.
- Agent live publication requires an explicit content:live-save capability and an explicit user request to publish/save.
- The API returns exact revision and public-projection identity after every live Save.

### 3.8 Student privacy and accessibility

- Anonymous student pages create no authoring session, analytics event, or response record.
- Student checkpoint responses remain in page memory only.
- The public Worker can read only public projection data through a read-only service surface.
- Keyboard, screen-reader, 200% zoom, reduced-motion, no-JavaScript, print, and offline behavior remain supported.

---

## 4. Target architecture

~~~text
PUBLIC READER ORIGIN
ethicsandai.your-digital-life.org

  static Astro shell and fallback
             |
             | GET published immutable projection
             v
  Site Worker ──service binding──> Public Projection reader
                                         |
                                         | SELECT public_* tables only
                                         v
                                  D1 accepted revisions


EDITOR ORIGIN
editor.ethicsandai.your-digital-life.org

  reader-identical authoring shell
             |
             | authenticated semantic API
             v
  Auth gateway ──service binding──> Content API
                                         |
                  validate + project + D1 transactional batch
                                         |
             +---------------------------+------------------------+
             |                           |                        |
      immutable revision          public projection         audit/history


AGENT PATH

  Codex Skill / MCP client
             |
             | scoped bearer token
             v
        Textbook MCP ─────────────> Content API
~~~

### 4.1 Origin boundaries

| Origin | Responsibility | Mutation authority |
|---|---|---|
| ethicsandai.your-digital-life.org | Anonymous reader, print, offline fallback, public projection delivery | None |
| editor.ethicsandai.your-digital-life.org | Instructor authoring UI with reader-identical presentation | Through auth gateway only |
| auth.ethicsandai.your-digital-life.org | GitHub OAuth, session, CSRF, human API proxy | Scope-limited |
| preview.ethicsandai.your-digital-life.org | Optional immutable draft preview and compatibility fallback | None |
| mcp.ethicsandai.your-digital-life.org | Agent tool facade | Token-scope limited |

The visual experience is continuous even though the security origin changes. The editor must not be mounted on the anonymous public origin.

### 4.2 Shared packages

Add the following reusable packages:

~~~text
packages/
  chapter-renderer/
    src/
      projection.ts
      render-shared.ts
      editor-decorators.ts
      render-print.ts
      normalize-dom.ts
      security.ts
      types.ts
      index.ts
  authoring-client/
    src/
      api.ts
      auth.ts
      changeset.ts
      conflicts.ts
      recovery.ts
      index.ts
~~~

The content contract remains in packages/content-contract. The new renderer consumes only validated content-contract objects and versioned entity/media projections.

### 4.3 Editor engine

Replace the fragile custom contenteditable serializer with a self-hosted Tiptap/ProseMirror editor configured as a continuous document.

Reasons:

- it supports a schema-governed document rather than arbitrary HTML;
- managed items can be atom nodes with contenteditable=false;
- paste transformations can clean Word, Google Docs, Markdown-derived, and web HTML;
- selection, undo/redo, cursor movement, tables, links, and custom node views are mature;
- no hosted editor service or recurring editor fee is required;
- internal nodes do not have to appear as visible “blocks.”

Use only pinned open-source packages. Do not add Tiptap Cloud, collaboration, AI, or paid extension dependencies.

Required custom nodes:

- passage paragraph;
- heading with stable section identity;
- list;
- blockquote;
- table;
- callout;
- checkpoint marker;
- media figure;
- external embed or rich link;
- person feature;
- diagram/artifact;
- locked legacy component during migration.

### 4.4 Architectural invariants

1. One chapter revision, renderer version, schema version, and stylesheet hash produce one deterministic public projection hash; a content revision may have several immutable projections across renderer or stylesheet releases.
2. Reader, editor, and preview never independently interpret canonical content.
3. Managed content is never stored as editor-generated HTML.
4. A public projection can reference only accepted immutable revisions and cleared assets.
5. The anonymous reader has no write route and no editorial database surface.
6. One chapter has only one writable authority at a time.
7. Save is idempotent and compare-and-swap guarded.
8. A failed Save never clears the browser’s dirty state or emergency recovery copy.
9. Restores append history; they never rewrite it.
10. Styling is renderer-owned. Humans and agents select approved semantics and presets.
11. A public chapter head pins one projection ID and hash, not merely a content revision.

---

## 5. URL, authentication, and return-position design

### 5.1 URL contract

Public chapter:

~~~text
https://ethicsandai.your-digital-life.org/chapter/<slug>/#<passage-or-section-id>
~~~

Matching editor chapter:

~~~text
https://editor.ethicsandai.your-digital-life.org/chapter/<slug>/?mode=edit#<passage-or-section-id>
~~~

The common edit flow never routes through the global chapter picker.

### 5.2 Capturing position

When Edit is selected:

1. find the nearest visible element with a stable passage ID;
2. if none is visible, use the nearest visible section heading;
3. otherwise use the chapter top;
4. preserve that anchor in the editor target;
5. after editor load, scroll the anchor into view without stealing focus from the author bar.

When Done is selected:

- return to the same anchor if it still exists;
- if it was deleted, use the declared replacement anchor;
- otherwise use the nearest preceding surviving passage;
- finally fall back to the chapter top.

### 5.3 OAuth state

Extend /auth/start with a canonical query contract. It accepts no JSON request body and no arbitrary returnTo URL:

~~~text
GET /auth/start?chapter=aristotle-character-and-ai-assisted-life&mode=edit&anchor=ch07-p0014
~~~

The Worker parses and validates those individual fields, then constructs this internal target:

~~~json
{
  "chapterSlug": "aristotle-character-and-ai-assisted-life",
  "mode": "edit",
  "anchorId": "ch07-p0014"
}
~~~

The signed OAuth state contains:

- version and kind;
- one-time nonce;
- issued-at and expiry;
- known chapter slug;
- allowed mode;
- validated passage/section anchor when supplied.

The callback reconstructs the editor URL from those fields. It must never echo an absolute return URL supplied by the browser.

The chapter-slug allowlist comes from a generated, code-pinned chapter-route manifest built from canonical chapter metadata and committed into the editor-auth Worker artifact. The manifest contains exactly documentId, slug, public path, and editor path; it contains no content or D1 credentials. CI fails if it differs from the 18 canonical routes.

The auth Worker validates the optional anchor only for a bounded safe syntax, ^[A-Za-z][A-Za-z0-9._:-]{0,127}$, and never treats it as a path or URL. Because the auth Worker deliberately has no content D1 binding, the editor authoring-view load performs the existence check after authentication: use the exact anchor when present, follow a canonical tombstone/replacement when retired, otherwise fall back to the nearest safe chapter position. An unknown but syntactically valid anchor never changes the host, route, or authorization target.

Use a dedicated, minimal auth-state D1 database bound only to the auth Worker. Store nonce hash, PKCE verifier material, validated target, issued-at, and expiry. Consume a nonce with one atomic DELETE ... RETURNING operation; a missing row is an expired or replayed state. Run scheduled expiry cleanup. Failure to reach the auth-state store fails closed and leaves authoring unavailable; it never falls back to an unsigned redirect.

Implement GitHub OAuth with PKCE as required by ADR 0004. Keep both cookies host-only, Secure, and HttpOnly, but preserve their distinct SameSite requirements: the instructor session cookie is SameSite=Strict; the short-lived OAuth state/PKCE cookie is SameSite=Lax so it returns on GitHub's top-level callback. Do not set a broad parent-domain cookie to share credentials between the auth, editor, and reader origins.

### 5.4 OAuth validation tests

Reject:

- foreign hosts;
- absolute URLs;
- protocol-relative URLs;
- encoded slash or backslash bypasses;
- unknown chapter slugs;
- malformed anchors;
- tampered state;
- mismatched cookie and state;
- expired state;
- replayed nonce.

Consume the state nonce exactly once and clear the state cookie on success or terminal failure.

### 5.5 Session behavior

- If /auth/start receives a valid existing instructor session, redirect directly to the validated editor target.
- Otherwise start GitHub OAuth.
- Keep PKCE verifier state server-side in the dedicated auth-state store.
- Keep the one-hour session initially, but preserve the active server changeset and browser recovery copy across expiry.
- On a 401 during editing, offer Reconnect to GitHub. After success, resume the same changeset and cursor anchor.
- Browser mutations continue to require the session-bound CSRF token and exact editor origin.

### 5.6 Transition from the current origin

During rollout, allow both the current /admin origin and the new editor origin in CORS. After the new flow has passed canary:

1. make /admin read-only or redirect-only so it can no longer issue writes under the old contract;
2. verify the contract-native advanced editor on the dedicated origin as the emergency authoring path;
3. remove the public reader origin from authoring CORS;
4. eventually serve no authoring bundle from the public origin.

---

## 6. Canonical content-contract changes

### 6.1 Chapter person relations and managed placement

Preserve every chapter-person relation, not only featured cards:

~~~ts
type ChapterPersonRelation = {
  personId: string;
  role: string;
  passageIds: string[];
};

type ManagedPlacement = {
  placementId: string;
  kind: "personFeature" | "media" | "embed" | "diagram" | "artifact";
  contentId: string;
  anchorPassageId: string;
  position: "before" | "after";
  orderAtAnchor: number;
  displayPreset: string;
};
~~~

The repository currently contains 29 chapter-person relations, of which 19 are featured. All 29 must round-trip. During migration, featured=true creates a person-feature placement; nonfeatured relations remain available to the scholarly/world layer without creating a card. Legacy export derives featured from placement existence so relation metadata and placement cannot disagree.

The canonical placement record is the only source of truth for managed-content position. The ordered prose body does not also own the position. The editor projects each placement into a noneditable atom at its resolved location, but that atom is not serialized back as prose. Dragging or moving an atom updates exactly one ManagedPlacement record.

For a person feature, contentId points to a frozen person-feature record containing personId and entityRevisionId. It references centralized person content and does not duplicate mutable biography, portrait, license, credit, or source text.

Required validation:

- placementId is globally stable and unique within the chapter;
- contentId resolves to an immutable managed-content record of the declared kind;
- anchorPassageId exists or has a valid replacement tombstone;
- orderAtAnchor is unique within one anchor/position pair or is normalized deterministically;
- the same placement cannot appear twice in the projected editor/public document;
- displayPreset is allowlisted;
- position is explicit.

### 6.2 Person projection

Define the versioned projection consumed by the renderer:

~~~ts
type PersonFeatureProjection = {
  placementId: string;
  personId: string;
  entityRevisionId: string;
  name: string;
  dates: string;
  role: string;
  teachingNote: string;
  biography: string;
  primarySources: Array<{
    sourceId: string;
    title: string;
    creator: string;
    locator?: string;
    translation?: string;
    excerpt?: string;
    teachingUse: string;
    label: string;
    url?: string;
  }>;
  portrait: {
    mediaVersionId: string;
    src: string;
    width: number;
    height: number;
    alt: string;
    credit: string;
    title: string;
    creator?: string;
    derivativeModification?: string;
    license: string;
    licenseUrl?: string;
    sourceUrl?: string;
    commonsPageUrl?: string;
    reviewedSourceRevision?: string;
  };
  displayPreset: "thinker-card";
};
~~~

The projection freezes every string, link, disclosure, credit, license, source revision, alt value, and image identity displayed by the existing card. A later biography or portrait update therefore does not silently alter history.

During Phase 1, import each curated person record as a versioned content object or create an equivalent immutable hash-addressed entity revision. The first canary does not require a general-purpose person editor, but every entityRevisionId must resolve to persisted bytes rather than a mutable repository lookup.

### 6.3 Checkpoint cardinality and ordering

Change checkpoint rules as follows:

- checkpointId remains unique;
- slot is no longer unique and is renamed or treated as an optional pedagogical label;
- add displayOrder as a nonnegative integer;
- allow multiple checkpoints on the same passage;
- allow zero checkpoints;
- order sidebar prompts by passage order, then displayOrder, then checkpointId;
- retain stage and strategy as metadata, not cardinality controls.

Suggested next schema:

~~~ts
type PromptCheckpoint = {
  checkpointId: string;
  legacyId?: string; // migration alias only; never the canonical identity
  passageId: string;
  passageExcerptHash: string; // server-owned derived drift receipt
  displayOrder: number;
  stage?: string;
  slotLabel?: string;
  strategy: CheckpointStrategy;
  title: string;
  trigger: string;
  prompt: string;
  guidance: string;
  responseStructure: "prose" | "movement-plus-prose";
  minWords: number;
  maxWords: number;
  showInSidebar: boolean;
  rationale: string;
  editorialApprovalId?: string; // preserved legacy provenance; never gates routine commitLive
};
~~~

The checkpoint record is canonical. The inline checkpoint marker is a shared-renderer projection keyed only by checkpointId; it is not a second checkpoint record and is not serialized into the prose body. passageExcerptHash is recomputed by the server whenever the anchored passage text changes. It detects anchor drift but must not make an ordinary prose edit unsaveable. Deleting the passage still requires an explicit replacement or checkpoint removal.

legacyId is retained only as an import/export alias so existing references remain resolvable. editorialApprovalId records an approval that happened under the older workflow; its absence never blocks a routine human or properly scoped agent commitLive under the new one-click Save contract.

### 6.4 Prose, managed content, and editor projection

The canonical chapter keeps:

- ordered editable prose/semantic body nodes;
- typed managed-content records;
- one ManagedPlacement collection;
- one canonical checkpoint collection.

The shared projector interleaves these sources into the public/editor order. The visual editor’s serializer must:

- serialize editable prose from the editor state;
- ignore the rendered internals and transient runtime state of managed atom nodes;
- preserve placement references by placementId;
- reject duplicate IDs;
- reject silent deletion of a managed placement unless a remove operation exists;
- never parse the rendered HTML of a managed node back into content data.

Whole-chapter replacement changes prose by default and preserves managed placements/checkpoints. Removing them requires explicit operations shown in the replacement preview.

### 6.5 Semantic operations

Add or standardize these operations:

~~~ts
type SemanticOperation =
  | ReplaceText
  | ReplaceChapterDocument
  | InsertNode
  | MoveNode
  | RemoveNode
  | RetireAnchor
  | UpsertCheckpoint
  | RemoveCheckpoint
  | PlaceMedia
  | UpsertEmbed
  | UpsertPersonFeature
  | MoveManagedPlacement
  | RemoveManagedPlacement;
~~~

Use the following domain names in OpenAPI and audit history:

- personFeature.upsert
- managedPlacement.move
- managedPlacement.remove
- checkpoint.upsert
- checkpoint.remove
- chapter.replaceDocument

InsertNode, MoveNode, and RemoveNode operate only on editable prose/semantic body nodes. Checkpoints and managed content cannot be inserted or positioned with those generic operations; their dedicated operations update the one canonical checkpoint or ManagedPlacement source of truth.

### 6.6 Stable-ID behavior

Ordinary word, sentence, formatting, and link edits must not alter block, passage, section, checkpoint, placement, or figure identity.

Whole-chapter paste uses a reconciliation preview:

1. exact stable markers, when present;
2. unchanged semantic blocks;
3. heading and neighboring-text similarity;
4. explicit new identity allocation;
5. dependency report for removed anchors.

The editor must not reject a one-word change because an unrelated anchor or managed node was duplicated by its serializer. Round-trip correctness is a contract test, not a best-effort behavior.

### 6.7 Public projection contract

Add a renderer-owned immutable projection:

~~~ts
type PublicChapterProjection = {
  schemaVersion: number;
  projectionId: string;
  documentId: string;
  slug: string;
  revisionId: string;
  chapterVersion: string;
  rendererVersion: string;
  stylesheetHash: string;
  projectionHash: string;
  title: string;
  subtitle?: string;
  description: string;
  bodyHtml: string;
  sidePanel: {
    checkpoints: PublicCheckpointProjection[];
    modules: PublicSidePanelModule[];
  };
  managedAssets: PublicAssetReference[];
  generatedAt: string;
};
~~~

The hash covers canonicalized projection bytes, including complete ordered chapter-root HTML, side-panel data, managed-asset identities, renderer version, stylesheet hash, and schema version. generatedAt is metadata and is excluded from the hashed bytes. projectionId is derived from the projection hash.

The same content revision may receive a new immutable projection after an approved renderer or stylesheet release. PublicChapterHead pins projectionId, projectionHash, content revision, renderer version, stylesheet hash, and schema version together.

### 6.8 Backward compatibility

During migration:

- legacyMarkup remains locked and renderable;
- current world.json fields remain intact;
- current link-based scholar placement remains only as an import fallback;
- existing static scholar-card placement code remains until parity is proven;
- old clients may read current endpoints but cannot write a newer schema they do not understand;
- the API rejects a write with CONTRACT_VERSION_MISMATCH instead of down-converting it.

---

## 7. Shared projection and rendering

### 7.1 Projection pipeline

The projection pipeline is pure and deterministic:

~~~text
validated chapter revision
  + frozen people/entity revisions
  + media/version/rights records
  + embed adapter records
  + checkpoints
  + renderer version
        |
        v
ordered ChapterProjection
        |
        +--> public HTML fragments
        +--> editor node views
        +--> protected preview
        +--> print/offline projection
        +--> normalized DOM test form
~~~

It must perform no network request. Wikimedia refresh, provider resolution, and media processing happen before projection.

Every managed item is rendered by one shared primitive. The editor may decorate that exact output with selection and inspector controls; it may not maintain a second media, embed, checkpoint, or scholar-card renderer. The shared stylesheet is versioned and its hash is part of projection identity.

### 7.2 Renderer contexts

| Context | Same content markup | Context-only additions |
|---|---|---|
| Public reader | Yes | reader controls, checkpoint response UI |
| Instructor editor | Yes | selection outlines, insertion handles, inspector links, contenteditable wrappers |
| Protected preview | Yes | preview banner |
| Print | Same semantics | print-specific expansion and provider links |
| Offline/no-JS | Same semantics | fallbacks, transcripts, canonical URLs |

Editor-only controls must wrap or decorate shared markup. They must not replace it with a placeholder.

### 7.3 Required rendering support

The first shared-renderer release must cover:

- paragraph, heading, list, blockquote, table, code block;
- links, emphasis, strong emphasis, inline code;
- callout and key-point panels;
- checkpoint inline markers and side-panel records;
- person-feature scholar cards;
- still image and responsive figure;
- animated GIF/WebP poster and controls;
- audio, short video, PDF/document card;
- YouTube, Vimeo, X, Spotify, SoundCloud, Bluesky, and rich-link fallback;
- diagrams, artifacts, and temporarily locked legacy markup;
- captions, credits, licenses, alt text, transcript/equivalent, and source links.

### 7.4 WYSIWYG parity rule

The default, nonactivated editor rendering must match the public reader after removing:

- contenteditable;
- selection state;
- insertion handles;
- editor toolbar controls;
- inspector data attributes;
- author-only status labels.

A normalized-DOM parity test is required. Also compare the shared stylesheet hash and representative computed styles. Visual screenshots supplement these tests but do not replace them.

Runtime activation state is never canonical content. Playing/stopping a GIF or activating an X/YouTube preview may change live DOM, but Save serializes the typed media/embed record, not that DOM. Tests must activate each kind, edit nearby prose, Save, and prove that no playback/provider state entered the canonical revision.

### 7.5 Security

- Escape prose and metadata by construction.
- Sanitize imported rich text before converting it to editor nodes.
- Do not pass canonical content through innerHTML except for HTML created by the shared trusted renderer.
- Legacy markup remains locked and passes the existing sanitizer.
- Embed adapters emit allowlisted sandbox and permission attributes.
- No script, style, event-handler, srcdoc, javascript URL, or arbitrary iframe attribute is accepted from content.

### 7.6 Static fallback

The Astro build continues to emit a complete, readable chapter for every route. At request time, the site Worker replaces marked projection slots only when a valid public head is available.

If the projection service is unavailable or the projection fails hash verification:

- return the static chapter;
- add an internal fallback diagnostic header;
- emit an operational alert;
- never expose a draft or partially rendered projection.

This keeps the textbook readable during a D1 or Worker incident while allowing ordinary saved content to appear immediately under normal operation.

---

## 8. Instructor editor design

### 8.1 Authoring shell

Create a dedicated instructor application that reuses the reader’s design tokens, content width, typography, header spacing, scholar components, and side-panel layout.

The normal chapter view contains:

- a slim sticky author bar;
- the shared chapter canvas;
- a contextual right-side inspector;
- subtle insertion affordances between semantic nodes;
- no global chapter picker in the common path.

The author bar contains:

| Control | Behavior |
|---|---|
| Done | Return to the public chapter at the matching anchor |
| Save | Validate internally and commit the chapter live |
| Save state | All changes saved, Unsaved changes, Saving, Saved and live, or Save needs attention |
| History | Open the revision-history drawer |
| More | Whole-chapter import, duplicate-safe Markdown view, advanced preview, and link to legacy admin during rollout |

Do not show Review, Validate, Submit review, or deployment controls in the normal chapter-editing bar.

### 8.2 Continuous document behavior

The prose canvas must feel like a conventional document editor:

- click anywhere in prose to type;
- select text and use the formatting toolbar;
- paste multiple paragraphs or an entire chapter;
- use Enter, Backspace, arrow keys, and standard selection behavior;
- drag or use keyboard commands to move managed nodes;
- use native undo/redo shortcuts;
- keep a visible page flow instead of a stack of boxed blocks.

The editor remains structurally typed underneath. A paragraph is still a passage node, and media remains a managed atom node, but the UI does not expose storage terminology such as blockId, replacement block, or managed block.

### 8.3 Toolbar

The persistent toolbar supports:

- paragraph and heading levels;
- bold, italic, underline where allowed;
- bulleted and numbered lists;
- blockquote and approved callout styles;
- link insertion and editing;
- table insertion where supported;
- Checkpoint;
- Media;
- Embed;
- Person/Scholar;
- undo and redo.

Every toolbar action must:

- have an accessible name and visible focus style;
- either change the document or open a visible dialog/inspector;
- place focus inside the opened interface;
- announce validation errors near the relevant field;
- never fail silently.

### 8.4 Contextual inspector

Selecting a managed node opens an inspector rather than exposing its HTML.

Inspector types:

- Checkpoint;
- Image/GIF;
- Audio/video/document;
- External embed/rich link;
- Person feature;
- Diagram/artifact;
- Link;
- Chapter metadata.

Common inspector controls:

- move before/after passage;
- display preset;
- replace;
- duplicate when valid;
- remove;
- open source record;
- show version/provenance;
- show accessibility and rights state.

### 8.5 Checkpoint insertion flow

Checkpoint must work as follows:

1. The instructor places the cursor in or near a passage.
2. Checkpoint opens a focused inspector or dialog.
3. The passage anchor defaults to the nearest passage.
4. The form provides sensible stage/strategy defaults but no fake prompt text.
5. Required fields are completed before Add checkpoint is accepted.
6. The checkpoint appears inline and in the side-panel preview.
7. The chapter becomes dirty.
8. Save publishes the checkpoint with the chapter revision.

Clicking Checkpoint must never insert an empty paragraph or an invalid checkpoint into the canonical document.

### 8.6 Media insertion flow

Media opens a chooser with:

- Upload;
- Existing library;
- Wikimedia/curated library;
- recent items.

For a new upload:

1. issue the existing bounded quarantine upload ticket;
2. upload directly to R2 quarantine;
3. show progress and processing state;
4. require or derive media type, alt text, caption or omission reason, credit, license, and teaching use;
5. wait for the existing processor to mark a version ready;
6. insert a typed placement at the cursor;
7. render the real figure immediately.

The dialog must remain open with a clear failure state if upload, processing, or validation fails.

#### 8.6.1 Rights-clearance path

Media may become ready for immediate insertion only through one of these deterministic paths:

1. reuse an already cleared immutable media version;
2. upload instructor-created/owned media, with the authenticated instructor making the ownership declaration and selecting an allowlisted license, followed by hash/MIME/malware/accessibility checks;
3. import a Wikimedia asset whose exact source revision, creator, credit, canonical source URL, and machine-readable license match the reviewed allowlist and pass provenance checks.

Those paths retain the existing status=cleared value and add a typed clearance object:

~~~ts
type RightsClearance = {
  basis: "humanApproval" | "policy";
  policyVersion?: string;
  evidenceReceiptId?: string;
};
~~~

humanApproval requires the existing approvedBy/approvedAt/subject-hash evidence. policy requires both policyVersion and evidenceReceiptId and may be written only by the reviewed rights-policy service after its deterministic checks. The result is not an agent approval of unknown rights. A third-party upload with unclear ownership, an unrecognized license, incomplete attribution, or conflicting metadata remains status=reviewRequired and cannot be inserted into a live projection until the separate human rights workflow clears it. An agent may prepare the metadata and upload, but it cannot make the instructor ownership declaration, create clearance evidence, or override reviewRequired.

The production canary uses a new instructor-owned image/GIF or a newly imported allowlisted Wikimedia revision, so it exercises a real upload without depending on an unresolved rights review.

### 8.7 Embed insertion flow

Embed opens a URL field with provider detection:

1. normalize and validate the URL server-side;
2. resolve only through the allowlisted adapter registry;
3. show the fallback title, summary, creator/date, poster, caption, and teaching use;
4. allow an optional provider-preview activation;
5. insert a typed externalEmbed or richLink node;
6. render the same fallback used by the public reader.

The editor does not accept embed HTML.

### 8.8 Person-feature insertion flow

Person/Scholar opens a searchable list of curated people:

1. choose a person;
2. inspect the portrait, biography summary, dates, role, credit, and license;
3. choose the thinker-card preset;
4. choose the passage placement;
5. create or select the immutable person-feature record and create exactly one ManagedPlacement;
6. project the editor-only person-feature atom and render the complete card in place.

If a new person record is needed, open the advanced person-record workflow. Do not make the chapter dialog an untyped biography editor.

### 8.9 Whole-chapter paste and import

Support two related actions:

**Direct paste**

- Pasting several paragraphs into the canvas inserts them at the cursor.
- Pasted rich text is sanitized and normalized.
- Word/Google Docs styles are removed while semantic headings, lists, emphasis, and links are retained.

**Replace chapter**

- Paste or import a complete chapter into a dedicated replacement dialog.
- Show a rendered preview before applying.
- Show stable-ID matches, new IDs, removed anchors, and affected checkpoints/placements.
- Offer explicit reanchor choices before destructive dependencies are removed.
- Apply the replacement to the editor state only; Save remains the live commit.

Markdown mode remains an advanced escape hatch. Switching modes must round-trip every supported node type without duplication or disappearance.

### 8.10 Draft preservation

Use three layers:

1. Tiptap/ProseMirror undo history for the current session;
2. the existing server changeset as the resumable working draft;
3. a small instructor-only browser recovery record keyed by user, chapter, base revision, and changeset.

The recovery record:

- contains no student data;
- is cleared after verified Save or explicit Discard;
- expires automatically;
- is offered only when it is newer than the server draft;
- never silently overwrites a newer canonical revision.

### 8.11 Save-state behavior

| State | UI | Allowed action |
|---|---|---|
| Clean | All changes saved | Done |
| Dirty and locally valid | Unsaved changes | Save |
| Saving | Saving… | Wait; repeated click is ignored |
| Saved | Saved and live | Done or continue editing |
| Inline validation issue | Save needs attention | Fix highlighted item; no separate validation page |
| Network uncertainty | Confirming public version… | Safe idempotent retry |
| Revision conflict | Newer version exists | Compare and rebase; preserve current work |
| Session expired | Reconnect to GitHub | Authenticate and resume |

If Done is selected while dirty, show Save and return, Discard, and Continue editing.

---

## 9. Atomic one-click Save and immediate public delivery

### 9.1 New commit endpoint

Add:

~~~text
POST /v1/changesets/{changesetId}:commitLive
~~~

Request:

~~~json
{
  "documentId": "chapter_ch07",
  "baseRevisionId": "revision_...",
  "expectedVersion": 14,
  "idempotencyKey": "uuid",
  "operations": [
    {
      "type": "chapter.replaceDocument",
      "document": {}
    }
  ]
}
~~~

The browser may send one final replaceDocument operation, while agents may send a bounded semantic operation batch. Both paths use the same validation and transaction.

Successful response:

~~~json
{
  "commitReceiptId": "commit_...",
  "changeSetId": "changeset_...",
  "documentId": "chapter_ch07",
  "revisionId": "revision_...",
  "contentHash": "sha256...",
  "projectionId": "projection_...",
  "projectionHash": "sha256...",
  "publicUrl": "https://ethicsandai.your-digital-life.org/chapter/aristotle-character-and-ai-assisted-life/",
  "savedAt": "2026-08-03T...",
  "deliveryStatus": "verified",
  "noOp": false,
  "live": true
}
~~~

Response protocol:

- 200 with noOp=true when the submitted normalized content already equals the current head; create no revision or history entry, but verify and return the current public projection;
- 201 with deliveryStatus=verified and live=true only after the actual public chapter route returns the matching revision/projection identity;
- 202 with deliveryStatus=confirmation_pending, committed=true, live=false, the committed IDs, commitReceiptId, Retry-After: 2, statusUrl, and statusExpiresAt when D1 committed but the public route could not yet be verified;
- 409 when the same idempotency key is reused with a different request body.

Replaying the exact same POST body and idempotency key never creates another revision. It re-verifies delivery and returns 201 when the public route matches, or 202 while confirmation remains pending.

#### 9.1.1 Confirmation-status endpoint

Add this exact route to the OpenAPI contract:

~~~text
GET /v1/live-commits/{commitReceiptId}
~~~

The receipt ID is opaque and server-issued. A browser request requires an active instructor session and may read only a receipt created by that instructor. An agent request requires a still-valid bearer capability whose actor/client and allowedDocumentIds include the receipt's document. The endpoint accepts no idempotency key, makes no content mutation, and rechecks the actual public chapter response headers.

Pending response:

~~~json
{
  "commitReceiptId": "commit_...",
  "changeSetId": "changeset_...",
  "documentId": "chapter_ch07",
  "revisionId": "revision_...",
  "projectionId": "projection_...",
  "projectionHash": "sha256...",
  "publicUrl": "https://ethicsandai.your-digital-life.org/chapter/aristotle-character-and-ai-assisted-life/",
  "deliveryStatus": "confirmation_pending",
  "committed": true,
  "live": false,
  "statusExpiresAt": "2026-08-04T..."
}
~~~

- return 202 plus Retry-After while the public identity is not yet confirmed;
- return 200 with deliveryStatus=verified and live=true once both public headers match;
- retain the pollable status and exact-POST idempotent replay window for 24 hours;
- after statusExpiresAt, return 410 STATUS_WINDOW_EXPIRED with revisionId, projectionId, publicUrl, and the version-history URL; the immutable commit receipt and history remain retained;
- use capped exponential polling at 2, 4, 8, then 15 seconds, and stop at expiry or user exit.

### 9.2 Server algorithm

The endpoint performs:

1. authenticate actor and require content:write;
2. for an agent, additionally require content:live-save;
3. validate request shape and idempotency key;
4. load the current canonical head, working document, and exact active authority_registry row from the primary D1 session;
5. require that exact authority row to be active and D1-authoritative, then enforce base-revision and working-version compare-and-swap preconditions;
6. apply the submitted operations in memory;
7. run structural, stable-ID, dependency, media, rights, accessibility, and embed validation;
8. finalize a deterministic immutable chapter revision;
9. build the complete public projection with the shared renderer;
10. calculate content and projection hashes;
11. execute one transaction-aborting D1 batch that writes:
    - a guarded live-commit command/receipt;
    - final working document bytes, hash, and version;
    - document revision;
    - semantic operations;
    - public projection manifest/fragments;
    - canonical document head;
    - public chapter head;
    - changeset state;
    - audit event;
    - immutable idempotency request hash and commit-receipt mapping;
    - initial delivery-status row with confirmation_pending and 24-hour status expiry;
12. fetch the actual public chapter delivery path and verify its revision and projection headers;
13. when verified, update only the delivery-status observation with verified_at and the observed public evidence; then return 201 verified, otherwise return 202 confirmation_pending.

The endpoint must not make a provider, Wikimedia, GitHub, or R2 network request inside the commit transaction.

### 9.3 Correct compare-and-swap

The current save path checks the affected-row count after a D1 batch. That is insufficient if the remaining statements have already committed.

Use the repository’s existing serialized-command pattern: add a live_commit_commands table whose row records the server-loaded expected_authority_id in addition to expected canonical head and expected working-document version. Its BEFORE INSERT triggers must:

1. require an exact active authority_registry row with id=expected_authority_id, the target document ID, active=1, and authority='d1', otherwise RAISE(ABORT, "D1_AUTHORITY_REQUIRED");
2. compare the expected canonical head and working-document version, otherwise RAISE(ABORT, "REVISION_CONFLICT").

The guarded command insert is the first statement in the D1 batch. Retain the command row as the immutable commit receipt. The old Chapter 7 canary exception does not apply to commitLive: every chapter, including Chapter 7, must have an active D1 authority row before the new endpoint can advance it.

Minimum receipt shape:

~~~sql
CREATE TABLE live_commit_commands (
  command_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  changeset_id TEXT NOT NULL,
  idempotency_key_hash TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  expected_authority_id TEXT NOT NULL,
  expected_revision_id TEXT NOT NULL,
  expected_working_version INTEGER NOT NULL,
  committed_revision_id TEXT NOT NULL,
  projection_id TEXT NOT NULL,
  public_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (actor_id, idempotency_key_hash)
);

CREATE TABLE live_commit_delivery_status (
  command_id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('confirmation_pending', 'verified')),
  last_checked_at TEXT,
  verified_at TEXT,
  observed_revision_id TEXT,
  observed_projection_hash TEXT,
  status_expires_at TEXT NOT NULL,
  FOREIGN KEY (command_id) REFERENCES live_commit_commands(command_id)
);
~~~

Use a two-stage idempotency model for commitLive:

- live_commit_commands and the idempotency request-hash mapping are immutable and transactionally prove what committed;
- live_commit_delivery_status is a separate one-to-one operational observation containing state, last_checked_at, verified_at, observed revision/projection headers, and status_expires_at;
- the existing generic cached-response short circuit must not be used for this endpoint;
- an exact replay first checks request-hash equality, then returns the stored verified response when verified or rechecks the public route when pending;
- a pending replay may promote only the delivery-status row from confirmation_pending to verified; it never rewrites the commit receipt or creates another revision;
- the same key with a different normalized request hash returns 409.

Cloudflare documents D1 batches as transactions that roll back the complete sequence when a statement fails. Acceptance nevertheless requires real local-D1 tests—not fake database tests—in which exactly one of two concurrent commits advances the head and in which an authority change between preflight and guarded batch aborts the Save. A losing attempt creates no revision, final working version, public projection, applied changeset, command receipt, or success idempotency record.

### 9.4 Public projection tables

Add immutable public-only records in the existing content D1 database:

~~~sql
CREATE TABLE public_chapter_projections (
  projection_id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  projection_hash TEXT NOT NULL UNIQUE,
  schema_version INTEGER NOT NULL,
  renderer_version TEXT NOT NULL,
  stylesheet_hash TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (revision_id, renderer_version, schema_version, stylesheet_hash)
);

CREATE TABLE public_chapter_fragments (
  projection_id TEXT NOT NULL,
  fragment_name TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  content_text TEXT NOT NULL,
  PRIMARY KEY (projection_id, fragment_name)
);

CREATE TABLE public_chapter_heads (
  document_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  revision_id TEXT NOT NULL,
  projection_id TEXT NOT NULL,
  projection_hash TEXT NOT NULL,
  renderer_version TEXT NOT NULL,
  stylesheet_hash TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
~~~

Initial fragments:

- document-head-html;
- chapter-root-html;
- outline-html;
- side-panel-json;
- chapter-meta-json;
- managed-assets-json.

Splitting fragments keeps individual rows safely below D1’s row-size limit and allows the Worker to fetch only what it needs.

### 9.5 Public projection read surface

Create a small internal Public Projection Worker or an internal Content API service route that:

- accepts GET by known slug or document ID;
- reads only public_chapter_heads, public_chapter_projections, and public_chapter_fragments;
- verifies fragment and projection hashes;
- returns no draft, actor, audit, rights-review, session, or changeset data;
- exposes no mutation method;
- is reachable by the site Worker through a Cloudflare service binding, not public editorial credentials.

The site Worker itself should not receive a Content API bearer token.

The chosen same-D1 design is a logical/code boundary, not a table-level database permission boundary: the trusted Public Projection Worker’s D1 binding is technically capable of querying other tables. Its reviewed code, generated query allowlist, tests, and deployment policy restrict it to public_* tables; the anonymous Site Worker has no D1 binding at all. A separate public D1 would provide stronger database isolation but would sacrifice the same-transaction publication guarantee, so it is not selected for this implementation.

### 9.6 Site Worker delivery

Generalize [workers/site/src/index.mjs](../workers/site/src/index.mjs) from Chapter 7 to every D1-authoritative chapter.

For a public chapter request:

1. load the existing static Astro response;
2. request the current immutable public projection;
3. verify the projection;
4. use Cloudflare HTMLRewriter to replace the title/subtitle, one complete ordered chapter-root slot, outline, and side-panel slots;
5. update the document title, description, and authoring-neutral revision metadata;
6. set the public revision and projection hash in response headers and page metadata;
7. return the transformed HTML.

The chapter-root slot spans prose plus every inline concept diagram, artifact, scholar card, media/embed, and release placement. For a D1-authoritative chapter, the old independent placement passes must not remain as siblings. The transformation must work without browser JavaScript, and every managed placement must appear exactly once.

Remove the current Chapter 7-only client replacement after the new server-side path passes parity tests.

### 9.7 Caching

Initial canary:

- perform one indexed public-head read per chapter request;
- read the mutable public head from the D1 primary path; do not permit a stale read replica to choose the revision;
- cache immutable fragments by projection hash;
- set D1-authoritative chapter HTML to Cache-Control: no-cache, must-revalidate and prohibit an edge rule from serving an unvalidated mutable head;
- return an ETag derived from the projection hash;
- return X-Textbook-Revision and X-Textbook-Projection-Hash on the actual public chapter response;
- expose the verification headers only to the dedicated editor origin, or provide an equivalent public read-only verification endpoint;
- keep static assets under their existing long-lived caching.

After observing real usage, optimize only if D1 read volume threatens the budget. Correct immediate publication is more important than premature pointer caching.

### 9.8 Failure semantics

The server response must distinguish:

- validation failure: no canonical/public change;
- CAS conflict: no canonical/public change;
- verified idempotent replay: return the stored verified result;
- pending idempotent replay: recheck actual public delivery and either promote the delivery observation or return 202 again;
- no-op save: return the existing verified head without a new revision;
- projection failure before transaction: no canonical/public change;
- D1 transaction failure: no canonical/public change;
- public-route verification failure after commit: return 202 confirmation_pending with committed IDs and let the exact same request/key or status URL recheck it.

The browser clears its dirty state once the server proves the content is committed, but keeps its recovery copy until delivery verifies. It says Saved and live only after matching the actual public route. While 202 persists, it says Saved; public confirmation pending. It must never report Not saved when the immutable revision actually committed.

### 9.9 Validation without a validation ritual

Validation still exists; it moves inside Save.

For fixable local issues, the editor validates continuously and marks the relevant field before Save. Server validation remains authoritative.

Examples:

- empty checkpoint prompt: checkpoint inspector;
- missing alt text: media inspector;
- deleted anchor: placement/checkpoint inspector;
- unresolved media processing: media card;
- invalid embed URL: embed dialog;
- revision conflict: conflict drawer.

There is no separate global Validate button in the common workflow.

---

## 10. Version history and restoration

### 10.1 History drawer

Integrate existing revision history into the authoring shell.

Each entry shows:

- saved time in the instructor’s locale;
- actor name and type;
- agent client/run when applicable;
- revision ID;
- concise semantic summary;
- public/live badge;
- restored-from lineage;
- View, Compare, and Restore controls.

### 10.2 Diff presentation

Show human-readable changes:

- paragraph text added/removed;
- heading changed;
- checkpoint added/edited/removed/moved;
- person feature added/moved/removed;
- media or embed added/replaced/moved/removed;
- caption, alt text, credit, rights, or display-preset change;
- stable anchor retired or replaced.

Do not make raw JSON the default history view.

### 10.3 Restore behavior

Restore:

1. selects an immutable historical revision;
2. creates a new changeset based on the current live head;
3. loads the historical content into the working document;
4. records restoredFromRevisionId;
5. shows the resulting diff against current live content;
6. requires Save to create a new live revision.

The historical record remains unchanged.

### 10.4 Retention

- retain immutable chapter revisions and public projections;
- retain audit and restore lineage;
- retain media objects according to existing rights/backup policy;
- permit later archival/compaction only through a separate retention ADR;
- never hard-delete a revision through the browser or agent API.

---

## 11. Agent-native API, MCP, and Skills

### 11.1 OpenAPI additions

Add or revise:

| Method and route | Purpose |
|---|---|
| GET /v1/chapters/{id}/authoring-view | Complete canonical document plus frozen renderer/entity/media/checkpoint projection |
| POST /v1/changesets | Create/resume a chapter changeset |
| POST /v1/changesets/{id}/operations:batch | Apply bounded semantic operations atomically to the working draft |
| POST /v1/changesets/{id}:commitLive | Validate, version, project, and publish one chapter |
| GET /v1/live-commits/{commitReceiptId} | Recheck the actual public delivery identity for a committed Save; 202 pending, 200 verified, 410 after the 24-hour status window |
| GET /v1/chapters/{id}/revisions | Paginated immutable history |
| GET /v1/chapters/{id}/revisions/{revisionId} | One immutable revision and semantic metadata |
| POST /v1/chapters/{id}/revisions/{revisionId}:restoreAsDraft | Restore old content into a new draft |
| GET /v1/persons | Search curated person records |
| GET /v1/persons/{id} | Read one person and current immutable projection |

Keep current routes during compatibility, but mark the two-call replaceBody plus saveLive browser path deprecated after commitLive ships.

The same versioned API bundle defines these Auth/Capability Worker routes:

| Method and route | Authentication and purpose |
|---|---|
| POST /auth/agent-capability-requests | Rate-limited device-flow request; creates no capability and returns one-time approval/exchange material |
| POST /auth/agent-capability-requests/{requestId}:approve | Instructor session + CSRF; recent GitHub step-up and explicit confirmation when live-save is requested |
| POST /auth/agent-capability-requests/{requestId}:exchange | One-time device-secret exchange; returns the bearer once |
| POST /auth/agent-capabilities/{jti}:revoke | Instructor session + CSRF or protected service admin; immediately revokes the grant |
| Service-binding RPC verifyAgentCapability(token, target) | Named Auth/Capability Worker entrypoint not exposed by public fetch; verifies the original bearer and returns bounded claims to each enforcing service |

### 11.2 MCP tools

Expose:

- get_authoring_view
- get_passage
- replace_passage_text
- replace_chapter_document
- upsert_checkpoint
- remove_checkpoint
- upload_media
- place_media
- upsert_embed
- upsert_person_feature
- move_managed_placement
- remove_managed_placement
- preview_changes
- commit_live
- get_live_commit_status
- get_version_history
- restore_revision_as_draft

Every mutation tool returns:

- operation ID;
- changeset ID;
- document ID;
- base revision;
- working version;
- result hash;
- validation warnings.

commit_live additionally returns the exact public URL, revision ID, content hash, projection ID/hash, and verified/pending delivery state.

### 11.3 Capability policy

| Capability | Browser instructor | Normal agent token | Explicit live-save agent token |
|---|---:|---:|---:|
| Read canonical content | Yes | Yes | Yes |
| Edit working draft | Yes | Yes | Yes |
| Preview/diff | Yes | Yes | Yes |
| Save live chapter | Yes | No | Yes |
| Approve unknown rights | No | No | No |
| Change authority | No | No | No |
| Deploy code/schema | No | No | No |
| Hard-delete history | No | No | No |

The token must bind:

- actor/client;
- audience;
- allowedDocumentIds;
- allowedOperations;
- content:live-save when granted;
- issued-at and short expiry;
- run ID;
- unique jti.

Enforce those claims independently at both the MCP Worker and Content API. A Skill instruction is never the authorization boundary.

Change [scripts/mcp/run-codex-with-capability.mjs](../scripts/mcp/run-codex-with-capability.mjs) so its default token does not include content:live-save. Live Save must be an explicit per-run option that also requires a bounded document allowlist; for example, an operator-approved --allow-live-save plus --document chapter_ch07. Log issuance and use by jti. Keep the live-save token lifetime short and make emergency revocation possible.

#### 11.3.1 Capability issuance, propagation, and revocation

The Auth/Capability Worker is the sole production issuer. The local scripts stop self-signing arbitrary claims from a shared Keychain secret. They become clients of a one-time, instructor-approved device flow:

1. run-codex-with-capability.mjs posts the requested clientId, runId, scopes, allowedDocumentIds, allowedOperations, and lifetime to POST /auth/agent-capability-requests;
2. the Worker returns a requestId, device secret, short user code, verification URL, five-minute request expiry, and polling interval;
3. the helper opens or prints the verification URL;
4. an authenticated instructor sees the exact requested documents/operations; any live-save request requires a GitHub step-up no older than five minutes plus an explicit Approve live Save action;
5. POST /auth/agent-capability-requests/{requestId}:approve records the approval but never exposes the bearer token to the browser;
6. the helper exchanges the one-time device secret at POST /auth/agent-capability-requests/{requestId}:exchange and receives the bearer token exactly once;
7. edit-only capabilities expire in at most 15 minutes; live-save capabilities expire in at most 10 minutes.

POST /auth/agent-capabilities/{jti}:revoke requires an authenticated instructor session and CSRF token but no step-up, so emergency revocation is fast. The instructor can revoke any capability they issued. A protected service admin can revoke any capability.

Store no plaintext bearer token:

~~~sql
CREATE TABLE agent_capability_grants (
  jti TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  claims_hash TEXT NOT NULL UNIQUE,
  scopes_json TEXT NOT NULL,
  allowed_document_ids_json TEXT NOT NULL,
  allowed_operations_json TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_by TEXT,
  revocation_reason TEXT,
  issuance_request_id TEXT NOT NULL UNIQUE
);
~~~

The one-time request/device-secret records live in a separate short-retention table in the same dedicated auth-state D1 and are deleted or marked consumed on exchange. The Auth/Capability Worker has no editorial-content D1 binding.

Both the MCP Worker and Content API independently call the Auth/Capability Worker's named service-binding RPC entrypoint verifyAgentCapability(token, target) with the original bearer token. That entrypoint is not routed through the public fetch handler, and a deployment test proves that no /internal verification URL is externally reachable. Verification checks signature, claims hash, audience, issued-at/expiry, jti grant state, revocation, scopes, documents, and operations. The MCP Worker forwards the original bearer token—not unsigned identity/allowlist headers—to the Content API over the internal service binding. Each layer independently maps the requested tool/route to a document and operation and rejects anything outside the returned claims.

The verifier and revocation store fail closed. Every agent mutation performs an uncached verification immediately before applying its operation or guarded batch. Only read-only agent calls may cache a positive result, for at most 15 seconds. Revoked, expired, unknown, mismatched, or unverifiable jti values produce no mutation. Issuance, exchange, verification use, failed use, and revocation are audited without recording the bearer token.

### 11.4 Skill updates

Update the repository Skills:

- [.agents/skills/ai-ethics-author-textbook-chapter/SKILL.md](../.agents/skills/ai-ethics-author-textbook-chapter/SKILL.md)
  - use authoring-view and semantic chapter operations;
  - support whole-chapter import;
  - call commit_live only after explicit publish/save language.
- [.agents/skills/ai-ethics-manage-prompt-checkpoints/SKILL.md](../.agents/skills/ai-ethics-manage-prompt-checkpoints/SKILL.md)
  - remove three-checkpoint assumptions;
  - support any number, repeated stages, movement, and sidebar controls.
- [.agents/skills/ai-ethics-publish-textbook-media/SKILL.md](../.agents/skills/ai-ethics-publish-textbook-media/SKILL.md)
  - upload, process, caption, credit, place, preview, and optionally commit live.
- [.agents/skills/ai-ethics-release-steward/SKILL.md](../.agents/skills/ai-ethics-release-steward/SKILL.md)
  - distinguish chapter live Save from protected code/authority release.

Add examples for:

- insert an image after a named passage with alt text, caption, and credit;
- add a second checkpoint to the same passage;
- insert a YouTube fallback;
- move Aquinas after a new passage;
- save and publish the completed chapter;
- restore a prior revision, edit it, and save as a new revision.

### 11.5 Agent safeguards

- Require explicit user publication intent in the Skill before commit_live.
- Require an independently issued live-save token; Skill prose alone grants nothing.
- Reject ambiguous chapter titles; resolve to exact ID and slug.
- Read the latest head immediately before mutation.
- Carry CAS and idempotency on every operation.
- Read back the live public projection after commit.
- Report exact revision and public URL.
- On conflict, preserve operations and request or perform an explicit rebase; never overwrite.

### 11.6 Conformance

The browser authoring client, hosted MCP Worker, local MCP package, and Skill examples must pass the same OpenAPI fixtures. No client may invent fields outside the contract.

---

## 12. Repository implementation map

### 12.1 New files and packages

~~~text
apps/
  instructor-editor/
    astro.config.mjs
    package.json
    wrangler.jsonc
    src/
      host-worker.mjs
      generated/
        chapter-routes.json
      components/
        AuthorBar.astro
        ChapterAuthoringCanvas.tsx
        ContextInspector.tsx
        HistoryDrawer.tsx
        InsertCheckpointDialog.tsx
        InsertEmbedDialog.tsx
        InsertMediaDialog.tsx
        InsertPersonFeatureDialog.tsx
        SaveConflictDrawer.tsx
      editor/
        extensions/
          checkpoint.ts
          media-figure.ts
          external-embed.ts
          person-feature.ts
          stable-heading.ts
          stable-passage.ts
        paste.ts
        schema.ts
        serialize.ts
      pages/
        chapter/[slug]/index.astro
        advanced/[slug]/index.astro
        index.astro
      styles/
        authoring.css

packages/
  authoring-client/
  chapter-renderer/

workers/
  public-projection/
    src/index.mjs
    wrangler.jsonc

tests/
  browser/
    reader-to-editor.spec.ts
    checkpoint-authoring.spec.ts
    media-authoring.spec.ts
    scholar-card-parity.spec.ts
    save-history-conflict.spec.ts
    privacy-network.spec.ts
  visual/
    unified-authoring.spec.ts
  fixtures/
    authoring/
~~~

Exact framework file extensions may change during the Phase 0 spike, but the responsibility boundaries must not.

Add apps/* to the root npm workspace configuration, give the instructor app its own build and deployment scripts, and ensure the public build does not include or preload the authoring application bundle.

Add root scripts for build:editor, test:browser, test:visual, test:a11y, and deploy:editor. CI must build the reader and editor independently and fail if the public asset manifest unexpectedly includes an editor entry bundle.

### 12.2 Existing files to change

| File or area | Change |
|---|---|
| packages/content-contract/src/index.ts | Add personFeature, public projection, checkpoint ordering/cardinality, batch commit schemas |
| packages/content-contract/openapi/content-api.v1.openapi.json | Add authoring-view, commitLive, person-feature, history/restore responses |
| packages/content-repository/src/index.ts | Preserve and migrate complete world/person placement data |
| src/components/SiteHeader.astro | Add chapter overflow menu and Edit entry |
| src/components/ReaderShell.astro | Add public projection slots and shared-renderer consumption |
| src/components/InlineScholarFigures.astro | Retain as migration fallback, then retire implicit placement |
| src/components/ReadingRecord.astro | Consume shared checkpoint projection; remove Chapter 7-only replacement logic |
| src/pages/chapter/[slug]/index.astro | Use shared projection and expose stable entry/return metadata |
| src/components/editor/EditorShell.astro | Extract reusable logic, then make read-only after the contract bump; do not rely on it as a writable fallback |
| workers/editor-auth/src/index.mjs | Validated chapter-manifest return target, existing-session redirect, nonce consumption, capability device approval/issuance/revocation/verification |
| workers/editor-auth/wrangler.jsonc | Add editor origin and dedicated auth-state D1; expose a named capability-verifier RPC entrypoint only by service binding; remove public origin once old /admin is read-only |
| workers/content-api/src/index.mjs | commitLive, authoring-view, person operations, public projection persistence, corrected CAS |
| workers/content-api/migrations/ | Managed placement/checkpoint/public projection/CAS/feature-flag migrations |
| workers/site/src/index.mjs | General public projection route and HTMLRewriter injection |
| wrangler.jsonc | Remove the Site Worker CONTENT_DB binding; add only the internal Public Projection service binding and preserve static-asset bindings |
| workers/textbook-preview/src/index.mjs | Shared renderer rather than independent block rendering |
| packages/textbook-mcp/src/server.ts | New tools and response schemas |
| workers/textbook-mcp/src/index.mjs | Hosted equivalents and scope enforcement |
| scripts/mcp/mint-agent-capability.mjs | Replace local self-signing with the one-time Auth/Capability Worker device flow |
| scripts/mcp/run-codex-with-capability.mjs | Default to edit-only request; require explicit live-save/document/operation request and use issued bearer |
| .agents/skills/* | Updated agent workflows and live-save semantics |
| tests/e2e/editor-static.test.mjs | Keep cheap source checks, but stop treating them as browser proof |
| docs/AUTHORING.md | New reader-to-edit/save/history instructions |
| docs/CONTENT_MODEL.md | Replace obsolete Git-only authority/editor language |
| docs/PUBLIC_BOUNDARY.md | Document sanitized public projection surface |

### 12.3 New migrations

Use the next available migration numbers for:

1. person-feature and richer relation/placement records;
2. checkpoint display order and removal of slot uniqueness;
3. typed rights-clearance basis/policy/evidence receipts while preserving the existing rights status vocabulary;
4. immutable public chapter projections/fragments/heads;
5. live commit command/delivery receipts plus transaction-aborting authority/document-head/working-version guards;
6. audited runtime feature flags.

Create OAuth nonce/PKCE, one-time capability request, capability grant, and revocation migrations separately in the dedicated auth-state D1 database. Do not give the auth Worker a binding to the editorial content database.

Each migration needs:

- local apply;
- remote dry run;
- remote backup before apply;
- forward verification;
- rollback or compatibility procedure;
- seed/migration fixture;
- boundary audit.

### 12.4 Deployment ownership and origin configuration

The repository root wrangler.jsonc continues to deploy the anonymous Site Worker, but it must remove CONTENT_DB and add a service binding named PUBLIC_PROJECTION. The Public Projection Worker's workers/public-projection/wrangler.jsonc owns the sole public-projection D1 binding, sets workers_dev=false, declares no public custom-domain route, and is callable only by service binding. A deployment test inspects the generated Wrangler configuration and fails if the Site Worker regains D1 or the Public Projection Worker becomes publicly routable.

apps/instructor-editor/wrangler.jsonc owns the host-only Custom Domain pattern editor.ethicsandai.your-digital-life.org with custom_domain=true; Custom Domain patterns do not include /*. It also owns a Workers static-assets binding for its independently built dist directory. Its small host worker serves the static application and security headers only; it has no D1, R2, Queue, content-service, or signing-key binding. Browser API/OAuth requests go to the authenticated gateway origin under its exact CORS/CSRF contract.

The editor build generates all 18 chapter routes from the code-pinned chapter-route manifest. It copies the shared fingerprinted stylesheet, self-hosted font files, UI icons, and editor-only assets into the editor asset manifest. Canonical scholar/media records continue to use immutable /media/... paths on the public reader. The authoring projection rewrites those to absolute https://ethicsandai.your-digital-life.org/media/... URLs; it does not copy mutable chapter HTML or give the editor an R2 binding. Images/media load anonymously from that exact first-party origin, whose immutable asset responses allow the editor origin where CORS is required. CI compares the public and editor manifests and fails if:

- an editor JavaScript entry appears in the public bundle;
- a shared stylesheet/font hash differs unexpectedly;
- a reader-identical asset resolves only on one origin;
- any editor asset uses an implicit relative base that breaks a deep chapter URL.

Generate CSP from the reviewed adapter registry and a committed source inventory. The base editor policy is self-only for scripts, styles, and fonts; img-src and media-src additionally allow only https://ethicsandai.your-digital-life.org for immutable textbook media; connect-src additionally allows the exact auth/API origin. Provider frame/script/connect sources are code-owned and become usable only after the corresponding click-to-activate adapter runs; arbitrary chapter content cannot add a CSP source. Phase 4 tests the production-equivalent custom domain, deep links, every scholar/media URL class, font/media loading, CSP violations, and the absence of authoring code from the reader bundle.

---

## 13. Data migration plan

### 13.1 Inventory

Before transformation, generate a signed inventory containing:

- all 18 chapters and canonical hashes;
- every section and passage ID;
- every checkpoint and anchor;
- every media/embed/diagram/legacy node;
- all person/world relations;
- all featured flags and passageIds;
- the actual post-JavaScript rendered anchor and ordinal of every featured card;
- all person portrait/media/license references;
- all current D1 authority heads;
- current public rendered hashes/screenshots.

Fail if counts change unexpectedly between inventory and migration. The inventory must prove 29 chapter-person relations and 19 featured placements unless the source itself changes through a separately reviewed content revision.

### 13.2 Deterministic person-feature IDs

Backfill placement IDs from immutable inputs and the card’s actual current rendered position, for example:

~~~text
personfeature_<hash(chapterId + personId + anchorPassageId + ordinal)>
~~~

Do not use random IDs for migrated placements.

The current reader places a featured card after the first matching person link before consulting world.json passageIds. Therefore migration must:

1. execute the current reader placement code in a real browser;
2. record the stable passage/section immediately preceding each rendered card and its ordinal among cards at that location;
3. use that rendered position as the new canonical placement;
4. use world.json passageIds only when the existing runtime actually used its fallback;
5. record any intentional move as a separate reviewed migration decision.

For example, Aquinas currently renders near his first Chapter 5 person link, not at the first passage listed later in world.json. Migrating directly from passageIds would visibly move the card and is prohibited.

The first-link heuristic is never used after migration.

### 13.3 Checkpoint migration

- preserve every checkpoint ID and prompt field;
- map existing unique slots to slotLabel;
- calculate displayOrder from current chapter/side-panel order;
- prove that chapters with zero, one, three, and more than three checkpoints validate;
- remove any hard-coded three-slot UI assumptions;
- update [READING_RECORD_PROMPT_DESIGN.md](./READING_RECORD_PROMPT_DESIGN.md), [EDITOR_DESIGN_SYSTEM.md](./design/EDITOR_DESIGN_SYSTEM.md), and [AUTHORING.md](./AUTHORING.md) before the new schema merges so no controlling document still requires exactly three checkpoints.

### 13.4 Projection migration

For every chapter:

1. import the complete canonical bundle;
2. resolve frozen person/media/embed projections;
3. render with the shared renderer;
4. compare normalized DOM, stylesheet identity, displayed strings/links, and computed placement with the current public output;
5. create an immutable initial public projection;
6. keep the public head unchanged until authority/canary approval.

### 13.5 Required migration fixtures

- Chapter 5: Thomas Aquinas and live scholar-card parity;
- Chapter 7: Aristotle plus current D1/checkpoint canary behavior;
- chapters 10, 16, and 18: multiple featured thinkers;
- a chapter with no featured thinker;
- a chapter with native media;
- a chapter with an external embed;
- zero checkpoints;
- repeated checkpoints on one passage;
- deleted and replaced anchor;
- locked legacy markup.

The scholar fixture set must assert all 19 cards retain the exact pre-migration anchor and ordinal unless an intentional move is recorded. It must also assert that all 29 featured and nonfeatured relations survive.

### 13.6 Round-trip invariants

For each fixture:

~~~text
Git/legacy source
  → canonical next-version contract
  → editor document
  → serialized canonical contract
  → shared public projection
~~~

The round trip must preserve:

- prose and formatting;
- stable IDs;
- node order;
- checkpoints and sidebar settings;
- scholar placements and entity revisions;
- exact scholar-card displayed source/portrait/provenance fields;
- media/embed references;
- captions, alt text, credits, licenses, and teaching use;
- diagrams/artifacts;
- locked legacy content;
- canonical hashes after normalization.

---

## 14. Implementation phases

At most two major architectural phases should be open simultaneously. UI work may proceed against fixtures while API/data work proceeds, but neither lane may merge against an unstable contract.

### Phase 0 — Decisions, baseline, and editor-engine spike

**Estimate:** 4–6 engineering days
**Dependencies:** None
**Production change:** None

Tasks:

1. Write and accept an ADR for:
   - dedicated editor origin;
   - human and explicitly scoped agent chapter live Save;
   - immutable request-time public chapter projections;
   - static fallback;
   - distinction between chapter Save and protected release;
   - PKCE, token rotation, session lifetime, short-lived agent authorization, step-up controls, emergency revocation, rollback, CSRF, and exact-origin enforcement;
   - the same-D1 public-projection trust boundary and its code/query allowlist.
2. Record, clause by clause, which parts of ADR 0004 and ADR 0005 are retained, replaced, or superseded. No implementation PR may merge while that mapping is unresolved.
3. Scaffold the real Playwright harness, including authenticated test-session support, provider-network interception, public-response header capture, and desktop/mobile screenshot capture. This harness is added to incrementally in every later phase.
4. Capture current Chapter 5 and Chapter 7 reader/editor/preview DOM, computed-style samples, stylesheet identity, and screenshots.
5. Execute the current reader in a real browser and record the actual rendered anchor and ordinal of all 19 featured scholar cards. Separately prove the inventory contains 29 total chapter-person relations and preserve each relation's featured/nonfeatured state.
6. Capture current D1 head, content, authority, and migration inventories.
7. Inspect the active Cloudflare account plan and current billing/usage dashboard. Record whether Workers is Free or Paid, the current included Workers/D1/R2 quotas, current-month usage, and the baseline monthly charge before estimating headroom.
8. Build a disposable Tiptap/ProseMirror spike proving:
   - continuous prose;
   - stable passage nodes;
   - one noneditable scholar-card node;
   - one checkpoint node;
   - whole-document serialization;
   - undo/redo;
   - sanitized rich-text paste.
9. Measure editor bundle size, Worker CPU for representative read/commit requests, and mobile interaction.
10. Freeze the next content-contract version and migration names.

Exit gate:

- ADR accepted;
- browser-derived baseline signed, including all 19 card positions and all 29 chapter-person relations;
- spike round-trips prose plus managed nodes without loss;
- no paid editor service required;
- Cloudflare plan, included quotas, and current usage are captured from the active account rather than assumed;
- implementation owners agree on the canonical node model.

### Phase 1 — Content contract and deterministic migration

**Estimate:** 5–8 engineering days
**Dependencies:** Phase 0

Tasks:

1. Add ChapterPersonRelation, ManagedPlacement, immutable person/entity revision, PersonFeatureProjection, and the editor-only person-feature atom projection.
2. Preserve all 29 relations, featured state, legacy passageIds, and the browser-observed anchor/ordinal of all 19 rendered cards during import.
3. Add checkpoint displayOrder and remove slot uniqueness.
4. Add public projection and commit request/response schemas.
5. Add semantic placement operations.
6. Create migrations and deterministic backfill.
7. Generate a migration report for all 19 featured placements.
8. Add round-trip, duplicate-ID, orphan-person, orphan-anchor, replacement-anchor, zero/one/more-than-three/repeated-stage, and multiple-same-passage checkpoint tests.
9. Assert the exact displayed biography, primary-source, portrait, credit, license, source-revision, and link fields for every migrated scholar-card fixture.
10. Update OpenAPI-generated schema fixtures.
11. Update READING_RECORD_PROMPT_DESIGN.md, docs/design/EDITOR_DESIGN_SYSTEM.md, and AUTHORING.md before merging the schema so no controlling document still requires exactly three checkpoints.
12. Extend RightsCase/OpenAPI/D1 with the typed clearance basis, policy version, and evidence receipt while retaining status=cleared; update release gates, audit output, and agent boundaries so only the policy service or human rights workflow can create clearance evidence.
13. Merge the Phase 1 contract, migration, release-gate, agent-boundary, and real-browser inventory tests with this phase; do not defer them to Phase 7.

Exit gate:

- all 18 chapters import under the new contract;
- expected chapter, passage, checkpoint, media, placement, 29-relation, and 19-featured-card counts match inventory;
- chapters 5, 7, 10, 16, and 18 pass targeted round trips;
- zero/flexible checkpoint cardinality passes;
- all 19 cards retain their actual pre-migration browser anchor and ordinal unless a separately reviewed intentional move says otherwise;
- cleared rights cases round-trip typed humanApproval/policy evidence without adding an unsupported status, and agents cannot manufacture clearance;
- no current public content changes.

### Phase 2 — Shared chapter projection and renderer

**Estimate:** 7–10 engineering days
**Dependencies:** Phase 1

Tasks:

1. Create packages/chapter-renderer.
2. Implement the typed ordered projection.
3. Port prose, table, callout, media, embed, checkpoint, diagram, artifact, and legacy rendering.
4. Port PersonPortrait and thinker-card behavior.
5. Share one render primitive, design-token bundle, and exact card markup for each managed type; version the shared stylesheet and include its hash in projection identity.
6. Add editor node-view adapters.
7. Update protected preview to use the shared renderer.
8. Add normalized-DOM, stylesheet-hash, representative computed-style, and exact displayed-field parity fixtures.
9. Add print/offline, GIF poster/Play, provider fallback, blocked/deleted provider, and no-provider-request-before-activation tests.
10. Activate GIF, YouTube, and X runtime views, edit adjacent prose, serialize, and prove that no playback/provider DOM state enters canonical content.
11. Merge the Phase 2 DOM, visual, and provider-network browser tests with this phase.
12. Keep existing renderers behind flags until parity passes.

Exit gate:

- Chapter 5 Aquinas matches in reader, read-only editor fixture, and preview;
- Chapter 7 Aristotle and checkpoints match;
- multi-card chapters preserve order;
- media/caption/credit/GIF/embed fallbacks match;
- normalized DOM is equal after author-only decoration removal;
- shared stylesheet hash and representative computed styles match;
- a GIF asset/provider request is not made before Play/Activate, and activated runtime state does not survive Save;
- visual diffs are approved at desktop and mobile widths.

### Phase 3 — Atomic commit and public projection service

**Estimate:** 6–9 engineering days
**Dependencies:** Phases 1–2

Tasks:

1. Add public projection tables and indexes.
2. Add the selected live_commit_commands table plus transaction-aborting authority, canonical-head, and working-version guards.
3. Implement deterministic projection persistence.
4. Implement commitLive with operation batch, internal validation, idempotency, audit, and readback.
5. Add the read-only Public Projection Worker with workers_dev=false, no public route/mutation method, the sole public-projection D1 binding, and a generated public_* query allowlist.
6. Remove CONTENT_DB from root wrangler.jsonc, add the PUBLIC_PROJECTION service binding, and generalize the Site Worker for all allowlisted D1-authoritative chapters.
7. Add HTMLRewriter projection slots.
8. Preserve static fallback.
9. Remove Chapter 7-only behavior behind a reversible flag.
10. Add public response revision/projection headers and diagnostics.
11. Add real local-D1 concurrent-commit and authority-change-between-preflight-and-batch tests; a fake/in-memory repository test is not sufficient evidence for either guarantee.
12. Add 200 no-op, 201 verified, 202 confirmation-pending, lost-response replay, and same-key/different-body protocol tests against the actual public chapter route.
13. Add the audited runtime feature-flag control plane and protected flag service described in Section 17.

Exit gate:

- one click/API call creates one immutable revision and one matching public projection, while a content-equivalent no-op creates neither;
- concurrent commits produce exactly one winner with no orphan writes;
- verified idempotent retry returns the stored verified result; pending retry rechecks and may promote only delivery status;
- 201 is returned only after the actual no-JS public route exposes matching revision/projection headers; committed-but-unconfirmed delivery returns 202 without claiming live status;
- service failure returns static fallback;
- the anonymous Site Worker has no D1 binding, and the trusted Public Projection Worker exposes no mutation method and passes generated-query-allowlist tests restricted to public_* tables.

### Phase 4 — Deep-link authentication and dedicated editor origin

**Estimate:** 4–6 engineering days
**Dependencies:** Phase 0; may overlap late Phase 2

Tasks:

1. Provision editor.ethicsandai.your-digital-life.org.
2. Add apps/instructor-editor/wrangler.jsonc and the static host Worker with the host-only Custom Domain pattern, independent asset manifest/base policy, generated CSP inventory, and no data/service bindings.
3. Build the reader-identical editor application shell and verify shared fonts/styles plus absolute public-origin scholar/media assets at deep chapter URLs.
4. Generate and pin the 18-route chapter manifest used by both editor route generation and auth slug validation.
5. Add the public chapter menu and Edit entry.
6. Capture nearest stable anchor.
7. Implement the exact GET /auth/start?chapter=...&mode=edit&anchor=... contract; accept no JSON body and no arbitrary returnTo.
8. Add the dedicated auth-state D1 binding only to the auth Worker, with nonce hash, server-side PKCE verifier, validated target, issued-at/expiry, scheduled cleanup, and atomic DELETE ... RETURNING consumption.
9. Add structured signed OAuth state; validate slug against the generated manifest and anchor syntax against the bounded grammar, then resolve anchor existence/tombstones after authoring-view load.
10. Redirect valid sessions without a visible OAuth round trip.
11. Return callback to the exact editor chapter and anchor.
12. Add Done return behavior.
13. Add host-only Secure HttpOnly cookies with SameSite=Strict for session and SameSite=Lax for OAuth state, exact-origin CSRF enforcement, and CSP/CORS for the editor origin.
14. Add real-browser OAuth tests for valid-session fast path, replay, expiry, tampering, open-redirect encodings, unknown slug, safe-but-missing anchor, tombstone replacement, logout, reconnect, and dirty-session recovery.
15. Add deployment tests for the editor asset base, shared fonts/media/styles, CSP inventory, public-bundle exclusion, Site-Worker D1 removal, and service-binding-only projection Worker.
16. Make the old public-origin /admin editor read-only or redirect-only before removing the public origin from authoring CORS. It is not a writable rollback path after the content-contract bump.

Exit gate:

- reader to edit requires at most two intentional actions;
- GitHub login returns to the same chapter and passage;
- malicious return targets fail closed;
- replayed or unavailable auth-state fails closed;
- anonymous reader load makes no auth/API request;
- public origin cannot mutate content;
- session expiry can reconnect and resume.

### Phase 5 — Continuous authoring UI

**Estimate:** 8–12 engineering days
**Dependencies:** Phases 1–4

Tasks:

1. Build a contract-native advanced editor on the dedicated editor origin as the emergency authoring path. It uses the same authoring-view/commitLive contract and cannot use the deprecated serializer.
2. Build the Tiptap/ProseMirror chapter schema and extensions.
3. Load the complete authoring-view projection.
4. Implement continuous prose and formatting.
5. Implement whole-chapter paste/import and reconciliation preview; preserve checkpoints and managed placements by default and require explicit removal operations.
6. Implement shared managed node views.
7. Implement Checkpoint dialog/inspector with flexible cardinality and a nonempty draft form; insertion never writes an empty prose block.
8. Recompute passageExcerptHash server-side after anchored prose changes without blocking ordinary word edits.
9. Implement Media and Embed insertion flows.
10. Implement Person-feature chooser and inspector.
11. Implement right-side contextual inspector.
12. Implement Save and the complete 200/201/202 Save-state behavior.
13. Implement browser/server recovery and session resume; retain the recovery copy until public delivery verifies.
14. Implement Done, dirty-state, discard, and focus restoration.
15. Retain advanced Markdown mode with complete round-trip tests.
16. Merge real-browser tests now for one-word Save, empty/checkpoint insertion, arbitrary checkpoint counts, lost response/retry, 202 pending confirmation, session expiry, two-tab conflicts, whole-chapter paste, and managed-content preservation.

Exit gate:

- ordinary word edit saves without anchor/block errors;
- Checkpoint, Media, Embed, and Person buttons visibly work;
- editor displays managed content, not raw HTML or generic placeholders;
- whole-chapter paste preserves supported semantics;
- Save is the only required publication action;
- dirty work survives network failure and session expiry;
- the advanced editor can read, edit, Save, and recover the same contract if the visual editor is disabled.

### Phase 6 — History, OpenAPI, MCP, and Skills

**Estimate:** 4–6 engineering days
**Dependencies:** Phases 3 and 5

Tasks:

1. Integrate history drawer and semantic diff.
2. Integrate restore-as-new-draft.
3. Complete OpenAPI response schemas.
4. Add MCP tools and hosted Worker routes.
5. Implement the Auth/Capability Worker device request, instructor approval/step-up, one-time exchange, grant/revocation store, internal verifier, and fail-closed behavior.
6. Bind tokens to allowedDocumentIds, allowedOperations, live-save capability, issued-at/short expiry, runId, and jti; forward the original bearer and enforce every claim independently at both MCP and Content API boundaries.
7. Change both local capability scripts so they cannot self-sign production claims and default to edit-only. Require an explicit per-run --allow-live-save plus exact --document and --operation allowlists, and add issuance/exchange/use/expiry/revocation/unavailable-verifier audit tests.
8. Update all four Skills and examples.
9. Add public readback and get_live_commit_status to agent publication.
10. Add client conformance tests.

Exit gate:

- human and agent saves produce identical revision/projection semantics;
- agent without live-save cannot publish;
- explicitly authorized agent can publish and report exact result;
- a token cannot escape its document/operation allowlist and revoked/expired jti values fail closed at both boundaries;
- production capability issuance always has a persisted instructor approval and the bearer is returned exactly once;
- restore creates new lineage and never rewrites history;
- MCP, browser, and Skills validate against one OpenAPI contract.

### Phase 7 — Browser, accessibility, security, and resilience verification

**Estimate:** 5–7 engineering days
**Dependencies:** Phases 3–6

Tasks:

1. Complete and consolidate the real Playwright suites added incrementally in Phases 0–6; do not first introduce browser coverage here.
2. Complete desktop/mobile visual baselines.
3. Add keyboard, focus, zoom, screen-reader landmark, and reduced-motion checks.
4. Add provider-network interception tests.
5. Add auth/open-redirect/CSRF/CORS tests.
6. Add lost-response, timeout, retry, session-expiry, and two-tab conflict tests.
7. Add static-fallback and projection-integrity failure tests.
8. Run the public boundary audit.
9. Run the full existing validation/build/release suite.
10. Conduct manual VoiceOver and mobile browser passes.

Exit gate:

- all automated suites green;
- no Sev-1 or Sev-2 accessibility/security issue;
- normalized DOM and visual parity approved;
- no external-provider request before activation;
- no authoring request during anonymous page load;
- rollback drill succeeds in staging.

### Phase 8 — Canary and chapter authority rollout

**Estimate:** 5–7 engineering days plus 48–72 hours of observation
**Dependencies:** Phase 7

Tasks:

1. Deploy behind feature flags to a private preview.
2. Enable Chapter 7 unified editing first.
3. Enable Chapter 5 visual parity while still read-only.
4. Verify Aquinas and all Chapter 5 managed data.
5. Perform explicit Chapter 5 D1 authority cutover.
6. Edit and save real but reversible canary changes in both chapters.
7. Upload one real instructor-owned or allowlisted-Wikimedia production image/GIF through quarantine/processing, complete alt text, caption, credit, license, teaching-use metadata, status=cleared, and the typed clearance policy/evidence receipt, place it, Save it, verify public rendering, then restore if the canary change should not remain.
8. Verify public readback, history, restore, mobile, no-JS, print, and offline.
9. Observe logs, D1 reads/writes, Worker CPU, R2 storage/Class A/Class B operations, errors, conflicts, and cost.
10. Capture a dated Cloudflare billing-and-usage receipt and compare it with the quota/cost envelope before expanding the canary.
11. Roll out in controlled batches.
12. Keep the contract-native advanced editor and static fallback available; do not rely on the incompatible old /admin writer.

Exit gate:

- Chapters 5 and 7 complete real production edit/save/history/restore drills;
- no scholar card, checkpoint, media, or formatting loss;
- the real media insertion/Save path passes with complete accessibility and rights metadata;
- operational usage remains within the Section 18 quota envelope and a dated billing receipt exists;
- rollback and feature-disable paths are verified;
- owner approves broader rollout.

### Phase 9 — Full rollout and retirement

**Estimate:** 4–6 engineering days spread across rollout windows
**Dependencies:** Successful Phase 8 observation

Tasks:

1. Cut over remaining chapters in explicit batches.
2. Verify each batch against its fixture class.
3. Remove public origin from authoring CORS.
4. Redirect /admin to the dedicated editor; retain the contract-native advanced editor as the documented emergency route for one release cycle.
5. Remove Chapter 7 special renderer.
6. Remove first-link scholar placement after all 19 records verify.
7. Freeze old Git content as a migration fixture for D1-authoritative chapters.
8. Update AUTHORING, CONTENT_MODEL, PUBLIC_BOUNDARY, DEPLOYMENT, and runbooks.
9. Schedule quarterly restore/rollback and annual provider/card parity checks.

Exit gate:

- all 18 chapters are editable through the unified flow;
- all 18 public heads have verified immutable projections;
- old /admin is redirect-only and outside authoring CORS;
- legacy renderer/editor code is removed or explicitly quarantined;
- documentation matches production;
- full backup and restore are verified.

---

## 15. Dependency and parallel-work lanes

~~~text
Phase 0 decisions
       |
       +--> Lane A: contract and migration --------+
       |                                           |
       +--> Lane B: auth/editor-origin shell        +--> shared integration
       |                                           |
       +--> Lane C: renderer fixtures -------------+
                                                   |
                         commit/public projection <-+
                                                   |
                         continuous editor --------+
                                                   |
                         MCP/Skills + full tests
                                                   |
                         canary and rollout
~~~

Recommended ownership:

| Lane | Primary responsibility |
|---|---|
| Contract/data | Schemas, import, migrations, stable IDs, checkpoint cardinality |
| Rendering | Shared projection, public/editor/preview/print parity |
| Authoring UX | Tiptap schema, toolbar, inspectors, paste, recovery |
| API/security | commitLive, CAS, auth return state, scopes, public projection read surface |
| Verification/release | Playwright, visual/a11y/security tests, canary evidence, rollback |

Do not split ownership by reader versus editor renderer. One renderer lane must own both to prevent drift.

---

## 16. Verification plan

### 16.1 Contract tests

- ChapterPersonRelation, ManagedPlacement, and PersonFeatureProjection accept valid frozen entity/media references.
- Orphan person, entity revision, media version, and anchor fail.
- Duplicate placement IDs fail.
- Checkpoint IDs remain unique.
- Checkpoint stage/slot labels may repeat.
- Zero checkpoints validate.
- One checkpoint and more than three checkpoints validate.
- Multiple checkpoints on one passage validate and order deterministically.
- Editing prose beneath or around a checkpoint causes the server to recompute passageExcerptHash and does not block the Save.
- Public projection hash is deterministic.
- One content revision may have multiple immutable projection IDs across renderer/style releases, while one revision/renderer/schema/stylesheet tuple has exactly one deterministic projection.
- A stylesheet-only approved change produces a distinct projection and head without violating uniqueness; projection identity and uniqueness include stylesheetHash.
- Unknown node/provider/preset fails closed.
- cleared-library, instructor-owned declaration, and allowlisted Wikimedia provenance produce status=cleared with versioned typed clearance receipts; unclear rights remain reviewRequired and block live projection.
- Managed nodes survive editor serialization.
- Contract-version mismatch fails explicitly.

### 16.2 Migration tests

- all 29 chapter-person relations survive, including featured/nonfeatured state;
- all 19 scholar placements have deterministic IDs and retain their actual pre-migration browser anchor and ordinal;
- Chapter 5 Aquinas preserves the browser-observed anchor, role, portrait, alt, credit, license, source revision, biography, and every displayed primary-source field/link;
- Chapters 10, 16, and 18 preserve multiple-card order;
- no-card chapters gain no accidental card;
- the first-link fallback produces a recorded explicit anchor once and is not used after migration;
- repeated import is idempotent;
- import/export/import produces identical canonical hashes.

### 16.3 Renderer tests

- normalized public/editor/preview DOM parity;
- prose formatting;
- callouts and tables;
- checkpoint inline and side-panel output;
- scholar cards;
- image/GIF/caption/credit;
- audio/video/PDF;
- every provider fallback;
- blocked, deleted, malformed, and unsupported-provider fallbacks;
- diagram/artifact;
- print/offline/no-JS output;
- unsafe content escaping;
- no GIF asset or third-party provider request before Play/Activate;
- activating GIF/YouTube/X, editing adjacent prose, and saving does not serialize runtime state;
- shared stylesheet hash and representative computed styles match in public/editor/preview contexts.

### 16.4 API tests

- commitLive success;
- 200 no-op with no revision/history write;
- 201 only after the actual public route exposes the matching identity;
- 202 committed/confirmation-pending with Retry-After and status URL;
- human scope;
- agent scope with and without content:live-save;
- document/operation allowlists, short expiry, jti audit, and revocation at MCP and Content API;
- stale base revision;
- stale working version;
- active authority changes or ceases to be D1-authoritative between preflight and guarded batch;
- two simultaneous commits against real local D1, with exactly one winner and no losing-side rows;
- duplicate idempotency key with same request;
- duplicate key with different request;
- validation failure;
- projection failure;
- transaction failure;
- lost response plus retry;
- pending status route returns 202, promotes only delivery evidence, returns 200 when public headers match, and returns 410 after the 24-hour window;
- public readback hash;
- actual public response revision/projection headers;
- restore lineage;
- history pagination;
- Site Worker has no editorial D1 binding;
- generated Public Projection Worker query inventory contains only public_* tables and it exposes no mutation method.

### 16.5 Authentication tests

- known chapter and anchor return;
- valid existing session fast path;
- expired session;
- foreign/absolute/protocol-relative targets;
- encoded bypasses;
- tampered/expired/replayed state;
- CSRF missing or wrong;
- public origin mutation attempt;
- editor origin allowed;
- logout and reconnect.
- capability request/approval/exchange succeeds once and returns no token to the browser approval surface;
- live-save issuance without recent step-up fails;
- expired/revoked jti and unavailable verifier fail closed at both MCP and Content API;
- revoking between any mutation's preliminary read and application prevents that mutation; only read-only calls use the 15-second positive cache;
- original bearer claims—not unsigned forwarded identity headers—control document/operation authorization.

### 16.6 Real browser tests

Use Playwright rather than source-regex inspection:

1. reader → Edit → GitHub test session → same anchor;
2. edit one word → Save → public reader shows it;
3. insert/remove/reorder checkpoints, including more than three;
4. insert an image with caption/alt/credit;
5. upload instructor-owned media, record the ownership/license policy receipt, place it, and Save; separately prove unclear third-party media cannot Save live;
6. insert and play/stop a GIF;
7. prove the GIF asset is not requested before Play;
8. insert YouTube and X fallbacks, activate them, edit adjacent prose, Save, and prove the embed record is unchanged;
9. Aquinas visible and selectable in editor with every current displayed field/link;
10. move Aquinas and Save;
11. create zero, one, more than three, repeated-stage, and multiple-same-passage checkpoint states;
12. edit prose adjacent to a checkpoint and verify the server-derived excerpt hash changes without a save error;
13. whole-chapter paste while preserving managed placements/checkpoints by default;
14. Markdown round trip;
15. history compare and restore;
16. network failure during Save;
17. idempotent retry and lost 201 response recovery;
18. 202 confirmation-pending followed by verified public delivery;
19. two-tab conflict;
20. session expiry with dirty content;
21. Done with clean/dirty/deleted anchor;
22. browser Back and Cancel;
23. blocked/deleted provider fallback;
24. anonymous reader network log contains no auth/authoring request;
25. disable unified authoring through the runtime flag service and reach the advanced editor within the rollback SLA;
26. disable a chapter's public projection and verify the exact static fallback revision header.

### 16.7 Visual baselines

Required screenshots:

- Chapter 5 Aquinas, public desktop;
- Chapter 5 Aquinas, editor desktop;
- Chapter 5 Aquinas, editor at approximately 390 px;
- Chapter 7 checkpoints and side panel, public/editor;
- a multi-scholar chapter;
- still image with full caption/credit;
- controlled GIF;
- YouTube fallback;
- X fallback;
- whole-chapter paste result;
- history drawer;
- conflict state;
- 200% zoom.

### 16.8 Accessibility

Automated and manual checks:

- all author controls keyboard reachable;
- managed atom nodes selectable and described;
- inspector focus enters and returns correctly;
- dialogs trap and restore focus;
- save/status announcements use an appropriate live region;
- no keyboard trap in embed/media nodes;
- 200% zoom without two-dimensional scrolling for prose;
- 320/390 px responsive editing;
- reduced motion suppresses animation;
- GIF Play/Stop accessible;
- captions/credits maintain contrast and reading order;
- VoiceOver can distinguish prose, checkpoint, figure, scholar card, and inspector.

### 16.9 Required commands

As phases land, the minimum local gate becomes:

~~~bash
npm run content:generate
npm run validate
npm run build
npm run test:browser
npm run test:visual
npm run test:a11y
~~~

Add the final three scripts to package.json. Deployment additionally runs Worker dry runs, migrations against a disposable database, public-boundary audit, preview smoke tests, and release verification.

Browser, API, migration, and renderer suites are merged in their owning phases. Phase 7 consolidates and broadens them; it is not a testing backlog at the end of implementation.

---

## 17. Feature flags, rollout, and rollback

### 17.1 Feature flags

Use an audited D1-backed runtime control plane, not deployment variables alone:

~~~sql
CREATE TABLE runtime_feature_flags (
  environment TEXT NOT NULL,
  flag_key TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  chapter_allowlist_json TEXT NOT NULL DEFAULT '[]',
  config_version INTEGER NOT NULL,
  reason TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (environment, flag_key)
);

CREATE TABLE runtime_feature_flag_audit (
  audit_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL,
  flag_key TEXT NOT NULL,
  old_value_json TEXT NOT NULL,
  new_value_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
~~~

Required flag keys:

- UNIFIED_AUTHORING_ENABLED;
- PUBLIC_PROJECTION_ENABLED;
- AGENT_LIVE_SAVE_ENABLED;
- ADVANCED_EDITOR_ENABLED;
- MEDIA_UPLOAD_ENABLED.

Each flag has an environment and chapter allowlist. Empty allowlist means no chapter, not every chapter. All new flags default off. Wrangler variables are boot-time fail-closed defaults only; they are not the emergency kill switch because changing them requires a deployment.

Only the protected release/service-admin identity with runtime-flags:write may mutate flags. Browser instructor and agent tokens never receive that capability. Every mutation requires a reason and appends an audit row. The Site Worker, editor/auth gateway, Content API, and MCP Worker read a protected flag snapshot appropriate to their scope and enforce it server-side; hiding a client control is never authorization.

Cache a successful flag snapshot for no more than 15 seconds. After expiry, an unavailable flag service fails new authoring, live Save, agent publication, and dynamic projection closed while anonymous reading falls back to static HTML. A kill-switch mutation must stop new affected actions and route readers/editors to the declared fallback within 60 seconds. Test both the cache expiry and the rollback service-level objective.

The legacy /admin route has no writable feature flag after the content-contract bump. It is read-only/redirect-only. Product rollback disables UNIFIED_AUTHORING_ENABLED and leaves ADVANCED_EDITOR_ENABLED on for the same chapter allowlist.

### 17.2 Rollout order

1. private preview with fixture content;
2. Chapter 7 unified authoring canary;
3. Chapter 5 read-only renderer parity;
4. Chapter 5 explicit D1 authority cutover and live authoring;
5. 48–72 hour observation;
6. plain-prose chapters;
7. scholar-card chapters;
8. native-media chapters;
9. external-embed chapters;
10. checkpoint-extreme chapters;
11. remaining chapters;
12. legacy retirement.

Each batch requires public/edit/preview DOM parity, one live Save, history, restore, no-JS, and mobile verification.

### 17.3 Content rollback

For a bad chapter edit:

1. open History;
2. select the last known good revision;
3. Restore as draft;
4. inspect the diff;
5. Save;
6. verify the new public projection.

This produces a new immutable revision.

### 17.4 Product rollback

For an editor regression:

- disable UNIFIED_AUTHORING_ENABLED;
- retain reading;
- route instructor authoring to the contract-native advanced editor on the dedicated editor origin;
- preserve all changesets and recovery records.

### 17.5 Public projection rollback

For a projection-delivery regression:

- remove the affected chapter from the chapter allowlist on PUBLIC_PROJECTION_ENABLED;
- serve its static fallback;
- return X-Textbook-Delivery: static-fallback and X-Textbook-Fallback-Revision with the exact Git/static revision embedded at build time;
- keep the accepted canonical revision intact;
- repair and re-materialize the projection;
- re-enable only after hash and visual verification.

### 17.6 Infrastructure rollback

For code/schema/Worker failure:

- use the existing protected release rollback;
- restore D1 from verified backup/time travel when required;
- verify public heads and projection hashes;
- do not reconstruct history from current Git content.

---

## 18. Cost controls

The design reuses the existing Cloudflare Workers, D1, R2, Queues, and custom domains. Tiptap/ProseMirror is self-hosted and adds no service subscription.

The $5 target must be treated as an operating envelope, not as a billing-alert setting. Cloudflare billing alerts do not create a hard usage cap. Runtime limits, request bounds, deduplication, lifecycle rules, and feature flags are the enforcement mechanisms.

Phase 0 must inspect the active account rather than infer its plan from the repository. As of this plan's date, Cloudflare's published allowances relevant to a Workers Paid account are:

| Service | Published included usage relevant to this design | Planning consequence |
|---|---|---|
| Workers Paid | $5/month minimum, including 10 million requests/month and 30 million CPU milliseconds/month | If the account is already Paid, the target is the base $5 with zero usage overage |
| D1 on Workers Paid | 25 billion rows read/month, 50 million rows written/month, and 5 GB stored | Ordinary textbook traffic should remain far below the included allowance; measure actual row counts per route |
| R2 Standard | 10 GB-month storage, 1 million Class A operations, 10 million Class B operations, and free Internet egress in the published free tier | Media can remain at $0 only while storage and operations stay inside these allowances |
| Queues on Workers Paid | 1 million operations/month, then $0.40 per million; write/read/delete normally count separately and payloads are metered in 64 KB chunks | Media jobs must remain small, deduplicated, idempotent, and visible in the usage receipt |

Prices and included quotas can change. Phase 0 records a dated account screenshot/export and the then-current official pricing pages. If the account is still on Workers Free, do not upgrade solely for this feature without measured need. If Workers Paid is required, the acceptance target is $5.00/month in Cloudflare service charges before tax, with no overage. Existing domain registration is tracked separately unless the owner explicitly moves it inside this operating target.

### 18.1 Main cost drivers

- public D1 head reads;
- public projection fragment reads;
- D1 revision/projection storage;
- Worker requests and CPU;
- R2 originals and derivatives;
- R2 upload/processing operations;
- Queue operations, retries, and dead-letter writes for media-processing jobs;
- protected preview and release builds.

### 18.2 Budget controls

- Create a daily usage receipt that records Workers requests/CPU, D1 rows read/written/storage, R2 storage/Class A/Class B operations, Queue write/read/delete/retry/dead-letter operations, and projected service charge.
- Alert at 50%, 75%, and 90% of every applicable included quota. Do not rely on a single dollar alert.
- Require projected normal-month usage to remain below 50% of each included quota before expanding beyond Chapters 5 and 7; 75% pauses rollout and 90% disables nonessential agent live-save/media-upload flags pending review.
- If Workers Paid is active, alert on any forecast above the $5 base charge. If Workers Free is active, alert on any forecasted paid overage or unexplained charge.
- Store chapter projection text in D1; keep large binary media in R2.
- Cache immutable projection fragments by hash.
- Do not add analytics, hosted CMS, hosted editor, hosted collaboration, or third-party oEmbed service.
- Do not call commitLive on each keystroke. Working-draft persistence may be debounced, but public Save is an intentional action.
- Bound one semantic operation batch to 100 operations and 2 MiB. Begin with six commitLive attempts per actor and per document per minute, ten new media-upload tickets per actor per hour, and existing upload byte/type limits; ratify or lower these values with canary measurements before production.
- Set explicit Wrangler CPU limits per Worker to the lowest value that passes twice the measured staging p99 for its representative route set. Do not leave Workers at a paid-plan maximum merely because it is available.
- Do not regenerate media derivatives on ordinary prose saves.
- Deduplicate media by content hash.
- Apply quarantine lifecycle expiry.
- Keep previews short-lived.
- Sample success logs; retain complete failure/audit records.
- Measure per-chapter public read cost during canary before full rollout.
- Retain a dated monthly billing-and-usage receipt in release evidence; rollout cannot proceed on a dashboard glance alone.

### 18.3 Budget response

At 50% of any included quota:

1. verify the measurement and route-level attribution;
2. review cache hit rate, per-request D1 rows, CPU, R2 operations, and agent call volume;
3. correct waste before expanding the rollout.

At 75%, pause chapter expansion and new provider/media features. At 90%, disable AGENT_LIVE_SAVE_ENABLED and MEDIA_UPLOAD_ENABLED for affected chapters while preserving human prose Save, reading, history, backups, and accessibility. If the projected Cloudflare service charge exceeds $5:

1. identify reads, writes, storage, R2 operations, and Worker CPU separately;
2. increase immutable-fragment cache effectiveness;
3. reduce nonessential preview regeneration and verbose success logging;
4. clean expired quarantine/previews under retention policy;
5. pause new provider/media expansion and agent bulk publication;
6. require owner approval before accepting an overage or changing architecture.

Do not disable version history, backups, public accessibility, or student privacy to meet the target.

Go/no-go for full rollout requires a dated Cloudflare usage/billing receipt and a measured projection at or below $5/month under observed textbook traffic, not an unverified estimate.

---

## 19. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| Shared renderer migration changes chapter appearance | Medium | High | Baseline DOM/screenshots; per-node parity; Chapter 5/7 canaries |
| Managed placements are lost during whole-chapter paste | Medium | High | Atom nodes, stable IDs, dependency preview, explicit remove operations |
| Browser-observed scholar placement differs from world.json metadata | High in current code | High | Real-browser inventory for all 19 cards; migrate rendered anchor/ordinal, not metadata assumption |
| D1 CAS loses a concurrent update | Low after fix | Critical | Transaction-aborting guard and true concurrency test |
| Authority changes between commit preflight and batch | Low | Critical | Bind exact active D1 authority row into the first guarded command and test the race on local D1 |
| Save commits but browser reports failure | Medium today | High | Single commitLive idempotency and post-commit result retrieval |
| Revision commits while public confirmation is delayed | Medium | Medium | Explicit 202 state, status URL/replay, retain recovery copy, never claim live until public headers match |
| Cached idempotency response freezes a pending result | Medium without special handling | High | Immutable commit receipt plus separately promotable delivery observation; bypass generic cached-response shortcut |
| Public projection exposes draft/editorial data | Low | Critical | public-only tables/service surface, contract tests, no editorial token |
| Same-D1 projection Worker queries an editorial table | Low | Critical | Site Worker has no D1 binding; generated query allowlist, code review, boundary tests, no mutation routes |
| OAuth becomes an open redirect | Low | High | structured signed target, known slugs/anchors, one-time nonce |
| Agent issuer/revocation service is unavailable | Low | High | central issuer, original bearer verified at both layers, no cached commit verification, fail closed |
| Dedicated editor origin feels like another site | Medium | Medium | identical shell, same route shape/anchor, minimal author bar, instant return |
| Tiptap paste changes stable identities | Medium | High | custom schema/paste transformer and identity reconciliation tests |
| Scholar biography changes historical revisions | Medium | Medium | freeze entityRevisionId in chapter revision projection |
| Stylesheet-only release collides with projection uniqueness | Low after schema fix | Medium | include stylesheet hash in projection identity, head, and uniqueness constraint |
| Provider embed breaks or tracks readers | Medium | High | fallback first, explicit activation, adapter registry, CSP |
| New media cannot publish immediately | Medium | Medium | finish processing/metadata before insertion; inline status rather than review ritual |
| Static fallback is stale | Expected | Low | fallback header/alert; accepted projection resumes when service recovers |
| Legacy and new editors diverge during rollout | Medium | Medium | make old /admin read-only; use the new-contract advanced editor as rollback; retire after all chapters pass |
| Runtime kill switch is stale or unaudited | Low | High | D1 control plane, 15-second cache, fail-closed defaults, mutation audit, 60-second rollback test |
| Public D1/R2/Worker usage exceeds the $5 target | Low/unknown | Medium | account-plan receipt, quota alerts at 50/75/90%, CPU/rate limits, immutable caching, canary gate |
| Scope expands into collaborative multi-user editing | Medium | Medium | explicitly out of scope; retain CAS conflicts, no real-time collaboration |

---

## 20. Definition of done

The project is complete only when all of the following are true.

### Experience

- From any public chapter, Edit opens the same chapter at the same passage.
- GitHub authentication returns to that exact context.
- The editor looks like the published chapter.
- An instructor can edit prose continuously and paste a complete chapter.
- Checkpoint, Media, Embed, and Person controls always open working interfaces.
- Scholar cards and media appear in place, not as HTML or placeholders.
- Save is the only normal publication action.
- Done returns to the matching public passage.

### Content

- Chapters may contain any number of checkpoints.
- All 29 chapter-person relations survive migration, including featured/nonfeatured state.
- All 19 existing featured scholar placements preserve their actual browser-observed anchor and ordinal unless an intentional move is separately approved.
- Every displayed scholar biography/source/portrait/credit/license/link field is frozen in a versioned projection and survives round trip.
- Captions, alt text, credits, rights, GIF controls, and embed fallbacks survive round trip.
- Cleared-library, instructor-owned, and allowlisted-Wikimedia media can reach status=cleared with typed humanApproval/policy evidence; unclear rights remain reviewRequired and cannot enter a live projection.
- Stable passage and section identities survive ordinary edits.
- No supported managed content disappears in Markdown/visual round trips.

### Publication and history

- A changed Save creates one immutable revision and one matching public projection; a normalized no-op creates neither.
- The public reader shows the new revision on the next verified request, and 201 is not returned until its revision/projection headers match.
- Committed but unconfirmed delivery returns 202 and later converges through idempotent replay/status without creating a second revision.
- The 24-hour authenticated status route returns 202 pending, 200 verified, and 410 expired exactly as contracted.
- A failed or conflicting Save creates no partial live state.
- A chapter that is not actively D1-authoritative at the guarded batch cannot commit, including during an authority-change race.
- History shows human and agent provenance.
- Restore creates a new draft and a new revision when saved.
- Static fallback and protected release rollback both work.

### Agent support

- OpenAPI, MCP, browser, and Skills share the same semantic contract.
- An explicitly scoped agent can edit and save live.
- An unscoped agent cannot save live.
- Default local/MCP capability issuance omits live-save; an authorized run is bounded to explicit document and operation allowlists and an auditable, revocable jti.
- Production tokens come only from the instructor-approved one-time Auth/Capability Worker flow; MCP and Content API independently verify the original bearer and fail closed when revocation state is unavailable.
- Agent publication reports exact revision, content hash, projection hash, and URL.

### Privacy, security, and accessibility

- Anonymous reader load performs no authoring/auth request.
- Public reader has no mutation route or editorial credential.
- No provider request occurs before activation.
- OAuth return target cannot escape the editor route.
- Keyboard, mobile, zoom, screen-reader, reduced-motion, print, offline, and no-JS gates pass.

### Operations and cost

- Chapters 5 and 7 pass production canary and rollback drills.
- All 18 chapters pass parity and save verification.
- Runtime flags are server-enforced, audited, default off, cached no more than 15 seconds, and meet the 60-second rollback objective.
- Product rollback uses the contract-native advanced editor; old /admin is read-only/redirect-only and outside authoring CORS.
- The Site Worker has no D1 binding, the Public Projection Worker has no public route, and the editor is an independently deployed custom-domain asset bundle with no data bindings.
- Static fallback reports its exact built revision.
- Backups and D1 restore are verified.
- A dated Cloudflare account-plan and billing/usage receipt shows observed usage within the defined quota envelope and projects to no more than $5/month.
- Legacy special cases are removed or documented with an expiration owner/date.

---

## 21. Recommended pull-request sequence

Do not implement this as one pull request.

1. **ADR and baseline**
   - Superseding security/publication decision, Cloudflare account receipt, Playwright scaffold, signed browser inventories, fixture captures.
2. **Contract: person features and checkpoints**
   - Schemas, operations, flexible cardinality.
3. **Migration and round-trip fixtures**
   - All 29 relations, all 19 browser-observed placements, checkpoint extremes, and target chapters.
4. **Shared projection core**
   - Pure typed projection and hash.
5. **Shared HTML renderer**
   - Reader/preview parity without changing production default.
6. **Public projection persistence and CAS fix**
   - D1 migration, audited runtime flags, real-D1 concurrency, and adversarial API tests.
7. **commitLive**
   - One-call Save, authority guard, two-stage idempotency/delivery receipt, status route, public readback.
8. **Site Worker projection delivery**
   - Generalized routes, root D1-binding removal, service-binding-only projection Worker, HTMLRewriter, static fallback.
9. **Editor origin and OAuth deep link**
   - Route continuity, dedicated auth-state D1, old-/admin read-only transition, and security tests.
10. **Continuous editor shell**
    - Contract-native advanced fallback, Tiptap/ProseMirror, prose, paste, recovery.
11. **Checkpoint and managed-content inspectors**
    - Checkpoint, media, embed, person-feature flows.
12. **History and restore integration**
    - Human-readable diff and lineage.
13. **MCP and Skills**
    - Central instructor-approved capability issuance/revocation, dual-boundary enforcement, agent tools, scopes, examples, conformance.
14. **Browser/a11y/visual gates**
    - Playwright and manual evidence.
15. **Chapter 7 and Chapter 5 canary**
    - Production flags, real media Save, billing/usage receipt, observations, rollback drill.
16. **Remaining chapter batches and retirement**
    - Authority cutover, docs, legacy removal.

Each PR must state:

- contract version;
- migration impact;
- authority impact;
- feature flag;
- verification commands;
- rollback;
- screenshots or API receipts when user-facing.

---

## 22. Immediate first implementation sprint

The first sprint should complete only the foundation:

1. write the superseding ADR;
2. scaffold the real-browser test harness and capture/sign Chapter 5/7 visual baselines plus all 19 actual scholar-card positions and all 29 relations;
3. build the Tiptap/ProseMirror managed-node spike;
4. define ChapterPersonRelation, ManagedPlacement, PersonFeatureProjection, and flexible checkpoint schemas;
5. add deterministic migration fixtures;
6. scaffold packages/chapter-renderer;
7. create normalized-DOM comparison helpers;
8. inspect and record the active Cloudflare plan/usage baseline;
9. produce a reviewed migration report for all 19 scholar placements and all 29 relations.

Do not begin production OAuth redirection, public projection serving, or the final editor UI until that sprint proves that the canonical model can represent and round-trip everything the reader already shows.

---

## 23. Technical references

- [Cloudflare D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare D1 pricing and usage measurement](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Cloudflare Workers HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/)
- [Tiptap custom nodes](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node)
- [Tiptap node views](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views)
- [Tiptap and ProseMirror packages](https://tiptap.dev/docs/editor/core-concepts/prosemirror)

Repository-specific controlling references:

- [Agent-native platform plan](./AGENT_NATIVE_AUTHORING_PLATFORM_IMPLEMENTATION_PLAN.md)
- [Authoring guide](./AUTHORING.md)
- [Content model](./CONTENT_MODEL.md)
- [Public boundary](./PUBLIC_BOUNDARY.md)
- [Wikimedia world layer](./WIKIMEDIA_WORLD_LAYER.md)
- [Checkpoint prompt design](./READING_RECORD_PROMPT_DESIGN.md)
- [Rights and licensing](./RIGHTS_AND_LICENSING.md)
- [ADR 0004: authentication and agent scopes](./architecture/adr/0004-auth-and-agent-scopes.md)
- [ADR 0005: immutable publish and rollback](./architecture/adr/0005-immutable-publish-and-rollback.md)
