# Agent-Native Authoring and Media Platform

## End-to-End Implementation Plan

- **Status:** Implementation in progress; Chapter 7 production canary awaiting R2 account activation
- **Plan version:** 1.2
- **Last updated:** 2026-08-03
- **Target repository:** `Brehove/ai-ethics-interactive-textbook`
- **Migration baseline:** `origin/main` at `0a2716182953f492a654aa8b704d420216f39450`
- **Confidence:** High on the architecture and guardrails; moderate on the schedule until the vertical spike is complete

---

## 0. Live implementation status

This document remains the end-to-end implementation plan. The implementation branch now contains the Chapter 7 vertical canary rather than only a proposal. Status must be read from tested artifacts and deployed infrastructure, not inferred from the original estimates below.

| Phase | Current state on 2026-08-03 | Remaining gate |
|---|---|---|
| 0 — governance/baseline | Complete: clean worktree, five ADRs, signed baseline, archived visual/runtime evidence | None |
| 1 — contract/spike | Complete for the Chapter 7 canary: shared schemas, Git/D1 repository paths, deterministic import/export/round-trip, media/embed projections | Live R2 upload/restore proof after account activation |
| 2 — control plane/shadow migration | Implemented and remotely seeded: 18 documents/revisions/authority records, semantic operations, CAS, idempotency, audit provenance, human-only review/release, restore-as-draft | Production Worker deployment; remaining full-book search/preview/release-lock hardening is tracked below |
| 3 — instructor editor/checkpoints | Complete for Chapter 7: browser prose/checkpoint/media/embed authoring, canonical-versus-working review, validation, submit, exact-snapshot human approve/reject, reload-safe review state, mobile/accessibility pass | Live authenticated smoke test |
| 4 — native media | Processing, quarantine, callbacks, GIF poster/playback, responsive images, audio/video/PDF policy and tests implemented | R2 buckets/credentials and one real end-to-end production upload |
| 5 — provider registry | YouTube, Vimeo, X, safe rich links, and fallback-first extended adapters implemented with no arbitrary HTML | Live multi-browser/network smoke checks |
| 6 — API hardening | Actor provenance, scope separation, CAS/idempotency, exact snapshot verification, semantic diff, reject, restore, and hostile-input tests implemented | Preview-token flow, multi-document merge/rebase, serialized release state, and broader operational limits |
| 7 — MCP/Skills | Hosted/local MCP registry, exhaustive OpenAPI route surface, and four versioned Skills implemented; agents can edit/validate/diff/submit but cannot approve or publish | Deploy Worker, set its bearer, and run one live client smoke test |
| 8 — immutable release | Signed candidate, exact snapshot route, isolated materialization/build, asset digests, canary upload/promotion/rollback commands and protected GitHub environments implemented | Cloudflare release token; live canary upload, smoke, human approval, promotion, rollback drill |
| 9 — cutover | Chapter 7 is the only permitted canary in code and UI; D1 remains nonauthoritative in production | Complete the live canary before changing its authority record; then batch the other 17 chapters |
| 10 — extended media | Spotify click-to-load plus SoundCloud and Bluesky link-first adapters are implemented in contract, editor, reader, print, and conformance tests | Live provider smoke checks and post-canary quarterly operational drills |

The only account-level blocker to the live media canary is Cloudflare R2 activation. The dashboard currently presents a $0-due-now subscription with usage overages; activation is intentionally not performed without the account owner’s explicit confirmation. No authority registry entry is switched to D1 until the production release is green and reversible.

---

## 1. Executive decision

Build a database-backed **authoring control plane**, not a database-backed public reader. The approved hard operating budget ceiling is **$5/month**. Sanity is rejected: its free tier is unsuitable for private drafts/revision history and its usable private tier is $15/seat/month. See [Sanity pricing](https://www.sanity.io/pricing).

The target system is:

- **Cloudflare D1/R2** as the canonical store for routine editorial content, structured prompt checkpoints, media metadata, uploaded assets, drafts, and revision history after an explicit cutover;
- a **custom textbook Content API** as the only agent write path and the enforcement boundary for validation, authorization, concurrency, audit history, media ingestion, embed resolution, review, and publication;
- a **custom textbook MCP server and reusable Skills** over that API, with narrow semantic tools rather than generic document patches;
- a standalone **Textbook Editor** as the browser-based instructor editor, including chapter editing, prompt-checkpoint management, media upload and placement, embed insertion, preview, history, and review;
- the existing **Astro reader and Cloudflare deployment** as an immutable static publication artifact that never reads from D1/R2 or another mutable content API at page-view time;
- **GitHub as the authority for code**, schemas, renderers, design tokens, validators, migrations, tests, MCP implementation, Skills, and infrastructure—not the routine content-editing interface;
- no content commit, branch, pull request, or merge for an ordinary prose, checkpoint, caption, image, or embed update.

The strongest counterargument to the requested WordPress-like media experience is that “paste any embed code” is remote code execution, third-party tracking, accessibility failure, and provider fragility disguised as convenience. This plan therefore delivers WordPress/Substack-style ease through an **allowlisted media-adapter registry**. It does not permit arbitrary HTML, scripts, iframes, shortcodes, or runtime oEmbed discovery.

The initial production release must support:

1. still images;
2. animated GIF and WebP media with explicit playback controls;
3. short uploaded audio, video, and downloadable documents;
4. YouTube embeds;
5. Vimeo embeds;
6. X post embeds;
7. rich link cards for unsupported URLs;
8. high-quality captions, credits, alt text, transcripts or summaries, responsive layouts, print projections, and offline fallbacks;
9. manual and agent-driven creation, placement, editing, validation, preview, and review of all of the above;
10. manual and agent-driven creation and editing of the three reading-record prompt checkpoints that appear both inline and in the side panel.

This is not a one- or two-week CRUD feature. A production MVP with the P0 providers is an estimated **8–12 focused engineering weeks with parallel work**. A single engineer working mostly sequentially should budget **12–16 calendar weeks**. A nonproduction instructor-usable Chapter 7 vertical prototype should be available in **3–4 weeks**; the production canary follows the release/security pipeline and is realistically an **8–10 week milestone**. The extended P1 provider pack and post-launch hardening add roughly **2–4 weeks**. These estimates assume no full visual redesign of the public reader.

### 1.1 Pressbooks parity and deliberate improvements

| Pressbooks-like capability | Required result here | Improvement |
|---|---|---|
| Browser chapter editor | Rich structured chapter editing and immediate drafts | Stable passage identity, dependency graph, semantic diff, exact public-render preview |
| Media library | Reusable assets, crop/focal point, captions, credits, placement | Immutable media versions, contextual alt/caption, rights/use approval, agent upload/search/place APIs |
| Revisions | Browse and restore prior work | Isolated multi-document change sets, hash-bound approvals, portable snapshots, deterministic restore |
| Embeds | Paste a supported URL | Typed provider adapters, click-to-load privacy, no arbitrary HTML, offline/print fallback, health handling |
| Roles/workflow | Draft/review/publish | Narrow human/agent scopes, idempotency, CAS conflicts, audit/run lineage, step-up release approval |
| Export/publish | Generate book outputs | One frozen snapshot generates web/no-JS/print/offline/data/voice derivatives and an immutable static deployment |
| Extensibility/API | WordPress/plugin APIs | Textbook-domain OpenAPI + MCP + Skills with first-class checkpoint/media semantics |

---

## 2. Why the current repository makes this migration unusually sensitive

The migration baseline contains a mature static publication system, not a simple pile of Markdown:

- 18 chapters;
- 268 section IDs;
- 1,939 stable passage IDs;
- 122 raw HTML asides;
- 16 raw HTML tables;
- 123 explicit HTML IDs;
- 54 checkpoint anchors—exactly three per chapter;
- 37 curated media records and their assets;
- multiple generated reading derivatives and a static, privacy-preserving student reader.

All 18 chapters already have structured `reading-record.json` files. The prompt model exists and feeds `ReadingRecord.astro`; the missing piece is an authoring UI and API. The current browser editor does not expose those records and remains a raw, one-file-at-a-time Git branch and pull-request workflow.

The current static architecture also has real strengths that must survive the migration:

- a chapter remains readable with JavaScript disabled;
- student responses remain in page memory and are not stored or transmitted by the textbook;
- print, offline HTML, plain text, and reading-data derivatives come from the same content source;
- image rights, alt text, captions, teaching use, credit, placement, and source revision are explicit;
- stable passage IDs anchor prompts, figures, annotations, sources, and downstream links;
- a failed build cannot partially mutate a public chapter.

The system must therefore preserve the current public reader while replacing the editorial control plane behind it.

---

## 3. Non-negotiable product requirements

### 3.1 Authoring

- An instructor can edit a chapter in a browser and save a draft immediately.
- An instructor can insert, edit, delete, move, and preview structured content blocks without touching Git.
- An instructor can add a checkpoint when fewer than three exist, edit any checkpoint, assign it to the appropriate fixed Commit–Work–Reconcile slot, change the anchor passage, and preview both the inline trigger and the side-panel presentation.
- An instructor can upload media, paste a supported provider URL, write or revise alt text and captions, record rights, choose a display preset, and place the result relative to a stable passage.
- The editor shows a semantic diff, validation results, impacted anchors, and every output projection before release.
- Routine authoring never creates a Git commit.

### 3.2 Agent-native operation

- Every meaningful authoring action has a typed API operation.
- The MCP exposes textbook-domain tools, not generic database access or arbitrary storage patches.
- Agents can find a chapter or passage, create a draft, edit prose, add or revise a checkpoint, upload media, resolve a provider URL, place an asset, write captions and alt text, validate, render a preview, inspect a diff, and submit for review.
- Agent changes are reviewable, attributable, idempotent, revision-safe, and reversible.
- Styling remains renderer-owned. Agents choose semantic types and approved presets; they never supply CSS, HTML, iframe source strings, script code, or arbitrary player parameters.
- Agent credentials cannot approve uncertain rights, change permissions, migrate schemas, issue credentials, hard-delete content, or publish without an explicit instructor-scoped approval.

### 3.3 Publication

- The public reader is a static, immutable artifact.
- A release pins exact content revisions, prompt records, media assets, embed definitions, rights records, renderer version, and derivative versions in one manifest.
- Publication is atomic. A failed build leaves the currently active release untouched.
- A complete prior release can be restored in one operation.
- Public chapter views make no live request to D1/R2.
- Required reading remains complete when JavaScript is disabled, the reader is offline, a provider blocks the embed, or a post/video has disappeared.

### 3.4 Privacy

- The textbook continues to provide no student account, response API, analytics beacon, or response persistence.
- No external media provider receives a request until the student explicitly activates that specific embed.
- Provider activation consent is page-memory-only. The textbook does not store it in `localStorage`, a cookie, or analytics.
- Loading an external provider clearly discloses that the provider will receive ordinary connection and browser information.
- The admin and public bundles remain separate. No authoring credentials, endpoints, SDKs, or draft data ship in the public bundle.

### 3.5 Accessibility and media quality

- Every nondecorative uploaded figure has context-specific alt text.
- Every media placement has a caption or an explicit editorial reason for omission, plus a statement of teaching use.
- Necessary audio/video has captions, a transcript, or a substantive equivalent.
- Animated media never starts automatically. It has Play and Stop controls, honors reduced-motion preferences, and has a static first-frame poster.
- Media components are keyboard operable, screen-reader labeled, responsive at 320/390/768/desktop widths, and legible at 200% zoom.
- Print and offline output contain the media’s meaning, credit, source, and canonical URL—not merely “embed unavailable.”
- Automated checks prove presence, mechanics, and consistency; a version-bound instructor approval proves the semantic quality of checkpoint pedagogy, contextual alt text, caption, crop, transcript/media equivalence, and teaching use. Any relevant content/version change invalidates that approval.

---

## 4. Target architecture

```text
                         AUTHORING PLANE

  Instructor browser                                  Agent / Codex
  Textbook Editor                                     MCP client + Skills
         |                                                    |
         | manual draft editing                               | typed tools
         v                                                    v
  Standalone Textbook Editor        <------>  Textbook MCP / Content API
         |                                      | auth, validation, audit,
         | drafts, normalized blocks, assets    | concurrency, idempotency,
         v                                      | embed/media resolution
                    D1 canonical content <-------+
                         |
                         | approved frozen snapshot
                         v
                    RELEASE PLANE

  Release manifest -> materializer -> existing validators -> Astro build
       |                    |                 |                  |
       |                    +-> media         +-> security       +-> web
       |                    +-> checkpoints   +-> accessibility  +-> print
       |                    +-> derivatives   +-> visual tests   +-> offline
       v
  versioned Cloudflare deployment ---- atomic promotion ----> Public reader

                         PUBLIC PLANE

  Static HTML/CSS/JS + pinned first-party assets and fallbacks
  No editorial SDK | No mutable content API | No student data store | No analytics
```

### 4.1 Authority model

The authority transition must be explicit and one-way:

| Stage | Routine content authority | Code authority | Public authority |
|---|---|---|---|
| Before shadow migration | Git content tree | Git | Current deployed artifact |
| Shadow migration | Git; D1 import is a read-only shadow | Git | Current deployed artifact |
| Canary | Git for noncanary chapters; D1 for named canary chapter only | Git | One frozen release manifest |
| After cutover | D1/R2 | Git | One frozen release manifest |

There is never a stage where the same chapter is freely writable in both Git and D1. The active authority lives in a versioned, server-enforced **per-chapter authority registry**, not a scalar `CONTENT_AUTHORITY` flag. Each entry names `git` or `d1`, source coordinates, and the approved normalized snapshot hash. Import/export scripts, editor, API, migration jobs, and candidate creation all consult it. Every release candidate freezes the complete mapping. Tests must prove that a D1-authoritative canary chapter cannot be read from its stale Git fixture and that its Git write path is rejected.

After cutover, the repository’s current content tree becomes a frozen migration fixture unless a later ADR removes it. Scheduled D1/R2 exports go to an off-provider backup target; routine edits do not generate content commits.

### 4.2 Technology choices

| Concern | Decision | Reason |
|---|---|---|
| Browser editor | Standalone Textbook Editor | React application over the domain API; no storage-vendor SDK or direct database editing |
| Editorial store | Cloudflare D1 + private R2 | Normalized revisions/metadata in D1; immutable media, snapshots, previews, and release artifacts in R2 |
| Agent mutation boundary | Cloudflare Worker Content API | Shared server-side validation, auth, audit, revision guards, provider resolution, and stable domain semantics |
| Agent protocol | Custom Streamable HTTP MCP | Narrow tools with explicit schemas and accurate safety annotations |
| Agent workflows | Versioned Skills in the repository | Reproducible chapter, checkpoint, media, and release-review procedures |
| Reader | Existing root Astro application | Preserve the current public UX and derivative pipeline |
| Public hosting | Existing Cloudflare Workers Static Assets deployment | Preserve current topology and rollback path |
| Draft preview | Cross-site protected Astro preview Worker | One-time read-only snapshot rendering without authoring cookies, API credentials, or a live production dependency |
| P0 images/GIFs/files | Private R2 media store | Immutable hash-addressed asset objects and generated first-party variants |
| Upload ingress | Temporary Cloudflare R2 quarantine | Short-lived upload target; objects are promoted only after verification or expire by lifecycle |
| Long video | YouTube/Vimeo in P0 | Do not pretend the native short-media path is an adaptive video platform |
| Release backups | Scheduled D1 export plus R2 snapshot/media/release records in a separate private backup prefix | Portability and disaster recovery without routine Git commits |

### 4.3 Operational persistence and runtimes

| State/work | Concrete runtime | Notes |
|---|---|---|
| Canonical accepted revisions/metadata | Cloudflare D1 | API-only append-only normalized revisions and canonical heads after migration |
| Authority registry, change-set metadata, idempotency, audit, approval tokens, release sequence/lock, jobs, provider health | Cloudflare D1 | Schema migrations in `workers/content-api/migrations/` |
| Isolated working documents | D1 change-set rows | Namespaced by `changeSetId` and document ID; never public/canonical heads |
| Upload ingress | Private R2 `textbook-upload-quarantine` bucket | Presigned PUT; 24-hour lifecycle; no public route |
| Submitted snapshots, release snapshots, preview snapshots, build artifacts, exports | Private R2 versioned buckets/prefixes | Content-addressed, checksummed, retention-locked where supported |
| Media/release dispatch | Cloudflare Queues with explicit DLQs | Job ID/run lineage; consumers are idempotent |
| Media inspection | Protected GitHub Actions OCI job in P0 | ClamAV/libmagic/qpdf or mutool/Sharp/ffprobe; signed callback; replace with a dedicated container only if volume warrants |
| Release build | Protected GitHub Actions environment | Pinned image/toolchain; reads immutable snapshot, not current D1 |
| Public release | Cloudflare Workers Versions + Static Assets | Upload version, smoke-test preview, serialized promote/rollback |
| MCP | Separate Cloudflare Worker at protected MCP origin | Streamable HTTP facade over Content API; no database credential |

The D1/R2 layer is the accepted editorial-content authority after cutover as well as the operational and immutable-snapshot layer.

### 4.4 Architectural invariants

1. Git and D1 are never simultaneous writable authorities for one chapter.
2. The public reader never queries mutable editorial data.
3. Every mutation is attributable to an actor and run.
4. Every mutation names an expected base revision.
5. Every retryable mutation accepts an idempotency key.
6. Every addressable block has a stable ID assigned by the server.
7. Checkpoints and media reference stable IDs, never array positions or CSS selectors.
8. Provider markup is data to inspect and discard, never content to render.
9. External embeds are optional enhancements; first-party fallbacks carry the pedagogical meaning.
10. Only a frozen, validated snapshot can become a release.

Editor validation is an authoring aid, not the security boundary. Production uses a standalone Textbook Editor that routes every authoritative edit through semantic Content API commands; no browser receives direct D1/R2 write credentials. The editor may keep an incomplete local form, but autosave persists it only to an isolated API change set—not to a shared canonical head—and invalid work cannot be submitted or released.

---

## 5. Canonical content contract

Create one versioned TypeScript contract package and derive JSON Schema, OpenAPI schemas, D1 persistence mappings, validators, MCP tool schemas, migration checks, and renderer types from it. Do not maintain parallel handwritten definitions.

### 5.1 Book and chapter projections

D1 stores append-only normalized `chapterRevision` records and related block rows. `ChapterBundle` is the deterministic provider-neutral projection returned by `ContentRepository` and consumed by validators, renderers, derivatives, API callers, and release snapshots. It is not a second writable representation.

```ts
type ChapterBundleBase = {
  schemaVersion: 2;
  chapterId: string;
  contentKey: string;
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  part: PartReference;
  order: number;
  chapterVersion: string;
  revisionId: string;
  body: ChapterBlock[];
  reasoningObjective: string;
  readingRecordLicense: "CC0-1.0";
  sidePanelModules: SidePanelModule[];
  annotations: AnnotationRecord[];
  sources: SourceReference[];
  people: ChapterPersonRelation[];
  concepts: ChapterConceptRelation[];
  traditions: ChapterTraditionRelation[];
  worldLayer: WorldLayerRecord;
  diagrams: DiagramReference[];
  mediaPlacementIds: string[];
  rightsCaseIds: string[];
  licenses: LicenseBundle;
  exports: ExportPolicy;
  aliases: IdentityAlias[];
  tombstones: IdentityTombstone[];
  updatedBy: ActorReference;
  updatedAt: string;
};

type DraftChapterBundle = ChapterBundleBase & {
  status: "draft" | "inReview";
  checkpoints: PromptCheckpoint[]; // validated as 0..3 with unique fixed slots
};

type PublishableChapterBundle = ChapterBundleBase & {
  status: "approved" | "published";
  checkpoints: [PromptCheckpoint, PromptCheckpoint, PromptCheckpoint];
};

type ChapterBundle = DraftChapterBundle | PublishableChapterBundle;

type BookReleaseSnapshot = {
  schemaVersion: 2;
  book: BookMetadata;
  parts: PartReference[];
  chapters: PublishableChapterBundle[];
  contentObjects: Record<
    string,
    { type: ContentObjectType; domainRevisionId: string; sha256: string }
  >;
  authorityRegistry: Record<string, ContentSourceDescriptor>;
};
```

`ChapterBlock` is a discriminated union:

- `heading`;
- `paragraph`;
- `list`;
- `blockquote`;
- `codeBlock`;
- `table`;
- `callout`;
- `mediaFigure`;
- `externalEmbed`;
- `richLink`;
- `diagram`;
- `legacyMarkup`.

Every block carries an immutable `blockId`. Every passage-bearing block also carries its existing immutable `passageId`. Headings retain their existing public section IDs. A block may be moved without changing identity.

The complete release graph includes book/part metadata, chapter metadata, annotations, side-panel relationships, reading-record objective/license/checkpoints, sources, people/entities, concepts, traditions, world-layer records, diagrams, media, embeds, rights, export policy, aliases, and tombstones. An existing sidecar must either appear in `contentObjects` or be explicitly classified as code-owned and pinned by code provenance; it cannot float outside the snapshot.

The importer must not naïvely round-trip the corpus through a generic WYSIWYG editor. Complex raw asides and tables that cannot be represented losslessly in the first contract become **locked `legacyMarkup` blocks**. New `legacyMarkup` creation is forbidden. Imported legacy blocks remain rendered and sanitized, but can only be converted through an explicit migration command with before/after visual review.

#### Normalized block storage boundary

- A D1 `chapterRevision` stores normalized `ChapterBlock` rows, not an opaque rich-text blob.
- Each addressable block has `blockId` and, where applicable, `passageId` or `sectionId`. Imported IDs equal the existing stable public ID; the server allocates all new IDs.
- Public identity comes from the explicit ID field; storage row keys are not public anchors.
- Each paragraph, heading, list item, quote, table, callout, figure, embed, diagram, and legacy block has its own stable block identity. List grouping is derived without sacrificing item passage IDs.
- Inline spans use storage-local keys; they do not become public anchors.
- Reordering preserves IDs. Split/merge/delete use semantic operations and write aliases/tombstones.
- `normalizeChapterBlocks()` is pure and versioned. Import/export transforms exist only for migration/round-trip tests, not routine authoring.
- The release snapshot contains the normalized projection and its hash, so a later serializer change cannot alter an existing release.

### 5.2 Stable-ID rules

- The server assigns all new chapter, block, passage, figure, embed, media, checkpoint, and release IDs.
- The editor and agents cannot edit IDs directly.
- D1 revision/version guards are used only for backend compare-and-swap. The domain `revisionId` is an append-only server ID bound to a content hash and remains portable outside D1.
- Splitting a passage retains the original ID on the first semantic segment and creates a new ID for the second, unless the editor explicitly chooses the opposite.
- Merging passages retains one ID and writes a tombstone/alias for the retired ID.
- Deleting an anchored passage is blocked until every checkpoint, media placement, source, annotation, and downstream reference is moved or explicitly retired.
- Editing the prose of an anchored passage updates an excerpt hash and marks its dependents `needsSemanticReview`; mere existence of the ID is not enough.
- Slug changes generate an impact report and redirect plan. They never mutate Canvas links automatically.

### 5.3 Prompt checkpoints

The migration baseline’s `docs/READING_RECORD_PROMPT_DESIGN.md` remains controlling: exactly three checkpoints per chapter, in a Commit–Work–Reconcile sequence. The editor supports “Add checkpoint” while a chapter has fewer than three; once three exist, the action is disabled with a clear explanation. A checkpoint may be edited, moved to a different passage, or replaced without changing the fixed count.

```ts
type PromptCheckpoint = {
  checkpointId: string;             // immutable
  legacyId?: string;                // e.g. opening-judgment
  passageId: string;
  passageExcerptHash: string;
  slot: "commit" | "work" | "reconcile";
  stage: string;
  strategy:
    | "initial-judgment"
    | "self-explanation"
    | "argument-reconstruction"
    | "evidence-warrant"
    | "contrast-case"
    | "counterexample"
    | "consider-alternative"
    | "objection-repair"
    | "question-generation"
    | "epistemic-calibration"
    | "framework-comparison"
    | "transfer"
    | "metacognitive-trace";
  title: string;
  trigger: string;
  prompt: string;
  guidance: string;
  responseStructure: "prose" | "movement-plus-prose";
  rationale: string;
  editorialApprovalId?: string;
};
```

Draft validation permits zero to three checkpoints with no duplicate slot. Publish validation requires exactly one Commit, one Work, and one Reconcile checkpoint in that order. The inline checkpoint trigger and the side-panel checkpoint render from this single record. No duplicated sidebar copy is allowed. The first renderer migration must preserve the existing `ReadingRecord.astro` behavior, including page-memory-only responses and the hard three-checkpoint progression.

A checkpoint’s semantic approval binds to the checkpoint content hash, anchor passage ID, and anchor excerpt hash. Editing the prompt, guidance, rationale, strategy, response structure, anchor, or anchored prose invalidates that approval. Automated validation can enforce structure and completeness; an instructor performs the pedagogical review.

### 5.4 Reusable media assets and contextual placements

Separate the reusable binary from its chapter-specific rhetorical use.

```ts
type MediaAsset = {
  mediaId: string;
  title: string;
  versionIds: string[];
};

type MediaAssetVersion = {
  mediaVersionId: string;            // immutable; replacement creates a new version
  mediaId: string;
  kind: "image" | "animatedImage" | "shortVideo" | "audio" | "document";
  sourceAssetRef: string;
  posterAssetRef?: string;
  derivatives: MediaDerivative[];
  technical: {
    mimeType: string;
    bytes: number;
    width?: number;
    height?: number;
    frameCount?: number;
    durationMs?: number;
    sha256: string;
  };
  accessibility: {
    longDescription?: RichText;
    transcript?: RichText;
    captionTrackRef?: string;
    motionReview?: "passed" | "reviewRequired";
    flashReview?: "passed" | "reviewRequired";
  };
  processing: {
    status: "created" | "uploading" | "quarantined" | "processing" | "ready" | "failed";
    processorVersion: string;
    errorCode?: string;
  };
  createdAt: string;
  createdBy: ActorReference;
};

type RightsCase = {
  rightsCaseId: string;
  subject: {
    mediaVersionId: string;
    sourceRevision?: string;
    transformationsHash: string;
    placementId?: string;            // required for context-bound fair use/permission
    projections: ("web" | "print" | "offline" | "download" | "voice")[];
    downloadable: boolean;
  };
  creator?: string;
  sourceUrl?: string;
  license:
    | "cc0"
    | "publicDomain"
    | "ccBy"
    | "ccBySa"
    | "fairUse"
    | "permission"
    | "owned"
    | "unknown";
  licenseUrl?: string;
  attribution: string;
  evidenceRefs: EvidenceReference[];
  notes?: string;
  status: "reviewRequired" | "cleared" | "blocked";
  approvedBy?: ActorReference;
  approvedAt?: string;
  approvedSubjectHash?: string;
};

type EditorialApproval = {
  approvalId: string;
  subjectType: "checkpoint" | "mediaPlacement" | "chapterRevision" | "releaseCandidate";
  subjectId: string;
  subjectHash: string;
  approvedBy: ActorReference;
  approvedAt: string;
  notes?: string;
};
```

```ts
type MediaFigure = {
  type: "mediaFigure";
  figureId: string;
  blockId: string;
  mediaId: string;
  mediaVersionId: string;
  rightsCaseId: string;
  anchorPassageId?: string;
  decorative: boolean;
  alt?: string;
  caption?: RestrictedRichText;
  captionOmissionReason?: string;    // required when caption is absent
  teachingUse: string;
  creditOverride?: string;
  displayPreset: "narrow" | "reading" | "wide" | "bleed";
  align: "start" | "center" | "end";
  cropOverride?: Crop;
  focalPointOverride?: Point;
  animationPolicy?: "clickToPlay" | "playOnce" | "loopWithControls";
  printPolicy: "poster" | "firstFrame" | "omit";
  downloadable: boolean;
  editorialApprovalId?: string;
};
```

Alt text, caption, crop, teaching use, and semantic accessibility approval belong to the placement because the same image can do different intellectual work in different chapters. Binary/provenance metadata belongs to an immutable asset version. Rights evidence and clearance have one canonical authority: `RightsCase`, bound to an exact asset version, source revision, transformation hash, use/placement scope, downloadable status, and release projections.

Replacing a binary always creates a new `MediaAssetVersion`; existing placements and releases continue to pin the prior version. Changing the binary, source revision, license, credit, transformation/crop, download policy, projection, contextual caption, alt text, transcript equivalence, or teaching use invalidates the applicable rights and/or editorial approval. Fair-use clearance is placement-specific and cannot be globally inherited by every use of a reusable asset.

### 5.5 External embeds

```ts
type ProviderIdentity =
  | { provider: "youtube"; resourceType: "video" | "playlist"; resourceId: string }
  | { provider: "vimeo"; resourceType: "video"; resourceId: string; unlistedHash?: string }
  | { provider: "x"; resourceType: "post"; resourceId: string }
  | { provider: "spotify"; resourceType: "artist" | "album" | "track" | "show" | "episode"; resourceId: string }
  | { provider: "soundcloud"; resourceType: "user" | "set" | "track"; resourceId: string }
  | { provider: "bluesky"; resourceType: "post"; resourceId: string };

type ExternalEmbed = {
  type: "externalEmbed";
  embedId: string;
  blockId: string;
  anchorPassageId?: string;
  identity: ProviderIdentity;
  canonicalUrl: string;
  caption: RestrictedRichText;
  teachingUse: string;
  displayPreset: "compact" | "reading" | "wide";
  theme: "light" | "dark" | "auto";
  options: ProviderSpecificOptions;
  fallback: {
    title: string;
    summary: RestrictedRichText;
    posterAssetId?: string;
    transcript?: RestrictedRichText;
    linkLabel: string;
    creator?: string;
    publishedAt?: string;
    accessedAt: string;
  };
  adapterVersion: string;
  editorialApprovalId?: string;
};

type RichLinkBlock = {
  type: "richLink";
  linkId: string;
  blockId: string;
  anchorPassageId?: string;
  canonicalUrl: string;
  title: string;                     // instructor-authored
  summary: RestrictedRichText;       // instructor-authored
  teachingUse: string;
  linkLabel: string;
  posterMediaVersionId?: string;
  accessedAt: string;
  editorialApprovalId?: string;
};

type EmbedHealthObservation = {
  observationId: string;
  embedId: string;
  checkedAt: string;
  adapterVersion: string;
  status: "ok" | "restricted" | "missing" | "error" | "unknown";
  httpStatus?: number;
  errorCode?: string;
};
```

The schema must not contain `embedHtml`, `iframeSrc`, raw query parameters, arbitrary CSS classes, shortcodes, or script source. Provider options are discriminated by provider so an agent cannot pass X options to YouTube or smuggle an unsupported player parameter.

Health observations are operational D1 records, not mutable fields inside hashed editorial content. A release check may attach the current observation to its build attestation, but routine health updates do not change an embed definition or historical release hash.

An unsupported URL becomes a `RichLinkBlock` only when it is HTTPS, has no embedded credentials, and uses a public DNS hostname rather than localhost, an IP literal, or a private/reserved name. P0 does not fetch arbitrary URLs for titles, images, or descriptions. The instructor/agent supplies the title, summary, teaching use, and optional rights-cleared first-party poster. A future arbitrary-URL metadata fetcher would require a separate isolated SSRF/security ADR and does not weaken this rule.

### 5.6 Change sets and revisions

```ts
type ChangeSet = {
  changeSetId: string;
  targets: {
    documentId: string;
    documentType: ContentObjectType;
    baseDomainRevisionId: string;
    baseStorageVersion: string;       // backend CAS only
    workingDocumentId: string;        // isolated changeset.<id>.<document>
  }[];
  state: "draft" | "inReview" | "approved" | "merged" | "rejected" | "superseded";
  operations: SemanticOperation[];
  actor: ActorReference;
  runId?: string;
  createdAt: string;
  updatedAt: string;
  beforeSnapshot: { uri: string; sha256: string };
  workingSnapshot: { uri: string; sha256: string };
  submittedSnapshot?: { uri: string; sha256: string };
  validationSummary: ValidationSummary;
  reviewNotes: ReviewNote[];
  contentApprovalIds: string[];
  rightsApprovalIds: string[];
};
```

Each Textbook Editor workspace or agent job opens or resumes an explicit `changeSetId`. API commands mutate only isolated `changeset.<changeSetId>.<documentId>` working documents; they do not mutate a shared canonical draft. A change set may span a chapter plus shared media, rights, source, entity, or diagram documents. Autosave persists semantic operations and a working-snapshot hash.

Submission freezes an immutable submitted snapshot. Approval records bind to that hash. Merge rechecks every target with D1 version-guarded compare-and-swap, creates new append-only domain revisions, atomically advances all affected D1 heads, and writes an audit record in the same transaction. If any base has changed, merge returns a semantic conflict/rebase object; it does not partially apply. Rejection or abandonment cannot require “undo” because canonical heads were never changed. Working documents can be garbage-collected after retention while operations, snapshots, approvals, and audit remain append-only.

Hard deletion is unavailable in routine UI and agent scopes.

### 5.7 Immutable release records

```ts
type ContentSourceDescriptor =
  | { authority: "git"; gitSha: string; sourcePath: string; normalizedSnapshotHash: string }
  | { authority: "d1"; databaseId: string; domainRevisionId: string; normalizedSnapshotHash: string };

type ReleaseCandidateManifest = {
  candidateId: string;
  sequence: number;
  createdAt: string;
  createdBy: ActorReference;
  expectedActiveReleaseId: string | null;
  contractVersion: string;
  authorityRegistry: Record<string, ContentSourceDescriptor>;
  snapshot: { uri: string; sha256: string; bytes: number };
  contentObjects: Record<string, { type: ContentObjectType; domainRevisionId: string; sha256: string }>;
  sourceAssets: Record<
    string,
    | { authority: "git"; gitSha: string; sourcePath: string; sha256: string }
    | { authority: "r2"; r2ObjectKey: string; mediaVersionId: string; sha256: string }
  >;
  approvalIds: string[];
  codeProvenance: {
    gitSha: string;
    protectedRef: string;
    lockfileSha256: string;
    nodeVersion: string;
    buildImageDigest: string;
    contractVersion: string;
  };
  manifestSha256: string;
  signature: string;
};

type BuildAttestation = {
  attestationId: string;
  candidateId: string;
  candidateManifestSha256: string;
  checks: CheckResult[];
  embedHealthObservations: string[];
  releaseAssets: Record<string, { releaseUrl: string; sha256: string }>;
  artifact: { uri: string; sha256: string; bytes: number };
  cloudflareVersionId: string;
  previewUrl: string;
  builtAt: string;
  signature: string;
};

type DeploymentReceipt = {
  receiptId: string;
  candidateId: string;
  attestationId: string;
  previousActiveReleaseId: string | null;
  expectedActiveReleaseId: string | null;
  cloudflareDeploymentId: string;
  cloudflareVersionId: string;
  promotedAt: string;
  promotedBy: ActorReference;
  verificationHash: string;
};

type ActiveReleasePointer = {
  releaseId: string;
  candidateId: string;
  attestationId: string;
  deploymentReceiptId: string;
  sequence: number;
};
```

Candidate creation first serializes and persists the complete normalized snapshot, then hashes and signs the immutable manifest. The build reads that snapshot URI and verifies the hash; it never rereads current D1 content. `buildChecks`, asset release URLs, artifact hashes, and deployment IDs are not appended to the supposedly immutable candidate; they live in signed attestations and receipts.

Hashes use canonical JSON with the record’s own hash/signature fields omitted; the signature covers the resulting digest. IDs, timestamps, map ordering, Unicode normalization, and number serialization are deterministic and contract-tested.

The server—not the Textbook Editor or an agent—selects `codeProvenance.gitSha` from an allowlisted protected branch commit with green required checks. It also pins the lockfile, Node version, build-image digest, and contract version. A client cannot provide arbitrary renderer code.

The complete restorable release is the signed candidate manifest + normalized snapshot + build attestation + immutable artifact + deployment receipt. These records have explicit R2 URIs/hashes and retention and do not depend on live D1 revisions. Rollback changes the active release pointer/deployment as a serialized complete unit; it does not reconstruct a chapter from current database state.

---

## 6. Media architecture

### 6.1 Media tiers

| Tier | Capability | Initial decision | Runtime behavior |
|---|---|---|---|
| Native/P0 | Still images | Ship | First-party renderer; responsive derivatives; full rights and accessibility record |
| Native/P0 | Animated GIF/WebP | Ship | Static poster by default; animate only after click; Stop control; reduced-motion support |
| Native/P0 | Short MP4/WebM | Ship with configured size/duration budget | Native `<video>` with controls; no autoplay; poster; captions/transcript where needed |
| Native/P0 | Short audio | Ship | Native `<audio>` with controls; transcript where needed |
| Native/P0 | PDF/document | Ship | Designed document card/download; accessible title, type, size, source, and summary |
| Adapter/P0 | YouTube | Ship | First-party card, then privacy-enhanced player after activation |
| Adapter/P0 | Vimeo | Ship | First-party card, then DNT-configured player after activation |
| Adapter/P0 | X post | Ship | First-party fallback, then official X widget after activation |
| Native/P0 | Generic link card | Ship | First-party title/summary/canonical URL; no arbitrary embed |
| Adapter/P1 | Spotify | Add after P0 cutover | Click-to-load official embed |
| Adapter/P1 | SoundCloud | Add after P0 cutover | Click-to-load; force autoplay off |
| Adapter/P1 | Bluesky | Add after P0 cutover | Click-to-load official widget; deleted/restricted fallback |
| Adapter/P2 | TikTok | Add only for an actual chapter need | Provider-specific security/privacy/browser test first |
| Adapter/P2 | Instagram/Facebook | Add only after app/token requirements are accepted | Provider-specific authenticated resolver |
| Adapter/P2 | Mastodon, Reddit, Giphy/Tenor, SlideShare/Scribd/Issuu, TED, podcast/RSS | Link card until a chapter requirement justifies an adapter | No generic oEmbed discovery |
| Prohibited | Arbitrary iframe/script/HTML/oEmbed HTML | Never | Reject at editor, API, MCP, import, and build layers |

The adapter interface exists from the first implementation, so P1/P2 providers do not require a content-schema redesign.

### 6.2 Provider-adapter contract

```ts
interface EmbedAdapter<P extends Provider> {
  provider: P;
  match(inputUrl: URL): boolean;
  normalize(inputUrl: URL): CanonicalProviderIdentity<P>;
  resolve(identity: CanonicalProviderIdentity<P>, signal: AbortSignal): Promise<ResolvedProviderMetadata<P>>;
  validateOptions(options: unknown): ProviderOptions<P>;
  toRenderPlan(embed: ExternalEmbedFor<P>): EmbedRenderPlan;
  toFallback(embed: ExternalEmbedFor<P>): StaticEmbedFallback;
  cspRequirements: CspRequirement;
  healthCheck(identity: CanonicalProviderIdentity<P>): Promise<EmbedHealth>;
  policyVersion: string;
}
```

Each adapter must define:

- accepted HTTPS hostnames and URL patterns;
- canonical URL and provider resource-ID parsing;
- allowed options and defaults;
- authoring-time resolver endpoint;
- whether an iframe or official widget is used;
- exact CSP and Permissions Policy additions;
- click-to-load disclosure copy;
- no-JS, offline, and print fallback;
- unavailability behavior;
- health-check logic and cadence;
- provider terms/attribution notes;
- fixtures for public, private, deleted, restricted, malformed, and timeout cases.

### 6.3 Upload and processing workflow

Upload processing, rights review, editorial approval, and release inclusion are separate axes:

```text
processing:       created -> uploading -> quarantined -> processing -> ready | failed
rights case:      reviewRequired -> cleared | blocked
editorial review: no approval -> hash-bound EditorialApproval
publishable:      computed from all contract, rights, accessibility, and placement gates
published:        a fact recorded by a particular immutable release manifest
```

A reusable asset is never globally marked “published,” because different placements and releases can use it with different captions, approvals, and versions.

1. Editor or MCP calls `begin_media_upload` with a sanitized basename, claimed MIME, byte size, and SHA-256. Absolute paths and path separators are rejected.
2. The API validates scope, creates an opaque random quarantine key, and returns a short-lived presigned URL for a dedicated private Cloudflare R2 quarantine bucket. No D1/R2 credential is returned to any client.
3. A browser uploads directly to the presigned target. An agent uses an attached MCP resource/upload handle or a Skill-side streaming client restricted to an approved workspace file; the file body never passes through model context.
4. `complete_media_upload` verifies the R2 object’s byte count and hash, then schedules the sanctioned media processor.
5. The processor verifies the actual MIME signature, dimensions, frame count, duration, active content, and decode limits. Unsupported MIME types, active SVG, polyglots, decompression bombs, oversized files, and mismatched hashes are blocked.
6. The server promotes the verified object to the immutable private R2 media store under its content hash, records the object reference and technical metadata in D1, verifies the final checksum, and deletes the R2 quarantine object. A bucket lifecycle rule removes abandoned objects after 24 hours.
7. System metadata becomes read-only.
8. The instructor or media agent adds proposed rights, alt text, caption, teaching use, transcript, placement, crop, and display preset.
9. An instructor approves rights when the license is not already deterministically verifiable.
10. Publication materializes the exact approved asset and derivatives referenced by the release manifest.

The standalone editor uses the same custom upload input and quarantine path, so manual and agent uploads receive the same checks.

P0 disallows SVG uploads. Existing code-owned SVG diagrams may remain under the code/release pipeline until a separate sanitizer and raster fallback path is approved.

Initial house budgets are configuration, not provider assumptions:

- animated image: at most 10 MB and 50 total megapixels (`width × height × frames`);
- larger animation: require an MP4/WebM derivative before publication;
- uploaded short video/audio/document: set explicit byte and duration limits during the vertical spike based on Cloudflare artifact limits and representative course media;
- any file over the configured budget: fail closed with a human-readable remediation path.

P0 downloadable-document formats are PDF and UTF-8 plain text only. The processor runs malware scanning, MIME/magic validation, and PDF structural inspection; it rejects encryption, JavaScript, launch actions, embedded files, forms, multimedia actions, suspicious URLs, and polyglots, then rewrites accepted PDFs through a deterministic qpdf/mutool normalization step. Office documents, archives, and active documents remain blocked until a reviewed content-disarm pipeline exists. Published documents receive correct `Content-Type`, `X-Content-Type-Options: nosniff`, a safe content disposition, and an accessibility status. An assigned document must have either a passed manual accessibility review or a substantive accessible HTML equivalent.

### 6.4 GIF and animated-image behavior

1. Store the original animated image as an immutable R2 media object.
2. Inspect dimensions, frame count, bytes, MIME, and flash/motion review status.
3. Generate a first-frame still as the poster during the sanctioned media job.
4. The public page initially renders only the still poster and a “Play animation” control.
5. On activation, replace the poster source with the animated rendition.
6. “Stop animation” swaps back to the still poster and returns focus predictably.
7. `prefers-reduced-motion: reduce` never auto-activates motion and strengthens the static treatment.
8. No-JS, offline, and print use the first frame and label it as an animation.
9. Large or frequently reused GIFs receive MP4/WebM derivatives in the P1 optimization pipeline.
10. Animation that flashes above the permitted threshold is blocked from publication.

### 6.5 YouTube adapter

- Accept only normalized video and playlist URLs from approved YouTube hosts.
- Store the video/playlist ID and supported options, not iframe HTML.
- The initial card uses only first-party copy and a rights-cleared first-party poster or a generic video placeholder. Do not contact YouTube for a thumbnail before activation.
- On activation create `https://www.youtube-nocookie.com/embed/{videoId}`.
- Default to `autoplay=0`, `controls=1`, captions on when available, and no JS API.
- If the JS API is later required, include the exact public origin.
- Use a responsive viewport of at least 480 × 270 where space permits.
- Use `referrerpolicy="strict-origin-when-cross-origin"`; do not use `no-referrer`, which can prevent YouTube client identification.
- Never obscure or replace standard player controls.
- Private, removed, age-restricted, region-restricted, and embedding-disabled videos degrade to the authored fallback.
- Offline packages never download or rehost YouTube media.

### 6.6 Vimeo adapter

- Preserve the full normalized URL because unlisted video hashes can be significant.
- Resolve availability through the official Vimeo endpoint at authoring time.
- After activation render the fixed `player.vimeo.com` URL with `dnt=1`, `preload=none`, `autoplay=0`, `controls=1`, and captions/transcript options where supported.
- `dnt=1` limits Vimeo session analytics; it does not make the player cookie-free. Previously stored Vimeo cookies may still be sent, and Vimeo may set essential security cookies. The activation disclosure must say that loading the player contacts Vimeo.
- Domain-restricted and unlisted behavior must be tested with the production origin and Referer behavior.
- Do not obscure Vimeo branding or controls.
- Missing, private, disabled, or restricted videos degrade to the authored fallback.

### 6.7 X adapter

X is the most operationally brittle P0 provider and receives a daily health check. Its authored rich fallback is the default experience; the official widget is a consent-gated enhancement only.

- Accept only canonical public post URLs and extract the post ID.
- Store the canonical URL/ID, display options, and instructor-authored fallback—not oEmbed HTML, mutable health state, or a cached copy of the post.
- Only after explicit activation and connection disclosure, load the official `https://platform.x.com/widgets.js` and call `twttr.widgets.createTweet()` with `dnt: true` and approved options.
- Do not reconstruct the post with custom HTML, create a screenshot-style imitation, or place X content in a custom iframe.
- Add X script/frame/connect domains only to pages/releases containing an X block, after a CSP report-only compatibility pass in Chrome, Safari, and Firefox.
- Deleted, protected, suspended, age-gated, or unavailable content must surface the instructor-authored summary and canonical link. An edited post remains live through the official widget; a detected edit may raise an editorial-review alert but does not trigger a counterfeit cached rendering.
- A health job records advisory availability and alerts the instructor; it never silently rewrites the chapter and its cached status never certifies that the client widget will render.
- The reader keeps the fallback visible until `twttr.widgets.createTweet()` resolves with an inserted element. Script-load failure, promise rejection, a missing returned element, or timeout restores the fallback and direct link.
- Provider text does not enter agent context unless the instructor explicitly asks to inspect it. Provider content is untrusted and cannot influence tool policy.

The official X widget is the one explicit P0 third-party-script exception: the script URL and invocation are code-owned by the reviewed adapter and cannot be supplied or changed by chapter content. It executes only after activation, which is a larger trust grant than a cross-origin video iframe. If it fails policy/browser gates, the supported X experience remains the rich citation/fallback card plus “Open on X,” never arbitrary code or a custom iframe.

### 6.8 Authoring-time URL resolver

The resolver is not an open web proxy.

1. Accept HTTPS only.
2. Match the URL against a compiled provider hostname allowlist before any request.
3. Parse a provider-specific canonical ID locally.
4. Call a fixed official endpoint, not arbitrary oEmbed discovery.
5. Resolve DNS and reject loopback, link-local, private, multicast, reserved, and metadata-service addresses.
6. Revalidate the destination after every redirect; cap redirects, bytes, and wall time.
7. Validate content type and response shape.
8. Treat every returned string as untrusted.
9. Discard all returned HTML and scripts.
10. Return a typed proposal containing identity, permitted metadata, health, warnings, and required fallback fields.
11. Recheck on release and through scheduled health jobs.
12. Unsupported URLs become instructor-authored link cards without an arbitrary metadata fetch.

### 6.9 Reader rendering and fallbacks

| Surface | Uploaded image/GIF | YouTube/Vimeo | X/Bluesky | Audio/video | Document |
|---|---|---|---|---|---|
| Interactive web, before activation | First-party image/poster | First-party card/poster | First-party citation card | Poster/player controls | Document card |
| Interactive web, after activation | Controlled animation | Official iframe | Official widget | Native controls | Download/new tab |
| No JavaScript | Still/first frame, caption, credit | Title, summary/transcript, URL | Title, summary, creator/date, URL | Poster, transcript, download | Document card/download |
| Offline HTML | Pinned still/first frame | No player; fallback only | No widget; fallback only | Pinned file if within package budget, otherwise summary/source | Pinned file if licensed and within budget |
| Print/PDF | Still/first frame, caption, credit | Poster, summary/transcript, canonical URL | Summary/citation/canonical URL | Poster/transcript/source | Title/type/source URL |
| Provider outage | Unaffected | Authored fallback | Authored fallback | Unaffected | Unaffected |

An embed can never contain the only copy of an assigned question, essential claim, evidence, definition, or instruction.

### 6.10 Content Security Policy

The default reading page remains close to:

```text
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
media-src 'self';
connect-src 'none';
frame-src 'none';
object-src 'none';
base-uri 'none';
frame-ancestors 'none';
form-action 'none';
```

Phase 0 captures the current built reader’s inline-script/style hashes and CSP compatibility; the displayed baseline is a target, not permission to break the existing reader. The build externalizes inline code where practical and otherwise computes exact CSP hashes.

Every adapter record defines exact `frame-src`/`script-src`/`connect-src` origins, iframe `src`, `title`, `allow`, `sandbox` decision, referrer policy, credential/cookie behavior, top-navigation behavior, and rationale. `sandbox: null` is an explicit reviewed value for YouTube/Vimeo when the provider has no supported sandbox profile; it is not an omitted decision. X begins under `Content-Security-Policy-Report-Only`; observed official domains are pinned before enforcement.

The release build generates `dist/_headers` from the route-to-adapter registry. It emits a default rule plus exact chapter route rules, CSP hashes, `frame-ancestors`, Permissions Policy, Referrer Policy, and document/media headers. Cloudflare Workers Static Assets serves those as HTTP headers. P0 remains under the platform’s 100-rule and 2,000-character-line limits; if the generated file would exceed either, the build fails and the implementation moves policy generation to Worker middleware with `assets.run_worker_first`, rather than silently dropping headers. Deployed-header tests fetch the production-like version URL and compare every security header to the manifest.

No provider request may occur before activation. `loading="lazy"` is not sufficient because it still contacts the provider near the viewport.

---

## 7. Browser authoring experience

Deploy the standalone Textbook Editor at a protected hostname such as `editor.ethicsandai.your-digital-life.org`. The authenticated instructor has no direct database access; all edits, uploads, approvals, and releases call the Content API with an explicit `changeSetId`, base revision, idempotency key, and actor/run identity.

Draft preview uses a cross-site versioned Workers preview origin such as `https://<version>-ethicsandai-preview.<account>.workers.dev`, protected by Cloudflare Access. It receives a one-time, short-lived, read-only token bound to one immutable R2 snapshot hash. It has no database credential, authoring cookie, Content API mutation scope, or access to another draft. Responses are `Cache-Control: no-store`, `X-Robots-Tag: noindex`, and strict CSP; `frame-ancestors` permits only the exact editor origin. Preview XSS therefore cannot reuse an authoring session.

### 7.1 Chapter workspace

The chapter screen has these tabs:

1. **Outline** — headings, block types, stable IDs, anchors, warnings, and drag-to-move controls.
2. **Body** — normalized structured-block editing with renderer-owned blocks for callouts, tables, figures, embeds, and diagrams.
3. **Prompt Checkpoints** — the dedicated feature described below.
4. **Media** — chapter placements plus reusable library search/upload.
5. **Sources & Rights** — citations, excerpts, licenses, rights status, and blocking omissions.
6. **Preview** — desktop, 390 px mobile, print, no-JS, offline, inline checkpoint, and side-panel projections.
7. **Diff & Impact** — semantic before/after diff, anchor changes, ID changes, derivative changes, and downstream link impact.
8. **History** — revisions, actor/run, validation result, review notes, restore-as-new-draft.

Draft saves are immediate API writes to the current isolated change set. Public publication is a separate, deliberate operation.

### 7.2 Prompt Checkpoints tab

The tab displays exactly three ordered cards:

- Checkpoint 1 — Commit;
- Checkpoint 2 — Work;
- Checkpoint 3 — Reconcile.

Each card includes:

- stable checkpoint ID, read-only;
- stage label;
- strategy selector using the controlled repertoire;
- title;
- inline trigger;
- full side-panel prompt;
- guidance;
- response-structure selector;
- instructor-only rationale;
- passage-anchor chooser;
- a live excerpt from the anchor passage;
- anchor-review status;
- inline preview;
- side-panel preview;
- character/complexity warnings based on the current two-to-five-sentence student target.

Actions:

- **Add checkpoint** when fewer than three exist;
- **Edit**;
- **Move anchor**;
- **Replace** while preserving an alias to the retired checkpoint ID;
- **Restore** from revision history;
- **Preview in chapter**;
- **Validate set**.

The release gate checks:

- exactly three checkpoints;
- slots are Commit, Work, Reconcile in order;
- all anchor passage IDs exist;
- all anchor excerpt hashes are current or explicitly reapproved;
- prompt fields satisfy the current design document;
- response structure is supported by `ReadingRecord.astro`;
- inline and side-panel output derive from the same object;
- no student response persistence or network path has been introduced.

### 7.3 Media library and placement editor

The media UI supports:

- drag-and-drop file upload;
- paste supported provider URL;
- search by title, creator, license, kind, chapter, and usage;
- duplicate detection by SHA-256 and provider ID;
- preview original and derivatives;
- crop/focal point and display-preset selection;
- context-specific alt, caption, credit override, and teaching-use fields;
- rights record and permission evidence;
- transcript/caption track upload;
- animation motion/flash review;
- passage-anchor chooser and precise before/after placement;
- web/mobile/print/offline preview;
- replace asset without silently changing an existing placement;
- impact report listing every placement of a reused asset.

The UI never offers a raw “Embed code” field.

### 7.4 Review and release controls

- `Save draft` is routine and reversible.
- `Submit for review` freezes the proposed revision and runs server validation.
- `Approve content` and `Approve rights` are distinct decisions.
- `Create release candidate` pins all chapters and assets.
- `Publish release` requires an instructor-scoped step-up confirmation for that exact release ID.
- `Restore release` requires the same and restores a complete manifest/deployment.
- The standalone editor has no ordinary publish action; only the validated release workflow can change the public textbook.

---

## 8. Content API

Implement the API as a versioned Cloudflare Worker at a protected same-site origin such as `api.ethicsandai.your-digital-life.org`. Publish an OpenAPI 3.1 contract from the shared content package.

### 8.1 Auth and roles

| Role | Read drafts | Write drafts | Upload media | Submit review | Approve rights | Publish/restore | Change schema/auth |
|---|---:|---:|---:|---:|---:|---:|---:|
| Instructor | Yes | Yes | Yes | Yes | Yes | Step-up required | No |
| Content agent | Scoped | Yes | No | Yes | No | No | No |
| Media agent | Scoped | Media/placement only | Yes, quarantine | Yes | No | No | No |
| Review agent | Scoped | Proposed patches/notes | No | Yes | No | No | No |
| Build worker | Frozen snapshot only | No | Derivatives only | No | No | Deployment candidate only | No |
| Migration operator | Time-limited full import | Time-limited | Yes | No | No | No | No |

ADR 0004 selects the complete identity path before schema implementation: GitHub OAuth with an instructor allowlist for the standalone editor, exact-origin and session-bound CSRF protection at the API, and short-lived scoped OAuth tokens for MCP agents. It records issuer/audience, JWKS caching, PKCE, agent-client registration, token lifetimes/rotation/revocation, step-up reauthentication, and the named emergency account.

Store D1/R2 bindings only in server-side Workers. A Skill or MCP connection never grants authority by itself; the API checks the authenticated scope on every call. No browser or agent receives a database/write credential.

Browser mutations also require an allowed `Origin`, a CSRF token bound to the instructor session, and strict same-site cookie settings. Agent calls use bearer tokens and never browser cookies. CORS permits only the named Textbook Editor and preview origins. The public reader origin receives no authoring credential and is not an allowed mutation origin.

### 8.2 Mutation envelope

Every mutation accepts:

```json
{
  "baseRevisionId": "rev_...",
  "idempotencyKey": "client-generated-unique-key",
  "runId": "agent-or-ui-run-id",
  "dryRun": true,
  "operation": {}
}
```

Rules:

- missing base revision: `428 PRECONDITION_REQUIRED`;
- stale base revision: `409 REVISION_CONFLICT` with a semantic conflict object;
- repeated idempotency key and same request hash: return the original result;
- repeated key with a different request hash: `409 IDEMPOTENCY_KEY_REUSED`;
- unknown field: `400 UNKNOWN_FIELD`;
- validation failure: `422 VALIDATION_FAILED` with stable machine codes and passage/block paths;
- insufficient scope: `403 FORBIDDEN`;
- unsupported provider: `422 PROVIDER_NOT_SUPPORTED` plus link-card proposal;
- no partial multi-document merge; create revisions, advance all canonical D1 heads, and write an audit record in one revision-guarded D1 transaction.

### 8.3 Read endpoints

```text
GET  /v1/schema
GET  /v1/capabilities
GET  /v1/providers
GET  /v1/chapters
GET  /v1/chapters/{chapterId}
GET  /v1/chapters/{chapterId}/outline
GET  /v1/chapters/{chapterId}/passages/{passageId}
GET  /v1/chapters/{chapterId}/dependencies
GET  /v1/search/passages?q=...
GET  /v1/media?q=...&kind=...&rightsStatus=...
GET  /v1/media/{mediaId}
GET  /v1/media/{mediaId}/versions/{mediaVersionId}
GET  /v1/embeds/{embedId}
GET  /v1/changesets/{changeSetId}
GET  /v1/releases/{releaseId}
```

Read responses expose stable identities, revision IDs, source excerpts, dependency graphs, and render-safe structured data. They do not expose service tokens, private permission evidence, or unnecessary provider payloads.

### 8.4 Draft and chapter endpoints

```text
POST /v1/chapters/{chapterId}/changesets
POST /v1/changesets/{changeSetId}:apply
POST /v1/changesets/{changeSetId}:validate
POST /v1/changesets/{changeSetId}:diff
POST /v1/changesets/{changeSetId}:renderPreview
POST /v1/changesets/{changeSetId}:submitReview
POST /v1/changesets/{changeSetId}:approve
POST /v1/changesets/{changeSetId}:reject
POST /v1/chapters/{chapterId}/revisions/{revisionId}:restoreAsDraft
```

Supported semantic operations include:

- replace passage rich text;
- insert block before/after stable block or passage;
- move block;
- split passage;
- merge passages;
- delete block with dependency disposition;
- create/update/move/replace checkpoint;
- create/update/place/replace media figure;
- create/update/check/remove external embed;
- update source or rights reference.

There is no generic “replace document JSON” endpoint in the agent API.

### 8.5 Media and embed endpoints

```text
POST /v1/media:beginUpload
POST /v1/media/{uploadId}:completeUpload
POST /v1/media/{mediaId}:updateMetadata
POST /v1/media/{mediaId}:createVersion
POST /v1/media/{mediaId}:createPlacement
POST /v1/media/{mediaId}:replaceAsset
POST /v1/rights-cases
POST /v1/rights-cases/{rightsCaseId}:approve

POST /v1/embeds:resolve
POST /v1/embeds
POST /v1/embeds/{embedId}:update
POST /v1/embeds/{embedId}:check
POST /v1/embeds/{embedId}:refreshMetadata
POST /v1/links
POST /v1/links/{linkId}:update
```

`resolve` returns a typed proposal and warnings. It never returns executable provider HTML to the caller.

### 8.6 Release endpoints

```text
POST /v1/release-candidates
POST /v1/release-candidates/{candidateId}:validate
POST /v1/release-candidates/{candidateId}:build
POST /v1/release-candidates/{candidateId}:approve
POST /v1/release-candidates/{candidateId}:publish
GET  /v1/release-candidates/{candidateId}/status
GET  /v1/release-candidates/{candidateId}/checks
GET  /v1/release-candidates/{candidateId}/artifacts
GET  /v1/releases/{releaseId}
POST /v1/releases/{releaseId}:restore
POST /v1/releases/{releaseId}:verifyDeployment
```

`publish` and `restore` require:

- instructor scope;
- an exact candidate/restore release ID;
- a single-use short-lived approval token bound to instructor identity, action, candidate-manifest hash, build-attestation hash, exact Cloudflare version/artifact, and current active-release ID;
- an idempotency key;
- a typed confirmation phrase in the editor UI;
- complete audit logging.

Any change to the candidate, approval set, check result, artifact, permission, Cloudflare version, or active release invalidates the token. Promotion and rollback enter one book-wide serialized D1 queue/lock. Candidate sequence numbers are monotonic; promotion performs compare-and-swap against `expectedActiveReleaseId`; stale candidates fail closed. Rollback uses the same lock and CAS path so it cannot race a publish.

### 8.7 Audit events

Each event records:

- event ID and timestamp;
- actor identity and role;
- UI/MCP/API client and version;
- run ID and parent run ID;
- operation type;
- target IDs;
- base and resulting revision IDs;
- idempotency key hash;
- validation summary;
- approval identity when applicable;
- release/deployment ID when applicable.

Logs contain no bearer tokens, full draft bodies, uploaded file bodies, or provider response HTML. Use redaction canaries in tests.

---

## 9. MCP and Skills

The MCP server is an adapter over the Content API. It does not connect directly to D1/R2 with a general-purpose credential.

### 9.1 P0 MCP tools

| Tool | Purpose | Read-only | Open-world | Agent default |
|---|---|---:|---:|---:|
| `list_chapters` | List IDs, titles, status, revision, warnings | Yes | No | Yes |
| `get_chapter` | Return selected structured content and revision | Yes | No | Yes |
| `get_passage_graph` | Return passages and dependent prompts/media/sources | Yes | No | Yes |
| `search_passages` | Search by text/concept/ID | Yes | No | Yes |
| `search_media` | Find reusable media/version/rights records | Yes | No | Yes |
| `get_media` | Inspect one media asset and pinned versions/placements | Yes | No | Yes |
| `create_changeset` | Open a revisioned draft | No | No | Yes |
| `apply_changeset` | Apply typed semantic operations | No | No | Yes |
| `upsert_reading_checkpoint` | Create/update one fixed-slot checkpoint | No | No | Yes |
| `resolve_embed` | Normalize and inspect an allowlisted provider URL | Yes with respect to textbook state | Yes | Yes |
| `insert_embed` | Insert a resolved typed embed | No | No | Yes |
| `insert_link_card` | Insert an instructor-authored safe rich link | No | No | Yes |
| `begin_media_upload` | Create a short-lived sanctioned upload | No | Yes | Scoped media agents only |
| `complete_media_upload` | Verify and quarantine uploaded media | No | No | Scoped media agents only |
| `insert_figure` | Place media with alt/caption/teaching use | No | No | Yes |
| `validate_changeset` | Run all server validators | Yes | No | Yes |
| `render_preview` | Build protected preview projections | No, creates preview artifact | No | Yes |
| `diff_changeset` | Return semantic and output impacts | Yes | No | Yes |
| `submit_for_review` | Freeze and submit a proposal | No | No | Yes |
| `create_release_candidate` | Freeze an approved book snapshot | No | No | Release-steward scope only |
| `validate_release_candidate` | Queue/check full candidate validation | No | Yes | Release-steward scope only |
| `get_release_status` | Read candidate/check/artifact/approval state | Yes | No | Release-steward scope only |
| `verify_deployment` | Verify deployed version against attestation | Yes with respect to textbook state | Yes | Release-steward scope only |
| `publish_release` | Publish an approved candidate | No | Yes | Hidden without instructor step-up scope |
| `restore_release` | Restore a full prior release | No | Yes | Hidden without instructor step-up scope |

Tool annotations must accurately set `readOnlyHint`, `openWorldHint`, `destructiveHint`, and `idempotentHint`. Reversible draft mutation is not mislabeled as read-only. Publish/restore are never presented as casual agent defaults.

Each tool has:

- a narrow input schema;
- a narrow output schema;
- machine-readable warning and blocking-issue codes;
- explicit `baseRevisionId`, `dryRun`, and idempotency behavior where relevant;
- bounded output sizes with passage selectors instead of dumping entire chapters;
- examples and counterexamples;
- authorization errors that do not reveal hidden capabilities.

Publish and restore are annotated as non-read-only, open-world, and destructive because they change the public release, even though rollback exists. Draft replacement/deletion tools are also non-read-only and destructive; additive draft tools are non-read-only but reversible. If one MCP tool would mix materially different safety profiles, split it into narrower tools rather than using misleading annotations.

Expose small, stable MCP resources for context that should not require a mutation tool:

```text
textbook://contract/current
textbook://prompt-design
textbook://provider-registry
textbook://chapter/{chapterId}
textbook://release/{releaseId}
```

`begin_media_upload` returns only `uploadId`, opaque object key, presigned R2 PUT URL, required headers, expected hash/bytes, and expiry. The Skill’s upload helper streams the approved local attachment to that URL, then calls `complete_media_upload(uploadId)`; local paths are never sent to the server and upload bytes never enter model context.

Deploy the MCP as its own versioned Cloudflare Worker at `mcp.ethicsandai.your-digital-life.org`. Its package version declares the compatible Content API and contract versions and fails startup on an incompatible server. CI publishes a signed Skill bundle whose manifest pins MCP/API/contract versions; installation copies or imports those four Skills into the selected agent environment, and a drift check reports when installed Skill hashes differ from the repository release. Production MCP registration, OAuth callback/audience, smoke test, rollback, and Skill install/update commands are part of Phase 7—not a manual afterthought.

### 9.2 Repository Skills

Create four versioned Skills:

#### `phil123-chapter-editor`

1. Resolve the chapter and current revision.
2. Read the target passages and dependencies.
3. Create a change set.
4. Apply the smallest semantic operations.
5. Validate stable IDs, raw/legacy blocks, sources, rights, and derivatives.
6. Render web/mobile/print preview.
7. Inspect semantic diff.
8. Submit, never silently publish.

#### `phil123-checkpoint-editor`

1. Read the controlling checkpoint-design document.
2. Inspect all three checkpoints as a sequence.
3. Inspect the proposed anchor passage and excerpt hash.
4. Edit one checkpoint without duplicating inline/sidebar data.
5. Validate Commit–Work–Reconcile structure and exactly-three count.
6. Preview inline trigger, side panel, and exported reading record.
7. Submit for instructor review.

#### `phil123-media-curator`

1. Resolve the pedagogical need and target passage.
2. Search for a reusable existing asset before upload.
3. Upload or resolve provider URL through sanctioned tools.
4. Propose rights, alt, caption, credit, teaching use, transcript, display preset, and placement.
5. Leave uncertain rights in `reviewRequired`.
6. Validate responsive, print, offline, motion, and provider-failure output.
7. Submit for instructor review.

#### `phil123-release-steward`

1. Inspect the frozen release candidate and complete diff.
2. Run contract, migration, content, rights, accessibility, privacy, security, embed, derivative, visual, and build gates.
3. Report blocking failures and warnings.
4. Require instructor approval for the exact candidate.
5. Publish atomically.
6. Verify the deployed manifest and smoke tests.
7. Restore the prior complete release if verification fails.

Skills encode workflow and tool sequence. The MCP/API owns live data, actions, authorization, and audit. A Skill cannot confer a permission its bearer token lacks.

### 9.3 Agent evaluation suite

Maintain a golden prompt set covering:

- small prose correction;
- section insertion without ID loss;
- checkpoint prompt revision;
- checkpoint re-anchoring after passage movement;
- image upload with caption and rights proposal;
- animated GIF insertion with poster and controls;
- YouTube URL insertion;
- X post insertion with authored fallback;
- replacement of a shared media asset;
- concurrent edits from the same base revision;
- repeated upload/insert retries;
- malicious provider metadata containing instructions;
- arbitrary iframe/script attempts;
- unlicensed media publication attempt;
- explicit instructor publication and rollback.

Evaluate tool selection, schema correctness, number of calls, revision conflicts, privilege boundaries, output quality, and resulting visual parity. Use the MCP Inspector plus automated contract tests.

---

## 10. Publication, derivatives, backup, and recovery

### 10.1 Release pipeline

```text
merged, approved canonical heads + rights/editorial approvals
       |
       v
allocate monotonic candidate sequence + capture expected active release
       |
       v
materialize complete BookReleaseSnapshot to private R2
       |
       v
hash snapshot + source assets; write/sign immutable candidate manifest
       |
       +-> generate reading.json / reading.txt
       +-> generate checkpoint payloads
       +-> pin first-party media and fallback derivatives
       +-> generate search/offline/print data
       |
       v
run contract + content + rights + accessibility + security + embed checks
       |
       v
run Astro check/test/build + visual comparisons
       |
       v
write/sign build attestation and immutable artifact
       |
       v
wrangler versions upload -> protected version preview, not active
       |
       v
smoke-test preview -> instructor step-up approval
       |
       v
serialized expected-active CAS -> versions deploy 100% -> receipt/pointer
```

Candidate creation persists and hashes the full snapshot before approval, eliminating a read-after-approval race. The build consumes only that snapshot. Ordinary draft saves do not build production. Because all accepted mutations already pass through the API, no storage webhook is a publication trigger; optional drift checks only detect/alert on out-of-band change.

No content commit is created. CI checks out the renderer code at the pinned Git SHA and materializes the approved snapshot into an ephemeral build directory.

The materializer reads every approved R2 image/file used by the release, verifies its recorded SHA-256, writes the selected original or derivative to a content-addressed same-origin release path such as `/media/{sha256}.{ext}`, and rewrites the public reference. The build attestation records the complete `R2 object -> release URL -> SHA-256` mapping. External-provider audio/video/post content is not downloaded. If a native file cannot fit the tested Cloudflare artifact budget, publication blocks with a remediation message; P0 does not silently fall back to a mutable public asset URL.

Exact Cloudflare P0 flow:

```bash
npx wrangler versions upload --preview-alias "release-<sequence>"
# Capture returned Worker version ID and protected version-preview URL.
# Run deployed smoke/header/cache tests against that version.
npx wrangler versions deploy "<version-id>@100%" --yes --message "release <candidate-id>"

# Complete rollback, through the same serialized API path:
npx wrangler rollback "<prior-version-id>" --message "restore <release-id>"
```

Preview URLs are protected with Cloudflare Access. The custom production domain is unchanged until `versions deploy`. The release Worker exposes its version/release ID for verification. Cross-version cache sharing remains disabled so release N cannot serve release N+1 assets. Before promotion, the API holds the book-wide lock and verifies both D1 `expectedActiveReleaseId` and the current Cloudflare deployment. If a crash occurs between Cloudflare promotion and the D1 receipt, a reconciler compares the live version ID to the pending transaction and either completes the receipt/pointer or restores the prior version; this cross-provider failure path has an explicit test.

### 10.2 Derivative policy

The same frozen snapshot produces:

- interactive reader HTML;
- no-JS readable HTML;
- print CSS/PDF projection;
- offline self-contained HTML package;
- `reading.json`;
- `reading.txt`;
- search index;
- checkpoint payloads and downloadable reading-record template;
- future voice/audio output.

No derivative reads current D1/R2 state after the release is frozen.

### 10.3 Backups

- Nightly canonical D1 export and R2 inventory to an off-provider backup target.
- Nightly asset inventory with hashes and references.
- Every release stores its signed candidate manifest, materialized snapshot, build attestation, complete immutable artifact, checksums, code provenance, deployment receipt, and active-pointer history.
- Weekly full export integrity check.
- Monthly restore drill into a clean development dataset.
- Quarterly local build from the restored export with network access to D1/R2 and media providers disabled.
- Defined retention for drafts, audit logs, releases, and deleted/tombstoned identities.

Backups are not a second routine editing surface.

### 10.4 Rollback

Rollback restores the prior Cloudflare deployment/release pointer and verifies:

- candidate-manifest and attestation IDs/hashes;
- all 18 chapter revision IDs;
- checkpoint hashes;
- media/embed/rights hashes;
- asset reachability;
- homepage and representative chapter checks;
- no mixed old/new cache state.

Target: restore the prior production release within five minutes without modifying canonical D1 content.

---

## 11. Repository implementation map

Keep the Astro reader at the repository root during migration. Introduce npm workspaces only for new boundaries.

```text
docs/
  AGENT_NATIVE_AUTHORING_PLATFORM_IMPLEMENTATION_PLAN.md
  architecture/adr/
    0001-content-authority.md
    0002-canonical-content-contract.md
    0003-embed-security-and-privacy.md
    0004-auth-and-agent-scopes.md
    0005-immutable-publish-and-rollback.md

.github/
  workflows/
    ci.yml
    deploy-editor.yml
    content-release.yml
    content-snapshot-export.yml
    content-drift-audit.yml
    media-process.yml
    deploy-mcp.yml
    d1-staging-migration.yml

editor/
  package.json
  tsconfig.json
  src/
    book.ts
    part.ts
    chapter.ts
    chapterRevision.ts
    annotation.ts
    worldLayer.ts
    entity.ts
    diagram.ts
    promptCheckpoint.ts
    mediaAsset.ts
    mediaAssetVersion.ts
    mediaFigure.ts
    externalEmbed.ts
    richLink.ts
    rightsCase.ts
    editorialApproval.ts
    changeSetWorkingDocument.ts
    release.ts
  components/
    ChapterOutlineInput.tsx
    PassageAnchorInput.tsx
    PromptCheckpointEditor.tsx
    MediaPlacementEditor.tsx
    EmbedUrlInput.tsx
    RightsReviewInput.tsx
    MultiSurfacePreview.tsx
    SemanticDiff.tsx
  textbookEditor/
    TextbookEditor.tsx
    apiClient.ts
    changeSetSession.ts

packages/
  content-contract/
    src/types/
    src/schemas/
    src/operations/
    src/ids/
    src/validation/
    src/openapi/
  content-repository/
    src/ContentRepository.ts
    src/GitContentRepository.ts
    src/D1ContentRepository.ts
  content-renderer/
    src/portableText/
    src/media/
    src/embeds/
    src/checkpoints/
  content-derivatives/
    src/readingJson.ts
    src/plainText.ts
    src/offline.ts
    src/print.ts
    src/search.ts
  embed-registry/
    src/adapter.ts
    src/providers/youtube.ts
    src/providers/vimeo.ts
    src/providers/x.ts
    src/providers/spotify.ts
    src/providers/soundcloud.ts
    src/providers/bluesky.ts
    src/linkCard.ts
    src/csp.ts

apps/
  preview/
    package.json
    tsconfig.json
    wrangler.jsonc
    src/

workers/
  content-api/
    package.json
    tsconfig.json
    wrangler.jsonc
    migrations/
    src/auth/
    src/routes/
    src/services/
    src/audit/
    src/idempotency/
    src/changesets/
    src/approvals/
    src/releases/
    src/jobs/
    src/provider-resolver/
  job-dispatcher/
    package.json
    wrangler.jsonc
    src/media.ts
    src/release.ts

mcp/
  textbook/
    package.json
    tsconfig.json
    wrangler.jsonc
    src/server.ts
    src/tools/
    test/

skills/
  phil123-chapter-editor/SKILL.md
  phil123-checkpoint-editor/SKILL.md
  phil123-media-curator/SKILL.md
  phil123-release-steward/SKILL.md

scripts/
  d1/import-git.mts
  d1/export-snapshot.mts
  d1/roundtrip.mts
  d1/drift-audit.mts
  release/build-release.mts
  release/verify-release.mts
  media/check-embed-health.mts

tests/
  contract/
  migration/
  api/
  media/
  embed/
  security/
  e2e/
  visual/
  accessibility/
  privacy/
  release/
  backup/
  webhook/

evals/
  mcp/
  fixtures/
```

### 11.1 Existing files to refactor deliberately

- `src/lib/content.ts` becomes a consumer of a normalized `ChapterBundle` through `ContentRepository` rather than knowing the physical Git layout.
- `src/content.config.ts` stops being the only contract; its current constraints move into `packages/content-contract` and remain available to Astro.
- `ReadingRecord.astro` initially consumes the same effective checkpoint fields with no behavior change.
- current media and rights renderers become the visual baseline for `content-renderer` components.
- existing generation, validation, public-boundary, and build scripts are wrapped or refactored, not discarded.
- hard-coded diagrams move behind typed block records only after exact render parity is proven.
- the current admin Git editor remains available during shadow migration and can be retired only after cutover and rollback rehearsal.

At plan creation, the active `agent/interactive-textbook-redesign` checkout was at `78499764521a48554d068837a96f17204709ea2d`, seven commits behind the migration baseline, with 72 tracked changes and four untracked paths after this plan was added. The other three untracked paths and all tracked changes are user work and are not the implementation base. Phase 0 must inventory and preserve them; it must not reset, delete, or silently reconcile them.

The current generators and validators hard-code `content/chapters`. Refactor them to require an explicit snapshot root (`--snapshot-root` / `CONTENT_SNAPSHOT_ROOT`) and make the Git fixture only one provider. Post-cutover CI must fail if a production build falls back to the frozen fixture. Phase 9 retires `.github/workflows/regenerate-chapter-reading.yml` and revokes the legacy Git editor/auth write credentials after the rollback window.

### 11.2 Bindings and environment inventory

Commit names and validation for configuration, never secret values:

| Component | Nonsecret config/binding | Secret/credential |
|---|---|---|
| Editor | API origin, preview origin, contract version | GitHub OAuth client/session configuration; no D1/R2 browser credential |
| Content API | D1 `CONTROL_DB`; R2 `UPLOAD_QUARANTINE`, `MEDIA`, `SNAPSHOTS`, `ARTIFACTS`, `BACKUPS`; Queues `MEDIA_JOBS`, `RELEASE_JOBS`; allowed origins/audiences; GitHub repo/workflow IDs | approval/signing keys; OAuth/JWT verification material where not public JWKS; GitHub App/server credential |
| Job dispatcher | Queues + DLQs; workflow names; callback origin | GitHub App credential; signed-callback key |
| Media workflow | job ID, signed download/callback URLs, processor image digest | No long-lived database/browser credential; short-lived scoped job credential only |
| Release workflow | candidate/snapshot URI+hash, protected code SHA, Node/image/lockfile digests | Cloudflare version-upload token; short-lived R2 read; signed callback key |
| Preview | R2 snapshot binding, exact Textbook Editor frame origin, token issuer/audience | one-time snapshot-token verification key |
| MCP | Content API origin/version, OAuth issuer/audience, tool limits | client/session tokens supplied at runtime; no database credential |

Each workspace commits `package.json`, `tsconfig.json`, `wrangler.jsonc`, generated binding types, and a redacted `.dev.vars.example` containing names only. `wrangler.jsonc` declares required secrets; CI fails on missing bindings, unpinned API versions, or an unexpected production origin.

---

## 12. Implementation phases

### Phase 0 — Governance, clean base, and reproducible baseline

- **Estimate:** 3–5 working days
- **Depends on:** Instructor architecture approval
- **Purpose:** Resolve the direct conflict between this plan and the repository’s current Git-only content policy before code changes begin.

Tasks:

1. Record the approved architecture: standalone editor with D1/R2 content authority after canary; Git code authority; immutable static releases; hard operating ceiling of $5/month.
2. Record rejection of Sanity: its free tier is public-only/insufficient for required history, and its usable private tier is $15/seat/month, above the ceiling.
3. Approve the D1/R2 retention, backup, export, and restore design before schema implementation.
4. Approve ADR 0004’s exact GitHub OAuth instructor allowlist, agent scopes, CSRF/CORS, token, step-up, emergency-access, and credential-rotation design.
5. Amend tracked architecture/authoring/privacy/deployment/content-model/security/rights/voice documents to reflect the approved transition.
6. Correct current tracked documentation drift, including the omission of `reading-record.json` from `docs/CONTENT_MODEL.md`.
7. Preserve this currently untracked reviewed plan before leaving the dirty checkout: record its SHA-256, create the new worktree, then add the same checked file as the first implementation-branch change. Do not assume `git worktree add` carries an untracked file.
8. Keep every other current tracked/untracked user change untouched.
9. Fetch `origin/main` and create a new clean implementation worktree and feature branch from the exact approved baseline, for example:

   ```bash
   git fetch origin
   git worktree add ../ai-ethics-authoring-platform -b feat/agent-native-authoring origin/main
   ```

10. Run and archive the current baseline:

   ```bash
   npm ci
   npm run content:generate
   npm run validate
   npm run build
   npx wrangler deploy --dry-run
   npx wrangler deploy --dry-run --config workers/editor-auth/wrangler.jsonc
   ```

11. Generate a signed baseline manifest containing chapter/block/ID/checkpoint/media/rights counts and file hashes.
12. Capture golden desktop, 390 px mobile, print, no-JS, offline, current CSP/header, and provider-network fixtures for every chapter plus interactive checkpoint behavior.
13. Record current response privacy, browser storage, network, inline-script/style, and deployment/cache behavior.
14. Create the five ADRs listed in the repository map.
15. Create D1 development/staging databases and separate private R2 media/quarantine/snapshot/artifact/backup prefixes; defer production provisioning until release infrastructure is ready.
16. Create D1 development/staging databases, private R2 quarantine/snapshot/artifact buckets, Queue/DLQ pairs, and a quarantine 24-hour lifecycle rule.
17. Decide the initial short-media byte/duration budgets from representative files and actual deployment limits.

Exit criteria:

- current production can be rebuilt deterministically from the approved baseline;
- identity and asset counts are recorded by an automated test;
- all current validation/build commands pass;
- governance documents permit the new architecture;
- the implementation branch is clean and based on current `origin/main`;
- the reviewed plan exists in that branch with the recorded hash;
- the approved D1/R2 architecture, $5/month ceiling, and GitHub OAuth scope design are documented;
- no routine content authority has moved yet.

### Phase 1 — Shared contract and vertical spike

- **Estimate:** 1–2 weeks
- **Depends on:** Phase 0
- **Purpose:** Prove the hardest part—lossless content, prompt, media, and rendering parity—before building the whole platform.

Tasks:

1. Add npm workspaces and `packages/content-contract`.
2. Inventory every current book/chapter sidecar and encode book/part/chapter, annotations, world/entities/relationships, diagrams, sources, rights, reading-record objective/license/checkpoints, IDs, exports, and derivative requirements in Zod/JSON Schema.
3. Define draft vs publishable `ChapterBundle`, `BookReleaseSnapshot`, normalized block-storage boundary, block union, identity aliases/tombstones, multi-document change sets, immutable media versions, rights/approval cases, embed/link, and candidate/attestation/receipt contracts.
4. Add the repository interface plus Git implementation.
5. Configure D1 migrations and R2 bindings for the approved development environment.
6. Import Chapter 7, its three checkpoints, media, sources, rights, stable IDs, and one synthetic “block gallery” covering every block type.
7. Add a D1/R2 repository implementation.
8. Materialize both sources through the same renderer.
9. Compare:
   - every stable ID;
   - normalized DOM;
   - headings and links;
   - checkpoint payload and inline/sidebar positions;
   - media caption/credit/placement;
   - reading JSON/text;
   - desktop/mobile/print screenshots.
10. Spike one still image, one GIF, one YouTube URL, and one X URL through the intended data model and preview.
11. Spike one small native MP4 through the final first-party path and verify byte-range seeking, MIME headers, CORS, poster, captions, and bandwidth behavior.
12. Validate D1/R2 export/restore into a clean environment.

Exit criteria:

- Chapter 7 and the block gallery round-trip without unexplained identity or normalized-DOM drift;
- visual differences are zero or explicitly approved and documented;
- the three checkpoint records render exactly once inline and once through the side-panel data path;
- no provider request occurs before activation;
- GIF first-frame/play/stop works with reduced motion;
- D1/R2 export/restore produces the same contract hashes.
- every current sidecar is pinned in the normalized content graph or explicitly classified as code-owned.

Kill/redirect criteria:

- If normalized blocks cannot preserve a legacy structure losslessly, keep that structure as locked `legacyMarkup`; do not force conversion.
- If an official provider cannot meet privacy/accessibility/fallback gates, ship the rich link-card fallback until its adapter passes; never relax to raw HTML.
- If D1/R2 export cannot reproduce the snapshot deterministically, stop before full import and fix the repository abstraction/contract.

### Phase 2 — Foundational control plane and full shadow migration

- **Estimate:** 2–3 weeks
- **Depends on:** Phase 1
- **Purpose:** Establish the API/operational spine first, then import the entire book while Git remains authoritative.

#### Phase 2A — API and operational spine

1. Create D1 migrations for authority registry, change-set metadata, idempotency, audit mirror, approvals, upload tickets, jobs, provider health, release sequence/lock, and active release pointer.
2. Configure R2 quarantine/snapshot/artifact bindings and Queue/DLQ bindings.
3. Implement selected browser/agent authentication, Origin/CSRF/CORS, scopes, secret handling, and audit identity.
4. Implement server ID allocation and domain-revision hashing.
5. Implement isolated multi-document change sets, working-document namespace, revision CAS, idempotency, semantic operations, validation, diff, and submit/reject.
6. Implement read/search endpoints, including the full content graph and media reuse search.
7. Implement one-time cross-site preview snapshot/token issuance.
8. Implement upload tickets/quarantine completion and provider-resolver skeletons.
9. Implement the authority registry with every chapter set to Git.

**2A gate:** No mutating Textbook Editor, media, or provider UI work begins until auth, IDs, isolated change sets, base revisions, idempotency, audit, and preview-token contracts pass integration tests.

#### Phase 2B — Full shadow migration

1. Complete D1 revision/media/rights/entity/relationship migrations and repository mappings; direct database writes remain unavailable outside the API.
2. Build idempotent D1/R2 `import-git`, `export-snapshot`, `roundtrip`, and `drift-audit` scripts.
3. Import all book/part metadata, chapters, annotations, reading objectives/checkpoints, people, concepts, traditions, world-layer records, sources, media/Wikimedia records, rights, diagrams, stable IDs, aliases, tombstones, and relationships.
4. Record import provenance and source hashes on every imported document.
5. Build frozen D1/R2 snapshots and materialize the current content tree in a temporary directory.
6. Run existing and new validation/build/visual checks from both Git and D1/R2 snapshots.
7. Add dependency-graph validation for every media/source/entity/diagram placement and checkpoint anchor.
8. Add stored-XSS sanitization tests for all legacy/raw markup.
9. Keep every authority-registry entry on Git; direct D1/R2 writes remain API/migration-only.

Exit criteria:

- Phase 2A’s mutation/security foundation is green;
- exactly 18 chapters, 268 section IDs, 1,939 passage IDs, 54 checkpoint anchors, 37 media records/assets, and all recorded sidecars/legacy structures survive;
- every anchor target exists and every excerpt hash is initialized;
- all generated derivatives match or have approved diffs;
- the D1/R2 shadow cannot be used for production authoring;
- repeated imports are idempotent.

### Phase 3 — Standalone instructor editor and prompt-checkpoint editor

- **Estimate:** 1.5–2 weeks
- **Depends on:** Phase 2A; can overlap Phase 2B and later API hardening
- **Purpose:** Deliver the first browser editing experience without moving production authority.

Tasks:

1. Implement the standalone Textbook Editor with no direct database document desk/actions.
2. Bind every screen/autosave to an explicit isolated `changeSetId`; route all reads/mutations through the Content API.
3. Configure normalized block projections and lock legacy blocks.
4. Implement stable-ID display and API-backed dependency-aware block move/split/merge/delete commands.
5. Build the Prompt Checkpoints tab with Add/Edit/Move Anchor/Replace/Preview/Validate.
6. Render prompt preview inline and in the actual side-panel component.
7. Add semantic-diff and dependency-impact views.
8. Add one-time cross-site protected multi-surface preview.
9. Add revision restore-as-new-change-set.
10. Test two concurrent Textbook Editor change sets plus the complete manual workflow on Chapter 7.

Exit criteria:

- an instructor can revise prose, revise one checkpoint, move its anchor, and inspect the inline/sidebar result without Git;
- the editor cannot create a fourth checkpoint or publish an incomplete set;
- stable IDs cannot be casually edited or orphaned;
- draft preview matches production styling at desktop/mobile/print;
- one rejected or stale editor change set cannot contaminate another or the canonical head;
- no public content authority has moved yet.

### Phase 4 — Native media pipeline

- **Estimate:** 1.5–2 weeks
- **Depends on:** Phase 2A and the Phase 1 renderer contract; can overlap Phase 2B and Phase 3
- **Purpose:** Make uploaded media as polished and structured as current chapter figures.

Tasks:

1. Implement `mediaAsset`, append-only `mediaAssetVersion`, `rightsCase`, `editorialApproval`, and `mediaFigure` schemas/renderers.
2. Implement begin/complete R2 upload, job queue/DLQ, protected media workflow, actual MIME/hash verification, deduplication, signed callback, and quarantine cleanup.
3. Add still image variants, crop/focal point, intrinsic dimensions, and responsive `srcset`.
4. Add GIF/WebP frame inspection, first-frame poster, Play/Stop, reduced-motion, and flash review.
5. Add native short audio/video and PDF/plain-text document cards and configured budgets; prove range/MIME/CORS behavior.
6. Add placement-specific alt, caption, teaching use, display preset, credit, transcript/caption track, and print/offline policy.
7. Implement version/use/projection-bound rights and semantic accessibility review; prevent agent self-approval and invalidate approvals on relevant changes.
8. Bind media versions to placements so replacing an asset cannot silently mismatch a caption.
9. Add the reusable media library and placement impact report.
10. Add malware/PDF-active-content scanning, deterministic PDF normalization, `nosniff`/safe disposition, and accessible-equivalent gates.
11. Run responsive/performance/accessibility/print/offline tests.

Exit criteria:

- an instructor and API test client can upload, describe, place, preview, and submit a still image, GIF/WebP, short audio, short MP4/WebM, PDF, and plain-text document;
- blocked/unknown rights cannot publish;
- animated media does not move before activation and can be stopped;
- no SVG, polyglot, MIME mismatch, or oversized file bypasses the API;
- captions and layouts match or improve the current chapter visual standard;
- native audio/video and documents pass transcript/caption/accessibility, malware/active-content, header, poster, range, CORS, and bandwidth gates;
- replacing a binary creates a new pinned version and invalidates affected rights/editorial approvals rather than rewriting old placements.

### Phase 5 — Provider embed registry

- **Estimate:** 1.5–2 weeks
- **Depends on:** Phase 2A, the Phase 1 renderer contract, and media fallback support from Phase 4
- **Purpose:** Ship reliable YouTube, Vimeo, X, and link-card support.

Tasks:

1. Implement the registry contract and provider-discriminated options.
2. Implement SSRF-safe resolver infrastructure.
3. Implement YouTube adapter and all failure fixtures.
4. Implement Vimeo adapter and all failure fixtures.
5. Implement X adapter, official widget activation/failure promise, reviewed script exception, and advisory daily health checks.
6. Implement instructor-authored generic link card with no arbitrary metadata fetch.
7. Generate exact page/release CSP requirements from registry entries.
8. Run CSP report-only observation in Chrome, Safari, and Firefox, then enforce the minimal set.
9. Add no-JS/offline/print fallbacks and provider-timeout behavior.
10. Add D1 health observations, daily job, alert view, and manual refresh action without mutating editorial hashes.

Exit criteria:

- browser network tests prove zero provider requests before activation;
- raw embed HTML and unsupported options are rejected through the Textbook Editor and API;
- public/private/deleted/restricted/timeout cases degrade cleanly;
- X official rendering passes the provider-policy and browser matrix;
- generic link cards require no arbitrary fetch and render on every output surface;
- every embed has instructor-authored fallback content and teaching use;
- provider outage does not break a chapter or build.

### Phase 6 — Domain API completion and adversarial hardening

- **Estimate:** 1.5–2 weeks
- **Depends on:** Phase 2A plus implemented Textbook Editor/media/embed operations from Phases 3–5
- **Purpose:** Complete cross-domain review/release operations and prove the control plane under attack and failure.

Tasks:

1. Publish/freeze OpenAPI 3.1 and generated MCP schemas from the shared contract.
2. Complete multi-document CAS merge/rebase, append-only domain revisions, atomic D1 head/audit transaction, and isolated-change-set retention.
3. Complete content/rights/editorial approval records and hash invalidation.
4. Complete media/version, embed/link, review, candidate, attestation, deployment, restore, and verification endpoints.
5. Implement single-use approval tokens, release sequence, book-wide lock/queue, expected-active CAS, and crash reconciler.
6. Complete structured redacted audit events, rate limits, per-run budgets, circuit breakers, DLQ operations, and recursive-event suppression.
7. Add hostile metadata, stored-XSS, SSRF, retry, conflict, privilege-escalation, log-redaction, multi-document partial-failure, concurrent-publish, publish/rollback-race, and expired-token suites.
8. Pen-test editor attempts to bypass the API/direct-write boundary and verify D1/R2 binding isolation.

Exit criteria:

- agents cannot write directly to D1/R2;
- the same server validators run for agent writes and release checks;
- concurrent same-base edits produce a semantic `409`, not last-write-wins;
- repeated requests produce exactly one change/media/release;
- concurrent change sets remain isolated until explicit CAS merge;
- publish, rollback, and crash reconciliation cannot produce an out-of-order active release;
- every mutation is attributable and reversible;
- agent scopes cannot approve rights or publish.

### Phase 7 — MCP server and Skills

- **Estimate:** 1–2 weeks
- **Depends on:** Phase 6
- **Purpose:** Expose the platform safely and fluently to agents.

Tasks:

1. Implement the P0 tool set and exact JSON schemas.
2. Add OAuth/service-identity discovery and scope-sensitive tool availability.
3. Add accurate MCP safety annotations.
4. Add bounded, structured results and conflict/remediation objects.
5. Author the four Skills.
6. Add golden prompt/evaluation fixtures.
7. Test with MCP Inspector and at least one production agent client.
8. Test malicious chapter/provider content as prompt injection.
9. Test long chapters without unbounded context dumps.
10. Deploy/register the versioned MCP Worker, exercise OAuth discovery, and test rollback.
11. Package/install the four version-pinned Skills and add installed-hash drift checks.
12. Document example manual and agent-driven workflows.

Exit criteria:

- an agent can edit a chapter, revise a checkpoint, reuse or upload/place still/GIF/audio/video/PDF/plain text, insert YouTube/Vimeo/X and a rich link card, validate, preview, diff, and submit a reviewable change set;
- it cannot approve rights or publish with its normal credential;
- retries and concurrent agents cannot duplicate or overwrite work;
- the golden suite meets the agreed tool-selection and output-quality threshold.

### Phase 8 — Immutable release pipeline and operations

- **Estimate:** 1–2 weeks
- **Depends on:** Phases 2, 5, and 6
- **Purpose:** Replace Git content commits with safe database-to-static publication.

Tasks:

1. Provision production D1/R2/Queue bindings, protected GitHub environments, and least-privilege secrets only after prior gates pass.
2. Implement persisted complete snapshots, immutable signed candidate manifests, server-selected protected code provenance, build attestations, deployment receipts, and active pointers.
3. Add signed/idempotent release queue, monotonic sequence, book-wide lock, expected-active CAS, stale-candidate rejection, and crash reconciler.
4. Materialize the candidate snapshot into an ephemeral checkout and require all generators/validators to use its explicit `--snapshot-root`.
5. Generate all existing/new derivatives plus content-addressed first-party media; record full source-asset-to-release mapping.
6. Generate route-specific `_headers` and run contract/content/rights/editorial/accessibility/privacy/security/embed/visual/offline/header/cache gates.
7. Upload the Worker/static assets with `wrangler versions upload`, capture version/preview, and leave production traffic unchanged.
8. Protect and smoke-test the version preview against candidate/attestation, chapters, all P0 media, CSP, privacy, cache, and offline output.
9. Issue the hash-bound step-up token and promote through the serialized `wrangler versions deploy` path.
10. Verify/write deployment receipt and active pointer; test crash reconciliation.
11. Implement complete-release `wrangler rollback` and five-minute publish/rollback-race drill.
12. Implement nightly export, weekly integrity check, monthly restore drill, and artifact retention.

Exit criteria:

- a content change publishes without a Git content commit;
- a killed build at any stage leaves production unchanged;
- release N HTML can never reference release N+1 content metadata;
- only a protected green renderer SHA/pinned toolchain can build a candidate;
- deployed CSP/document/media headers match the signed/generated policy;
- prior release rollback finishes within five minutes;
- restored export builds locally without D1/R2 or media-provider availability.

### Phase 9 — Canary, cutover, and retirement of Git authoring

- **Estimate:** 1–2 weeks
- **Depends on:** Phases 3–8
- **Purpose:** Change content authority without losing the book.

Tasks:

1. Select Chapter 7 as canary because it exercises the reading record and media path.
2. Freeze Git editing for that chapter and change only its per-chapter authority-registry entry to a pinned D1 revision/R2 snapshot; retain Git authority for the other 17.
3. Complete real manual and agent/API workflows:
   - prose correction;
   - prompt-checkpoint revision;
   - still/GIF insertion;
   - short audio/video and PDF/plain-text insertion;
   - YouTube, Vimeo, X, and rich-link insertion.
4. Publish canary releases and compare every projection.
5. Run privacy/network/accessibility/security/rollback checks.
6. Collect instructor friction notes and fix blocking UX.
7. Cut over the remaining chapters in controlled batches.
8. Switch every remaining per-chapter authority-registry entry to its pinned D1/R2 source only after its batch gates pass.
9. Make the Git content tree read-only/frozen, disable the Git editor’s write path, and prove production refuses fixture fallback for D1-authoritative chapters.
10. After the defined rollback window, retire the regeneration workflow and revoke legacy Git editor/auth write credentials.
11. Document the support and incident procedure.

Exit criteria:

- every chapter is authored in the standalone editor/D1 and published through immutable releases;
- no routine content update requires Git;
- the old Git editor cannot create split-brain authority;
- all 18 chapters, IDs, checkpoints, media, rights, and derivatives pass the final parity manifest;
- instructor signs off on the manual workflow and agent review surface.

### Phase 10 — Extended media, hardening, and continuous improvement

- **Estimate:** 2–4 weeks for the initial P1 pack, then ongoing
- **Depends on:** Stable P0 cutover
- **Purpose:** Broaden media support without weakening the boundary.

Tasks:

1. Add Spotify, SoundCloud, and Bluesky adapters through the same contract.
2. Add MP4/WebM generation for large GIFs and compare performance.
3. Evaluate Mux or another adaptive streaming service only if instructor-uploaded long video becomes a real requirement and its cost is separately approved.
4. Add a provider-adapter conformance kit so new providers inherit URL, CSP, fallback, health, print, offline, accessibility, and security tests.
5. Add TikTok only when a chapter requires it and it passes the browser/privacy matrix.
6. Add Instagram/Facebook only after app/token operational costs are accepted.
7. Run quarterly dependency, token, CSP, provider-policy, and restore audits.
8. Review failed health checks and replace brittle embeds with first-party sources when practical.
9. Improve Textbook Editor ergonomics using real authoring friction, not speculative WYSIWYG features.
10. Maintain backward-compatible API/MCP schema versions and migration guides.

Exit criteria for each new provider:

- typed adapter and options;
- official supported rendering path;
- zero network before activation;
- provider-specific CSP and browser matrix;
- authored fallback/no-JS/offline/print output;
- removed/restricted content behavior;
- policy and attribution record;
- API, Textbook Editor, MCP, security, and visual tests.

---

## 13. Dependency order and parallel work lanes

```text
Phase 0
   |
Phase 1 shared contract/spike
   |
Phase 2A API/auth/change-set/operations spine
   |             |                 |
   |             |                 +--> Phase 3 Editor/checkpoints --+
   |             +--------------------> Phase 4 native media ---------+
   +----------------------------------> Phase 5 provider embeds ------+
   |                                                               |
Phase 2B full shadow import -----------------------------------------+
                                                                   |
                                                        Phase 6 hardening
                                                          |          |
                                                          v          v
                                                  Phase 7 MCP   Phase 8 release
                                                          \          /
                                                           Phase 9 cutover
                                                                  |
                                                              Phase 10
```

Recommended ownership lanes:

- **Lane A — Contract and migration:** shared schemas, IDs, repository adapters, import/export, parity tests.
- **Lane B — Editor and prompts:** manual UX, anchor editor, preview, diff, revisions.
- **Lane C — Media and embeds:** uploads, rights, renderers, provider registry, CSP, health.
- **Lane D — API and release:** auth, semantic operations, MCP, audit, CI, deployment, rollback.

Only one lane owns a file/module at a time. Contract changes require cross-lane review because they affect all consumers.

---

## 14. Verification matrix

### 14.1 Required automated suites

| Suite | Proves |
|---|---|
| Contract | Zod/JSON Schema/OpenAPI/D1/MCP agree on fields, enums, and versions |
| Migration | All IDs, raw structures, checkpoints, rights, media, and sources survive import/export |
| Repository parity | Git and D1/R2 adapters emit equivalent `ChapterBundle` snapshots during shadow mode |
| API | Auth, scopes, revision guards, idempotency, errors, transactions, audit events |
| Change-set isolation | Multi-document working snapshots, CAS merge/rebase, rejection, concurrent editor/agent sessions |
| Security | Stored XSS, URL schemes, event handlers, SVG, SSRF, redirects, DNS rebinding, polyglots, oversized assets |
| Prompt | Exactly three, ordered slots, valid anchors/excerpt hashes, supported response structure, one shared inline/sidebar source |
| Media | MIME/hash/dimensions, rights, alt/caption, placement, responsive variants, GIF controls, captions/transcripts |
| Editorial approval | Human approval bound to exact checkpoint/placement/version hashes and invalidated by semantic changes |
| Embed | URL normalization, provider options, zero preactivation network, outage/deletion, CSP, fallback |
| Privacy | No student endpoints/storage/analytics; no provider requests before click; no draft/admin code in public bundle |
| Derivative | Web/no-JS/print/offline/reading JSON/text/search all use the frozen snapshot |
| Visual | Desktop, 390 px, 320 px, tablet, print, long captions, zoom, dark/light provider states |
| Accessibility | Keyboard, focus, names/roles, iframe titles, captions, reduced motion, color/zoom, screen-reader smoke |
| Release | Failed builds preserve active release; deployment matches manifest; rollback restores whole release |
| Release concurrency | Candidate TOCTOU, protected code provenance, sequence/lock/CAS, publish/rollback race, crash reconciliation |
| Backup | Clean restore reproduces manifest and local build without live providers |
| Agent eval | Correct tool use, bounded context, conflict handling, privilege boundary, high-quality semantic output |

### 14.2 P0 provider fixtures

YouTube:

- normal public video;
- playlist;
- captions available/unavailable;
- private;
- removed;
- embedding disabled;
- age/region restriction;
- timeout.

Vimeo:

- public;
- unlisted with hash;
- domain restricted;
- private;
- embedding disabled;
- unavailable;
- timeout.

X:

- ordinary public post;
- post with image/video;
- thread;
- edited post;
- deleted post;
- protected account;
- suspended/unavailable account;
- widget blocked;
- timeout.

GIF:

- small looping GIF;
- animated WebP;
- single-frame false positive;
- over 10 MB;
- over 50 total megapixels;
- malformed/polyglot;
- excessive flashing;
- reduced-motion preference;
- keyboard Play/Stop;
- no-JS/offline/print.

Native audio/video:

- allowed and oversized files;
- correct/mismatched MIME;
- byte-range seek and CORS;
- poster and caption-track success/failure;
- transcript/media-equivalent required/absent;
- keyboard and screen-reader controls;
- offline package included/excluded by budget.

Documents:

- accessible PDF and UTF-8 plain text;
- encrypted PDF;
- PDF JavaScript, launch action, form, embedded file, and multimedia action;
- malware/polyglot/mismatched MIME;
- missing accessible equivalent;
- `nosniff`, disposition, no-JS/offline/print behavior.

Rich links:

- valid public HTTPS URL with instructor-authored title/summary;
- unsupported provider URL converted without a fetch;
- credentials in URL, non-HTTPS, malformed, and private/reserved hostname;
- long title/summary, missing teaching use, offline/print projection.

### 14.3 Final migration acceptance numbers

The final cutover gate must prove at least the baseline counts below. If the baseline changes before implementation begins, Phase 0 regenerates and signs the new numbers; the plan is not an excuse to use stale counts.

- 18 chapters;
- 268 section IDs;
- 1,939 passage IDs;
- 122 raw HTML asides or their explicitly approved typed replacements;
- 16 raw HTML tables or their explicitly approved typed replacements;
- 123 explicit IDs;
- 54 checkpoint anchors;
- 37 curated media records/assets;
- exactly three checkpoints for each chapter.

No unexplained deletion, duplication, renumbering, or re-anchoring is accepted.

### 14.4 Proposed verification commands

Add these scripts as their implementation lands:

```bash
npm run contract:check
npm run migration:roundtrip -- --all
npm run migration:drift
npm run test:api
npm run test:security
npm run test:media
npm run test:embed
npm run test:e2e
npm run test:visual
npm run eval:mcp
npm run snapshot:materialize -- --candidate <candidate-id> --output <snapshot-root>
npm run content:generate -- --snapshot-root <snapshot-root>
npm run validate -- --snapshot-root <snapshot-root>
npm run build -- --snapshot-root <snapshot-root>
npm run release:build -- --candidate <candidate-id>
npm run release:verify -- --candidate <candidate-id>
```

---

## 15. Failure matrix and guardrails

| Severity | Failure | Guardrail | Required proof |
|---|---|---|---|
| Critical | Git and D1 both writable | Per-chapter authority registry and one-way cutover | Edit attempts on both sides; nonauthority path is rejected |
| Critical | Editor bypasses API invariants | Standalone editor uses isolated API change sets | Direct D1/R2 mutation denied; every save has actor/base/idempotency/audit |
| Critical | Concurrent change sets contaminate each other | Namespaced working docs and CAS multi-document merge | Reject/stale one proposal; other and canonical heads remain unchanged |
| Critical | WYSIWYG destroys IDs/raw structures | Lossless typed/hybrid model and locked legacy blocks | Full import/export ID, DOM, and visual parity |
| Critical | Passage edit silently invalidates prompts/media | Dependency graph and excerpt hash review | Rewrite/split/move/delete anchored passage; release blocks correctly |
| Critical | Arbitrary embed executes/tracks | No raw embed field; allowlisted adapters only | iframe/script/event-handler/URL-scheme corpus rejected everywhere |
| Critical | Stored XSS reaches preview/public | Typed nodes, sanitizer, protected preview, CSP | XSS fixtures across prose, caption, alt, metadata, oEmbed |
| Critical | Agent imports unlicensed media | Quarantine and instructor rights approval | Agent publish attempt fails at API and build |
| Critical | Binary replacement rewrites approved use | Append-only media versions and version/use-bound rights | Replace asset; old release/placement remains pinned and new use needs review |
| Critical | Student response leaks | Separate bundles; no public response/storage/analytics path | Storage, HAR, logs, reload, and bundle audit |
| Critical | Candidate rereads mutable content | Persist/hash snapshot before manifest/approval | Mutate D1 during build; artifact remains bound to candidate snapshot |
| Critical | Partial/out-of-order publication mixes states | Signed candidate/attestation, serialized CAS promotion, reconciler | Kill/race build, publish, rollback; one expected release remains active |
| Critical | Agent selects malicious renderer SHA | Server-selected protected green code provenance | Client-supplied SHA rejected; lockfile/image/contract hashes pinned |
| High | Provider tracks before click | First-party card and network boundary | HAR proves no request before activation |
| High | Deleted/outage embed breaks reading | Authored fallback and health status | DNS block/deleted fixture still yields complete reading |
| High | oEmbed injects code/prompt instructions | Discard HTML; typed extraction; untrusted metadata | Malicious response cannot render or alter tool behavior |
| High | Resolver permits SSRF/bomb | Allowlist, DNS/redirect recheck, byte/time/decode limits | Loopback, metadata IP, rebinding, polyglot, oversized fixtures |
| High | Retry duplicates figure/release | Idempotency and content-hash dedupe | Repeated identical calls create exactly one object |
| High | Concurrent agents overwrite | Base revision and semantic 409 | Second same-base edit cannot overwrite first |
| High | Preview XSS steals authoring authority | Cross-site one-time read-only snapshot preview | Hostile preview has no cookies, credentials, mutation path, or cache |
| High | GIF creates uncontrolled motion | Static default, controls, limits, reviews | Reduced-motion/keyboard/flash/performance tests |
| High | Downloadable document contains active/malicious content | Narrow formats, scan/disarm, safe headers, accessibility gate | JS/forms/attachments/encryption/polyglot/malware fixtures rejected |
| High | Offline/print loses required meaning | Mandatory fallback/transcript/summary | Disable network/JS and inspect every projection |
| High | Rollback restores only prose | Release-level manifest rollback | Full hash comparison after restore |
| High | Provider/database loss is unrecoverable | Portable exports and restore drills | Clean off-provider restore and local build |
| Medium | Caption/alt no longer matches replaced asset | Version binding and impact review | Asset swap marks placements for review |
| Medium | Agent webhook loops | Run lineage, depth limit, origin filtering, circuit breaker | Self-trigger fixture stops before recursive mutation |
| Medium | Logs capture drafts/tokens | Structured redaction and canary tests | Canary values absent from logs |
| Medium | Slug change breaks Canvas | Impact report and redirect plan | Every downstream link surfaced; no automatic LMS write |

---

## 16. Operational service levels

Initial targets:

- draft save acknowledgement: under 500 ms at p95, excluding asset upload;
- semantic validation: under 5 seconds for a chapter;
- protected preview: under 30 seconds for a chapter;
- full release build: under 10 minutes;
- publication activation: under 2 minutes after a green build;
- rollback: under 5 minutes;
- provider-health alert: within 24 hours for X and within 7 days for other live adapters;
- nightly export success: 99% monthly, with alert after first missed run;
- no unresolved critical security/privacy failure in production;
- no provider request before activation in every automated browser release check.

These are operational targets, not student analytics. Do not add student event tracking to measure them.

---

## 17. Initial implementation backlog

The first two weeks should be ticketed in this order:

1. **ARCH-001:** Approve content-authority and X-script-exception decisions.
2. **STORAGE-001:** Complete D1/R2 cost, retention, export, and restore gate within the $5/month ceiling.
3. **AUTH-001:** Approve exact human/agent/step-up identity ADR.
4. **PLAN-001:** Hash and place this reviewed plan in the clean implementation branch.
5. **BASE-001:** Create clean worktree from current `origin/main` without touching user work.
6. **BASE-002:** Generate signed baseline identity/asset manifest.
7. **BASE-003:** Capture golden web/mobile/print/no-JS/offline/CSP/network fixtures.
8. **CONTRACT-001:** Create `packages/content-contract` and current v1 schemas.
9. **CONTRACT-002:** Add v2 `ChapterBundle` and stable-ID utilities.
10. **CONTRACT-003:** Add complete graph, draft/publishable, checkpoint, media-version, rights/approval, embed/link, change-set, and release-record schemas.
11. **REPO-001:** Define `ContentRepository` and implement Git adapter.
12. **D1-001:** Create development database, R2 bindings, and standalone editor workspace.
13. **D1-002:** Implement chapter/checkpoint/media/embed migrations and mappings.
14. **MIG-001:** Parse Chapter 7 into the hybrid typed block model.
15. **MIG-002:** Preserve/lock legacy markup blocks.
16. **REPO-002:** Implement D1/R2 adapter.
17. **RENDER-001:** Render both adapters through one `ChapterBundle` path.
18. **PROMPT-001:** Preserve Chapter 7 inline/sidebar checkpoint behavior.
19. **MEDIA-001:** Upload/render one still image with current caption quality.
20. **MEDIA-002:** Upload/render one GIF with first-frame Play/Stop behavior.
21. **EMBED-001:** Implement registry skeleton and link-card fallback.
22. **EMBED-002:** Implement YouTube vertical adapter.
23. **EMBED-003:** Implement X vertical adapter.
24. **PARITY-001:** Compare IDs, normalized DOM, derivatives, and visual goldens.
25. **DR-001:** Export and restore the spike into a clean dataset.
26. **GATE-001:** Review spike results and decide whether to proceed to full import.

No Textbook Editor polish, broad provider work, or full API surface should precede `GATE-001`.

---

## 18. Definition of done

The platform is complete when all statements below are true:

1. Joel can open the Textbook Editor, edit chapter prose, save a draft, preview it, submit it, and publish an approved release without opening GitHub.
2. Joel can open the Prompt Checkpoints tab, add a missing checkpoint, edit any of the three prompts, move its stable passage anchor, and preview the exact inline and side-panel presentations.
3. Joel can upload a still image, GIF/WebP, short audio/video, PDF, or plain-text document; add high-quality alt/caption/transcript/teaching use/rights; place it precisely; and obtain polished web/mobile/print/offline output.
4. Joel can paste a YouTube, Vimeo, or X URL and receive a structured, editable, click-to-load embed with an authored fallback, or create an instructor-authored rich link card for another URL.
5. A scoped agent can perform every P0 draft operation through MCP/API and produce a reviewable semantic diff.
6. A normal agent cannot approve rights, bypass validation, publish, restore, change permissions, or insert arbitrary active content.
7. Routine content changes produce no Git content commit.
8. The public reader remains static, preserves current student-response privacy, and makes no provider request before explicit activation.
9. All 18 chapters and the complete book/part/annotation/world/entity/diagram/source/checkpoint/media/rights/derivative graph pass the final migration manifest with all recorded IDs.
10. A failed, stale, concurrent, or interrupted release cannot advance out of order; the previous complete release restores within five minutes.
11. A clean off-provider export restores into a local build without D1/R2 or external media providers.
12. The old Git content editor is disabled as a write path, eliminating split-brain authority.
13. The Textbook Editor and agents edit isolated multi-document change sets; rejection, stale revision, and concurrent work cannot contaminate canonical heads.
14. Media placements pin immutable asset versions and version/use-bound rights plus human semantic approvals; relevant changes invalidate approval.
15. Draft preview is cross-site, snapshot-bound, read-only, short-lived, uncached, and has no authoring credentials.
16. No normal user/agent can mutate D1/R2 directly; all accepted writes carry base revision, idempotency, actor/run, validation, and audit.
17. Every active release has a signed candidate snapshot, protected code provenance, build attestation, exact security headers, deployment receipt, and verifiable active pointer.

---

## 19. Official technical references

### Approved storage and identity

- [Sanity pricing](https://www.sanity.io/pricing) (rejected for this implementation because the usable private tier exceeds the $5/month ceiling)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [GitHub OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)

### Cloudflare release and storage

- [Workers Versions commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
- [Version preview URLs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/)
- [Version overrides and smoke tests](https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/)
- [Workers rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
- [Static Assets custom headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [Static Assets bindings and `run_worker_first`](https://developers.cloudflare.com/workers/static-assets/binding/)

### Provider embeds

- [WordPress oEmbed architecture and provider allowlist](https://developer.wordpress.org/advanced-administration/wordpress/oembed/)
- [Substack supported media embeds](https://support.substack.com/hc/en-us/articles/360037832971-How-do-I-embed-media-in-my-post-e-g-images-video-GIFs)
- [Substack HTML/CSS boundary](https://support.substack.com/hc/en-us/articles/360037463152-Can-I-edit-the-CSS-or-HTML-on-Substack)
- [YouTube embedded-player parameters](https://developers.google.com/youtube/player_parameters)
- [YouTube IFrame API requirements and errors](https://developers.google.com/youtube/iframe_api_reference)
- [YouTube developer policies](https://developers.google.com/youtube/terms/developer-policies-guide)
- [Vimeo oEmbed](https://developer.vimeo.com/api/oembed)
- [Vimeo player parameters](https://help.vimeo.com/hc/en-us/articles/12426260232977-About-Player-Parameters)
- [Vimeo player cookies](https://help.vimeo.com/hc/en-us/articles/26080940921361-Vimeo-Player-Cookies/)
- [X embedded posts](https://docs.x.com/x-for-websites/embedded-posts/overview)
- [X oEmbed](https://docs.x.com/x-for-websites/oembed-api)
- [X developer policy](https://docs.x.com/developer-terms/policy)
- [Spotify oEmbed](https://developer.spotify.com/documentation/embeds/reference/oembed)
- [SoundCloud oEmbed](https://developers.soundcloud.com/docs/oembed)
- [Bluesky oEmbed](https://docs.bsky.app/docs/advanced-guides/oembed)
- [TikTok embed API](https://developers.tiktok.com/doc/embed-videos/)
- [oEmbed specification and security considerations](https://oembed.com/)

### Accessibility and security

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- [Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)
- [Captions for prerecorded media](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded)
- [Content Security Policy Level 3](https://www.w3.org/TR/CSP/)
- [HTML iframe and sandbox model](https://html.spec.whatwg.org/multipage/iframe-embed-object.html)

### Agent tooling

- [Plan MCP tools](https://developers.openai.com/plugins/plan/tools)
- [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [Build Skills](https://developers.openai.com/plugins/build/skills)
- [Optimize MCP metadata](https://developers.openai.com/plugins/guides/optimize-metadata)

---

## 20. Immediate next decision

Phase 0 architecture decision (approved):

> After shadow migration and canary, D1/R2 becomes the sole routine content authority; Git remains the code authority; the public reader remains a static immutable release; arbitrary embed HTML remains prohibited; X renders its authored rich fallback by default and may load the single reviewed official widget only after explicit student activation/consent.

Implementation begins with the clean `origin/main` worktree and the vertical spike. It does not begin by modifying the currently dirty redesign checkout.
