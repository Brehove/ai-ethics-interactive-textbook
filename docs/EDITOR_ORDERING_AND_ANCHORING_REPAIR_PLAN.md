# Editor Ordering and Anchoring Repair Plan

Status: Implemented in code; deployment, D1 application, feature activation, chapter migration, and live content Save remain separately gated
Incident date: August 5, 2026
Implementation baseline: `origin/main` at `46dae14e02389de42b6c5e72756aab516fb5db6f`
Primary incident: Chapter 4, `AI as an Interlocutor in Philosophical Work`

## Implementation outcome

The code implementation was completed on an isolated worktree and branch after the concurrent repository work resolved. It includes the immediate recovery/save hotfix, schema-v3 ordered flow and strict dual-read renderer, semantic operations, MCP and Skill parity, deterministic 18-chapter dry-run migration, audited fail-closed flag definitions, ADR and author guidance, and production-shaped browser regressions. The implementation does not export the real browser-local Chapter 4 recovery artifact, apply migration `0021`, enable a runtime flag, migrate a canonical chapter, deploy a Worker, or perform a live chapter Save.

## Executive decision

Keep stable passage identifiers, but stop using passage anchors as the source of truth for inline layout.

The ordered chapter flow must become authoritative. Checkpoints and other separately managed records will appear in that flow through lightweight typed reference nodes. Passage IDs will continue to support deep links, contextual relationships, drift detection, annotations, agent operations, and revision history. They will no longer reconstruct the visual order of prose and managed content after every render or Save.

The work should ship in two stages:

1. an immediate editor hotfix that preserves the current Chapter 4 recovery draft, prevents duplicate IDs on paragraph split, stops Save from remounting the editor, and exposes exact validation errors;
2. a durable content-contract change that gives checkpoints and managed placements explicit positions in the ordered document.

The immediate hotfix is necessary but not sufficient. Shipping only ID deduplication would leave the anchor-reconstruction model capable of producing future ordering surprises.

No step in this plan authorizes a commit, push, merge, Cloudflare deployment, D1 migration, authority change, or live chapter save. Those remain separately permission-gated.

## Implementation and recovery preflight

Do not implement from the current working tree. It is 64 commits behind `origin/main` and contains substantial unrelated work. Create an isolated worktree from the approved integration head, preserve the current tree unchanged, and recheck the integration head after PR 77 is resolved. The currently deployed editor and Content API include work that is not represented by the planning baseline alone, so a branch cut only from `5a1ccb6` could overwrite newer runtime changes.

The immediate repair and the durable migration are separate releases:

- the immediate v2 identity/order hotfix should be editor-only unless its implementation proves that an API change is required;
- it must not include a D1 migration, public-reader release, authority change, or content-contract v3 write;
- the durable v3 flow model is a later coordinated contract, renderer, API, editor, MCP, and migration change.

Read-only production evidence captured on August 5 establishes that the invalid Chapter 4 draft has not reached server content:

- canonical, D1-authority, and public heads are still `revision_612bd547701051117e3e54af` with content hash `f18b53da93e6d7e8035fa8b41d7da271664da2b24dd98bc7ef514fec41f77cbc`;
- the public projection remains `projection_de28b4d5ae3dc7e52ec89193`;
- Chapter 4 has no `live_commit_commands`;
- open changeset `cs_b464bd27db5bfaddfd82c0a9` is still version 1/checkpoint 0 and matches the canonical content hash.

The recoverable change therefore exists only in the open tab and its `sessionStorage` recovery entry. Do not refresh, close the tab, click Done → Discard, or perform another Save until that entry has been exported and hashed outside the public repository.

## Incident summary

The Chapter 4 editor currently contains this sequence:

```text
paragraph
  blockId:   block_paragraph_1_ch04-p0006
  passageId: passage_ch04-p0006

checkpoint
  checkpointId: checkpoint_opening-judgment
  passageId:    passage_ch04-p0006

paragraph
  blockId:   block_paragraph_1_ch04-p0006
  passageId: passage_ch04-p0006
  text:      PHIL 123 asks students to develop this ability...
```

The second paragraph was created by splitting the original paragraph. Tiptap copied the original node attributes into both fragments. The checkpoint remained anchored to `passage_ch04-p0006`.

Four implementation behaviors then combined:

1. `StableIds` declares `blockId` and `passageId` attributes but leaves Tiptap's `keepOnSplit` behavior enabled and does not generate fresh identities after a split or pasted duplicate.
2. `ProtectedManagedNodes` rejects ordinary transactions that would remove a checkpoint atom, so Backspace cannot join prose across that atom.
3. `editorDocumentContent()` emits anchor-derived managed content once, after the first owner of a duplicated passage ID.
4. `setState("saving")` calls the full `render()` function, destroys the active editor, and recreates the document from the anchor-derived projection before the API answers.

The visible sentence therefore moves back below the checkpoint when Save starts. The Content API then rejects the replacement with `422 VALIDATION_FAILED` because `validateChapter()` detects duplicate stable IDs. The UI collapses the useful error into `Save needs attention`.

The API is behaving correctly by rejecting the invalid chapter. The defects are in editor identity generation, placement authority, save-state rendering, recovery, and error presentation.

## Why stable anchors still exist

Stable identifiers solve real problems that document order alone cannot solve:

- a public URL can return to a particular passage or section;
- reader-to-editor and editor-to-reader navigation can preserve location;
- annotations, sources, people, diagrams, and media can retain a contextual relationship to prose;
- agents can address a specific passage without relying on mutable text or array offsets;
- passage excerpt hashes can show that a checkpoint's intellectual context changed;
- revisions can express replacement, retirement, aliases, and tombstones;
- print, offline, voice, JSON, and HTML projections can share one durable identity vocabulary.

The mistake is not having stable identifiers. The mistake is asking one identifier to do two jobs:

1. identify the passage a managed item concerns;
2. determine the item's exact position in an editable document.

Those jobs must be separated.

## WordPress and Pressbooks comparison

WordPress Gutenberg treats an ordered in-memory block tree as the editor's source of truth and serializes that tree into `post_content`. Its editor-session `clientId` identifies a block while editing, while optional HTML anchors support explicit deep links. It does not ordinarily rebuild every paragraph and dynamic block from an external passage-placement relation.

Pressbooks' documented visual/code editor likewise saves chapter content in its actual HTML order. Shortcodes and other inserted constructs occur at the insertion point in the chapter body. Pressbooks preserves chapter revisions and autosaves, but it does not require every paragraph to act as an invisible layout instruction for nearby special content.

Our target should retain the stronger typed records, rights controls, agent operations, immutable revisions, and static projections that WordPress/Pressbooks do not provide by default while adopting their simpler ordering principle: the document says where an item appears.

References:

- <https://developer.wordpress.org/block-editor/explanations/architecture/data-flow/>
- <https://wordpress.org/documentation/article/revisions/>
- <https://guide.pressbooks.com/chapter/edit-content-with-the-visual-text-editors/>
- <https://guide.pressbooks.com/chapter/create-and-edit-chapters/>

## Scope

### In scope

- Recover the unsaved Chapter 4 instructor draft without publishing it accidentally.
- Prevent duplicate block and passage IDs after split, paste, import, transform, or join operations.
- Make ordered flow authoritative for inline checkpoint placement.
- Preserve typed checkpoint content and checkpoint pedagogical context.
- Extend the ordered-reference model to separately placed person features and any other anchor-projected managed records.
- Preserve stable public passage and section links.
- Preserve no-JavaScript reading, side-panel prompts, print, offline HTML, and voice/JSON projections.
- Preserve D1 authority, immutable revisions, optimistic concurrency, idempotency, and audit history.
- Make save failures actionable and non-destructive.
- Maintain browser/MCP/Skill parity.

### Out of scope

- Changing checkpoint prompts merely because their storage or placement model changes.
- Changing student response behavior, persistence, or privacy.
- Modifying Canvas.
- Replacing Tiptap with Gutenberg, TinyMCE, or another editor.
- Introducing collaboration, analytics, accounts, or a paid editor service.
- Changing rights approval, media review, protected release, or authority boundaries.
- Deploying or publishing as part of the planning work.

## Target invariants

The completed implementation must enforce all of the following:

1. `chapter.body` order is the sole authority for inline order.
2. Every `blockId`, `passageId`, `sectionId`, checkpoint ID, and placement ID is unique in its declared namespace; each checkpoint and placement appears at most once as a flow reference.
3. Splitting a prose block retains the original identity on one fragment and gives every new fragment fresh identities in the same transaction.
4. A checkpoint reference remains at its visible document position when nearby prose is split, joined, moved, pasted, or reformatted.
5. Checkpoint content exists once, in the checkpoint record; the flow node stores only its stable reference.
6. Every checkpoint that appears inline has exactly one reference node.
7. Every reference node resolves to one typed record of the expected kind.
8. Removing a reference does not silently delete its record, and deleting a record cannot leave an orphan reference.
9. The server derives or verifies checkpoint context from the nearest applicable passage and recomputes the excerpt hash.
10. Passage context is not used to override explicit flow order.
11. Save never destroys the editor instance or undo stack merely to change a status label.
12. A failed Save preserves the visible editor state, local recovery copy, selection, and undo history.
13. Client validation and server validation use the same stable error codes and paths.
14. No public reader route depends on the live authoring API or D1 at view time.
15. No student response is persisted or transmitted.

## Target content model

### Ordered flow

Extend the chapter-body union with explicit reference nodes. Reference nodes use the target's already-unique ID instead of pretending to be prose blocks or acquiring a second identity:

```ts
type CheckpointReferenceNode = {
  type: "checkpointRef";
  checkpointId: string;
};

type PlacementReferenceNode = {
  type: "placementRef";
  placementId: string;
};

type ChapterFlowNode = ChapterBlock | CheckpointReferenceNode | PlacementReferenceNode;
```

A chapter can then represent the intended sequence directly:

```json
[
  {
    "type": "paragraph",
    "blockId": "block_paragraph_1_ch04-p0006",
    "passageId": "passage_ch04-p0006",
    "text": "These tools have entered philosophical practice..."
  },
  {
    "type": "paragraph",
    "blockId": "block_paragraph_recovery_01",
    "passageId": "passage_ch04-recovery-01",
    "text": "PHIL 123 asks students to develop this ability..."
  },
  {
    "type": "checkpointRef",
    "checkpointId": "checkpoint_opening-judgment"
  }
]
```

Generic flow-position operations address a content block by `blockId`, a checkpoint reference by `checkpointId`, and a managed-placement reference by `placementId`. Block-edit operations remain restricted to real content blocks. Helpers that enumerate passages must ignore reference nodes.

The checkpoint record remains the canonical source for its prompt, guidance, strategy, response structure, and pedagogical rationale.

### Context versus position

In the next contract version, narrow `PromptCheckpoint.passageId` to contextual meaning only. Retaining the existing field avoids a needless identity rewrite while changing its contract semantics:

```ts
type PromptCheckpoint = {
  checkpointId: string;
  passageId: string; // context/deep-link identity, never inline position
  passageExcerptHash: string;
  // existing pedagogical fields
};
```

During the compatibility window:

- schema v2 reads `passageId` as both legacy context and legacy placement;
- schema v3 reads flow-reference order as placement authority and `passageId` as context only;
- `passageId` is server-derived or server-verified after an explicit checkpoint move or recontextualization;
- legacy exports may derive positional anchor fields from flow, never accept them as a second ordering authority.

The server should normally set contextual `passageId` to the nearest preceding passage-owning block when a checkpoint reference is created or moved. The author may select another nearby passage only through an explicit typed recontextualization option that updates the excerpt hash atomically.

### Ordering metadata

Schema v3 removes `PromptCheckpoint.displayOrder` and the positional meaning of `ManagedPlacement.position` / `orderAtAnchor`; projection order comes only from reference-node order. V2 history remains readable through the frozen adapter. If a legacy consumer still needs those fields during the compatibility window, an export adapter derives them transiently from the flow rather than storing a second order in the v3 record. Remove that legacy export only after:

- every chapter is migrated;
- old snapshots remain readable through an adapter;
- MCP and Skills no longer send the legacy shape;
- a rollback window has passed.

### Other managed content

Media figures and embeds that already exist as body nodes should remain body nodes. Separately stored person features and any other records currently projected through `managedPlacements` should gain `placementRef` nodes. This removes the same bounce risk from scholar cards without duplicating their biography, media, or rights records inside prose.

## Phase 0 — Freeze evidence and add the regression fixture

Purpose: preserve the exact failure before changing code.

Tasks:

1. Record the deployed editor bundle/version and `origin/main` commit used for diagnosis.
2. Add a sanitized Chapter 4 fixture containing:
   - two adjacent paragraphs with duplicated `blockId` and `passageId`;
   - `checkpoint_opening-judgment` anchored to that passage;
   - the prose changes necessary to prove recovery preservation without storing browser credentials or session data.
3. Add a failing unit test showing that paragraph split copies stable IDs.
4. Add a failing editor test showing Save remounts and relocates the checkpoint.
5. Add a failing API test asserting the current duplicate-ID validation response and details.
6. Record the pre-change renderer output for all 18 chapters so migration parity can be measured.

Exit gate:

- the incident reproduces locally without production credentials;
- the fixture contains no secrets or user session data;
- tests fail for the observed reasons, not for unrelated setup problems.

## Phase 1 — Immediate recovery and editor hotfix

Purpose: make the current draft recoverable and stop new invalid drafts before the contract migration is complete.

### 1.1 Preserve the current draft

- Keep the existing editor tab and its session-scoped recovery entry intact until a recovery-capable bundle is available. Do not assume the open D1 changeset contains the draft; production evidence shows that it does not.
- Before any reload or deployment test, export every `sessionStorage` entry whose key begins `ai-ethics-instructor-recovery/chapter_ch04/`. Store the exact JSON outside the public repository and record its SHA-256, recovery key, `savedAt`, base revision, changeset ID, expected version, and pending idempotency key.
- Preserve a second human-readable copy of the intended prose and placement change so the structural recovery can be checked against author intent.
- Do not ask the user to discard, restore an older revision, or manually reconstruct the chapter.
- Retain the original base-revision recovery key until an atomic live commit succeeds and public delivery verification confirms the resulting revision. Remove that captured key explicitly; the current code changes `chapter.revisionId` before recomputing `recoveryKey()`, which can target the new key and leave the old entry behind.
- If a prior Save produced a receipt or `202`, poll that receipt. If transport failed before a receipt was returned, retry only the exact request with the same idempotency key; never create a second mutation key speculatively.
- Add an explicit `Export recovery copy` action that downloads a local JSON file under instructor control. It must not transmit the draft or place it in student-facing storage.

### 1.2 Normalize stable IDs

Add a deterministic `normalizeEditorIdentities()` routine used when:

- hydrating a recovery draft;
- parsing pasted or imported content;
- serializing editor state before preview or Save.

Use `src/lib/editor-visual-document.ts` and the analogous server repair path as historical evidence, not as a drop-in fix: they reconcile only cloned `blockId` values for the older `chapter.replaceBody` workflow, while the current editor sends `chapter.replaceDocument` and must also reconcile `passageId`, `sectionId`, and managed-order intent.

Rules:

1. Treat a contiguous run of duplicated passage fragments as one candidate split event; drop empty editing artifacts before selecting an identity owner.
2. Under the v2 anchor model, retain the original identity on the nonempty fragment immediately preceding an `after` checkpoint/placement or immediately following a `before` placement. This preserves the visible managed boundary without inventing a new semantic anchor.
3. If no managed boundary disambiguates ownership, prefer the fragment with the strongest original-text continuity; use the left fragment only as the documented final tie-breaker.
4. Every other fragment receives fresh cryptographically random chapter-scoped `blockId`, `passageId`, and, where applicable, `sectionId` values.
5. Noncontiguous duplicates, conflicting before/after ownership, or ambiguous managed relationships fail closed into a visible repair review rather than being silently rewritten.
6. Every repair produces an in-memory, content-free report listing changed ID fields and affected checkpoint/placement IDs.
7. No repair is written to D1 until the instructor previews the repaired sequence and clicks Save.
8. `chapterReplaceOperation()` performs a final uniqueness assertion over the same stable-ID namespaces as the server and never sends a malformed replacement.

For the current Chapter 4 draft, the expected repair is:

- mint a new block and passage ID for the first split fragment;
- retain `block_paragraph_1_ch04-p0006` and `passage_ch04-p0006` on the `PHIL 123 asks students...` fragment immediately preceding the checkpoint;
- leave `checkpoint_opening-judgment` on that passage and verify/recompute its excerpt hash through the server;
- show the repaired sequence before Save.

### 1.3 Generate IDs at edit time

Replace the attribute-only `StableIds` extension with a transaction-aware extension.

- On split: retain the left node's IDs and mint IDs for the new right node.
- On paste/duplicate: preserve existing unique IDs only when the paste is an internal move; mint fresh IDs for copied nodes.
- On paragraph/heading/blockquote transformation: preserve the stable identity when the logical node remains the same.
- On list conversion: preserve one owning block/passage identity for the list and never copy it onto each list-item paragraph as independently serializable content.
- On join: preserve one identity, create aliases/tombstones when a public passage identity is intentionally retired, and rebind contextual relationships explicitly.

Do not rely only on pre-Save deduplication. Identity correctness must be true throughout the editing session so selection, managed nodes, undo, and preview all operate on valid state. Setting Tiptap's `keepOnSplit` to `false` is not sufficient by itself: it can prevent a duplicate while retaining the old passage identity on the wrong fragment and still move the checkpoint during v2 reprojection.

### 1.4 Stop full remounts for UI state

Split `render()` into:

- a one-time or structural editor mount;
- lightweight header/status updates;
- isolated dialogs, drawers, and inspector updates that do not destroy Tiptap.

`saving`, `dirty`, `attention`, and `saved` transitions must update the label and button state in place. Save must not recreate the document before receiving the API result. Toolbar commands must not destroy the editor or reset undo history merely to mark the document dirty.

### 1.5 Expose actionable validation

- Run shared structural validation before the network request.
- Preserve the server's error `code`, `path`, and safe message in `AuthoringApiError.details`.
- Render a nonmodal error summary linked to the affected node.
- Use specific language such as `Two paragraphs share passage_ch04-p0006`.
- Keep `Save needs attention` only as the short status label; it must always have adjacent actionable detail.
- Never include chapter prose in logs, analytics, or error telemetry.

Exit gate:

- the Chapter 4 recovery fixture is repaired without prose loss;
- splitting any supported prose node produces unique IDs immediately;
- Save does not remount the editor;
- undo remains available after a failed Save;
- the server still rejects genuinely invalid structures;
- no live chapter has changed.

## Phase 2 — Contract and ADR

Purpose: establish one canonical ordering model before implementation spreads across clients.

Tasks:

1. Add an ADR superseding the anchor-order portions of the unified authoring plan.
2. Freeze content schema v3 with `checkpointRef` and `placementRef` body nodes. Do not add a parallel `orderedNodes` array that could drift from `body`; the body union itself is the single flow.
3. Bump content schema `2 → 3`, the content-contract major version, and the renderer semantic version. HTML parity does not imply projection-hash equality when the renderer version changes.
4. Dispatch projection strictly by declared schema version: frozen anchor projection for v2 and reference-flow projection for v3. Never infer v3 from partially present reference nodes.
5. Define v2-to-v3 and v3-to-legacy-read compatibility behavior.
6. Define reference uniqueness, target resolution, and removal invariants.
7. Define contextual passage derivation and excerpt-hash recomputation.
8. Define split, join, move, paste, whole-chapter replacement, restore, and generic flow-node positioning semantics.
9. Decide and document which fragment retains a public passage ID after a split.
10. Retain aliases and tombstones for intentionally retired public identities.
11. Confirm that the flow model supports paragraph, heading, list, blockquote, table, callout, code, legacy markup, checkpoint, media, embed, person feature, diagram, and artifact nodes.
12. Update all three currently drifting operation definitions together: content contract, Content API Worker schemas, and the manually maintained OpenAPI document.

Recommended split rule:

- the left fragment retains the original passage identity;
- the right fragment receives a new identity;
- a reference node that followed the original paragraph remains after the right fragment naturally because it already follows the split location in the flow;
- contextual passage is recalculated from the reference's final position.

This is the v3 rule. It intentionally differs from the v2 recovery normalizer, which must use anchor adjacency to preserve visible order because v2 has no reference node to hold the checkpoint's position.

Exit gate:

- the ADR is approved;
- schema v3 is deterministic and round-trippable;
- no component treats both anchor metadata and flow order as canonical.

## Phase 3 — Renderer and projection dual-read support

Purpose: make the shared renderer understand explicit references before any canonical chapter is migrated.

Tasks:

1. Extend `projectOrderedChapter()` to dispatch on schema version and walk v3 flow nodes in order.
2. Resolve `checkpointRef` through the checkpoint map.
3. Resolve `placementRef` through the managed-placement and frozen-content maps.
4. Reject duplicate refs, missing targets, type mismatches, and multiply referenced targets.
5. Preserve the existing v2 anchor projector unchanged as a read-only compatibility adapter; reject a v2/v3 hybrid instead of guessing.
6. Emit an internal projection provenance field identifying `v2-anchor-adapter` or `v3-flow`.
7. Keep normalized public HTML, prompts JSON, print, offline, and voice output equivalent for unmodified chapters. Record the expected new projection hashes caused by the renderer-version bump rather than demanding hash equality.
8. Ensure sidebar checkpoint order is derived from the same ordered flow used inline.
9. Ensure author-only decorations never enter canonical content or public projection hashes.

Exit gate:

- all 18 v2 chapters render exactly as before through the frozen v2 adapter;
- migrated fixtures render through v3 with normalized-DOM parity;
- inline and sidebar checkpoint order cannot diverge.

## Phase 4 — Content API and semantic operations

Purpose: make the server enforce the new model and provide safe operations for every client.

Add or revise semantic operations:

```text
block.split
block.join
block.move
checkpoint.upsert
checkpoint.move
checkpoint.remove
managedPlacement.upsert
managedPlacement.move
managedPlacement.remove
chapter.replaceDocumentV3
```

Every insertion or move uses a generic flow position, `{ beforeNodeId }` or `{ afterNodeId }`, whose target may be a block, checkpoint reference, or placement reference. Block editing still accepts only `blockId` targets.

Requirements:

- `block.split` mints the new identities server-side when invoked through MCP/API and returns them.
- `checkpoint.upsert` edits an existing checkpoint without implicitly moving it. Creating a checkpoint atomically creates its one reference at the requested flow position.
- `checkpoint.move` moves the existing reference and optionally recontextualizes `passageId`; a contextual change rebinds the excerpt hash atomically.
- checkpoint removal removes record and reference in one guarded operation.
- managed-placement creation, movement, and removal apply the same one-record/one-reference rule.
- whole-document replacement preserves reference nodes and cannot silently drop managed records.
- `replaceBody` and plain-text import preserve protected references; `replaceDocumentV3` validates exact one-to-one reference coverage.
- operation batches remain idempotent and optimistic-concurrency guarded.
- live Save continues to create one immutable revision and one matching public projection.
- schema-v3 validation runs before revision, projection, head, authority, or receipt writes.
- error details remain content-free but include stable node IDs and contract paths.
- semantic diff reports managed moves by flow index and does not double-count reference nodes as ordinary block edits.

D1 implications:

- Canonical chapter content is stored as immutable JSON in `document_revisions`; reference nodes do not require a new relational content table.
- The immediate editor hotfix requires no D1 migration. The v3 release should also default to no schema migration; add one only if an approved audited compatibility control genuinely requires new relational state.
- Do not use or modify migration `0015`'s non-revision-scoped `chapter_checkpoints` table as canonical placement storage.
- Never mutate existing revision JSON in place.
- Each migrated current head becomes a new immutable revision through the normal guarded content workflow.
- Open changesets must be explicitly migrated/rebased or invalidated; restored v2 revisions must pass through the upgrader before becoming writable.

Exit gate:

- API tests prove atomic reference/content changes;
- stale bases and idempotent retries retain current behavior;
- validation failure creates no orphan revision, projection, operation, or receipt.

## Phase 5 — Editor flow implementation

Purpose: make the visible editor manipulate the same ordered model the server saves.

Tasks:

1. Define Tiptap nodes for `checkpointRef` and `placementRef`.
2. Render both as selectable, non-text-editable atom nodes using the shared renderer.
3. Preserve reference nodes directly in serialization rather than discarding and reinserting them from anchors.
4. Permit reference-node movement through explicit toolbar/inspector actions and keyboard-accessible move controls.
5. Keep ordinary character editing from corrupting managed nodes.
6. Replace the current sorted managed-ID equality filter with transaction rules that preserve the ordered reference sequence and distinguish authorized move, insert, and removal commands. Sorted membership protects existence but cannot protect order.
7. Make document list/order controls operate on flow nodes rather than anchor/order pairs.
8. Keep selection and focus stable when opening or closing the inspector.
9. Preserve full undo/redo for prose edits and authorized reference movement.
10. Keep an advanced structured view capable of round-tripping v3 for emergency repair, with the same server validation.

The visual behavior for the incident becomes ordinary:

1. the checkpoint reference follows the paragraph;
2. pressing Enter inside the paragraph creates a second paragraph before the existing reference;
3. the checkpoint therefore remains after both fragments;
4. moving the second paragraph above or below the checkpoint changes actual flow order and persists;
5. Save serializes that order without reprojecting it.

Exit gate:

- no supported visual edit produces duplicate IDs;
- moving prose or a checkpoint produces the same order after Save and reload;
- failed Save causes no bounce, remount, focus loss, or undo loss.

## Phase 6 — Authoring client, MCP, and Skills

Purpose: keep browser and agent behavior contract-identical.

Tasks:

1. Add v3 request/response types to `packages/authoring-client`.
2. Add typed MCP tools for checkpoint/reference insertion and movement.
3. Preserve checkpoint IDs when revising prompt content.
4. Return created block/passage IDs and the referenced checkpoint/placement IDs from split and insertion operations.
5. Update the checkpoint Skill to distinguish contextual passage from inline reference position.
6. Require `get_authoring_view`, exact target reading, preview, and current base revision as before.
7. Replace MCP's current `reorder_checkpoint → checkpoint.upsert` mapping with `move_checkpoint`; retain `reorder_checkpoint` only as a temporary compatibility alias.
8. Update Skill tests so no agent can simulate placement by rewriting raw anchor fields.
9. Preserve the explicit `content:live-save` capability requirement.

Exit gate:

- browser and MCP produce identical canonical revisions for equivalent operations;
- an agent cannot create an orphan checkpoint or move one by raw JSON mutation;
- no Skill implies that a draft or preview is live.

## Phase 7 — Migration

Purpose: convert current heads without rewriting history or changing visible content.

### Migration algorithm

For each chapter current head:

1. Parse and validate the v2 chapter.
2. Walk body blocks in order and build a passage-to-owner index.
3. For each passage, sort checkpoints and placements by the existing shared comparator.
4. Insert `checkpointRef` and `placementRef` nodes at the current projected positions.
5. Preserve checkpoint IDs, contextual `passageId` values, excerpt hashes, prose block IDs, passage IDs, and section IDs. A structurally equivalent migration must not masquerade as a contextual content edit.
6. Verify existing excerpt hashes; recompute only when a separately surfaced integrity error requires it.
7. Remove `displayOrder`, `position`, and `orderAtAnchor` from the v3 canonical records; derive them only in the temporary legacy export adapter and migration evidence.
8. Render v2 and v3 projections and compare normalized DOM, prompts, public assets, and rights output.
9. Write a new revision only after parity passes.
10. Record a migration report containing IDs and hashes but no copied prose.

The migration must be:

- deterministic;
- idempotent;
- resumable;
- dry-run capable;
- one chapter per guarded transaction;
- incapable of modifying Git-authoritative chapters through D1;
- incapable of rewriting historical revisions;
- explicit about rebasing, upgrading, or invalidating every open v2 changeset before a v3 head becomes writable.

The currently inspected corpus has 54 checkpoints and no repeated checkpoint anchors or checkpoint/person collisions, so production parity alone will not exercise total-order ambiguity. Repeated-anchor and mixed checkpoint/person fixtures are mandatory even if all current chapters migrate cleanly.

### Canary order

1. A disposable draft or Chapter 7, because it is the authoring-platform operational canary and does not contain the only recovery copy of the incident draft.
2. Chapter 4, after its browser-local recovery artifact has been exported, repaired, previewed, and validated against the unchanged base revision.
3. A chapter with multiple checkpoints at one passage.
4. A chapter with multiple person-feature placements.
5. The remaining D1-authoritative chapters.
6. Git-authoritative chapters only at their separately approved authority cutover.

The current v2 runtime flags are enabled for all 18 chapters, so this sequence is not a real per-chapter canary until a documented operator-controlled flag or equivalent routing mechanism exists.

Exit gate per chapter:

- v2/v3 normalized public projection parity;
- exact checkpoint and managed-placement counts;
- exact inline/sidebar order;
- no orphan target or duplicate ID;
- successful immutable revision and public delivery receipt;
- verified editor reload and public no-JavaScript route.

## Phase 8 — Test matrix

Current coverage does not reproduce this incident. `tests/browser/editor-flow.spec.ts` contains three local/demo Chapter 7 tests; with `dataSource === null` it does not exercise authentication, changesets, `commitLive`, D1, structured `422`/`409` failures, recovery storage, or public delivery. Existing managed-card protections in `tests/e2e/editor-static.test.mjs` are source-regex assertions, not runtime ProseMirror coverage. Add a production-shaped harness instead of treating the present browser suite as a release gate for this repair.

### Unit and property tests

- split paragraph before checkpoint;
- split paragraph after multiple checkpoints;
- split heading, list, blockquote, callout, and table-adjacent prose;
- join adjacent prose;
- attempted join across a reference node;
- copy versus move semantics;
- paste internal nodes and external rich text;
- convert paragraph to heading/list/blockquote and back;
- duplicate IDs contiguous and noncontiguous;
- reference insertion, move, and removal;
- multiple checkpoints at one location;
- checkpoint plus person feature at one location;
- undo/redo across split and reference movement;
- normalization idempotency;
- randomized edit sequences asserting namespace uniqueness after every transaction.

### Contract and API tests

- v2 and v3 schema acceptance boundaries;
- missing, duplicate, orphan, and multiply referenced targets;
- context passage derivation;
- excerpt-hash recomputation;
- v2-to-v3 deterministic migration;
- idempotent live Save;
- stale revision conflict;
- validation failure creates no writes;
- invalid/orphaned references create no revision, live-commit row, projection, authority advance, receipt, or public-head change;
- full replacement cannot silently remove refs;
- content-equivalent no-op behavior;
- structured error-code and path propagation.

### Renderer tests

- normalized-DOM equality for all 18 chapters;
- inline/sidebar checkpoint sequence equality;
- reader/editor/preview/print/offline parity;
- person, media, embed, diagram, artifact, and legacy fallback order;
- no authoring decoration in projection identity;
- no provider request before explicit activation.

### Browser tests

- exact Chapter 4 reproduction and recovery;
- Save without bounce;
- selection and scroll position preserved through Save;
- undo remains available after failed Save;
- reload restores recovery safely;
- valid, malformed, accepted, and cancelled recovery entries;
- failed `422` and `409` retain the original recovery key and pending idempotency key;
- verified Save clears the exact original base-revision recovery key;
- two-tab revision conflict;
- session expiry and reconnection;
- desktop and 390-pixel mobile views;
- keyboard movement and focus return;
- 200% zoom and no horizontal overflow;
- visible, specific validation error linked to the affected node.

### Delivery and deployment-boundary tests

- accepted Save receipt, revision, projection, and hashes match public response headers;
- `202` polling reaches verified delivery without a second mutation;
- editor-only rollback changes no Content API or reader version;
- v3 reader rollback retains both v2 and v3 read compatibility;
- a Worker rollback across any D1 migration is blocked unless backward compatibility is proven.

### Required commands

During development:

```bash
npm run test:instructor-editor
npm run test:contract
npm run test:renderer
npm run test:content-api
npm run test:authoring-client
npm run test:mcp
npm run test:skills
npm run test:browser -- --grep "split|checkpoint|save|recovery"
npx wrangler deploy --dry-run --config apps/instructor-editor/wrangler.jsonc
```

Before release handoff:

```bash
npm run content:generate
npm run validate
npm run build
npm run build:instructor-editor
npm run test:visual
npm run test:a11y
```

## Phase 9 — Rollout, observation, and rollback

### Feature flags

Use the existing server-controlled `unified_editor` flag only as the immediate editor kill switch. Leave `server_public_projection` and `shared_renderer` enabled so the public reader continues serving the unchanged projection.

For the durable release, add or define audited, fail-closed controls for:

- `editor_identity_normalization`;
- `ordered_managed_references_v3`;
- `legacy_anchor_projection_adapter`.

Enable them per document. Do not use a browser-controlled flag to weaken server validation. The repository currently documents no operator API/workflow for changing runtime flags, and the current v2 flags cover all 18 chapters; close that operational gap before calling a flag a dependable canary or rollback mechanism.

### Rollout sequence

1. Export and hash the Chapter 4 recovery artifact; recapture the canonical/public head and the exact prior editor/API/reader deployment versions.
2. Resolve PR 77 and base the editor-only hotfix on the approved integration head.
3. Pass the complete hotfix gate, including runtime Playwright coverage and editor Wrangler dry-run.
4. Upload the editor version without traffic where the platform permits, test the authenticated preview, then deploy only the editor after explicit authorization.
5. Canary the hotfix on a disposable draft or Chapter 7.
6. Restore the preserved Chapter 4 draft, run identity normalization, inspect the semantic diff, and preview/validate without committing live.
7. Obtain explicit authorization for the Chapter 4 live Save, then verify the immutable revision, content/projection hashes, delivery receipt, public URL, no-JavaScript HTML, editor reload, focus/keyboard behavior, and an empty application console.
8. Separately merge and deploy v3 dual-read support with v3 writing disabled.
9. Migrate the approved canary cohort, expand only after ordinary editing remains stable, and remove the legacy adapter only after all active heads are v3 and the rollback window closes.

### Safe operational evidence

Record only instructor-authoring operational data already permitted by the control plane:

- validation error code and path;
- save result and latency;
- revision, projection, and receipt IDs;
- migration version and parity result;
- feature-flag version.

Do not record prose, selections, clipboard data, student responses, or generalized reader analytics.

### Rollback

- Before every deploy, re-read Cloudflare deployment/version state; the August 5 observation was editor `e882b4e8-dd43-45ff-a796-a2c5169fa33b`, Content API `89d76194-89f0-4443-b09b-cffc2a4f032c`, and reader `eee1e04f-6c7d-4265-a8e7-5f7ffd7ce6bf`, but those identifiers are evidence, not timeless configuration.
- An editor-only regression with no accepted bad Save rolls back only the editor to its captured immediately prior version. Do not roll back the Content API or reader when they were not changed.
- Code rollback must retain the v3 read adapter once any v3 revision exists.
- A feature-flag rollback can disable v3 writing while keeping v3 reading.
- Content rollback restores a prior immutable revision as a new draft and requires a separately authorized live Save.
- Do not reverse-mutate D1 rows or delete v3 revisions.
- Preserve the pre-migration projection and exact prior head identity in the migration report.
- `.github/workflows/content-rollback.yml` does not roll back the independently deployed editor or Content API. Until the editor has a protected receipt-backed deployment workflow, record its prior version and manual verification evidence explicitly.

## File-by-file implementation map

| Area | Primary files | Required change |
| --- | --- | --- |
| Editor identity | `apps/instructor-editor/src/tiptap-editor.ts` | Transaction-aware stable IDs; explicit ref nodes; direct serialization; authorized managed-node transforms |
| Editor state | `apps/instructor-editor/src/main.ts` | Non-destructive save-state updates; recovery normalization/review; exact validation UI |
| Editor model | `apps/instructor-editor/src/editor-model.ts` | v3 types, context/position separation, reference operations, recovery report |
| Editor tests | `apps/instructor-editor/tests/editor-model.test.ts` | Split/join/paste/ref/recovery/ordering coverage |
| Browser tests | `tests/browser/editor-flow.spec.ts` | Incident reproduction, bounce prevention, undo, focus, recovery |
| Browser harness | `tests/browser/support/harness.ts` | Production-shaped commit-live, structured failure, recovery, and delivery seams |
| Static editor boundary | `tests/e2e/editor-static.test.mjs` | Assert v3 nodes and forbid legacy-only placement behavior |
| Content contract | `packages/content-contract/src/index.ts` | Schema v3, ref-node union, reference/context invariants |
| OpenAPI | `packages/content-contract/openapi/content-api.v1.openapi.json` | Typed v3 operations and structured validation responses |
| Renderer | `packages/chapter-renderer/src/index.mjs`, `index.ts` | v3 flow walker plus v2 compatibility adapter |
| Authoring client | `packages/authoring-client/src/index.ts`, `index.mjs` | v3 request/response types and error details |
| Content API | `workers/content-api/src/services.mjs` | Reference validation, split/join/move operations, migration helpers |
| Live commit | `workers/content-api/src/index.mjs` | v3 validation/projection, flag enforcement, no orphan writes |
| D1 | `workers/content-api/migrations/` | No migration for the hotfix and none by default for v3; add only approved control state, never historical JSON rewrites |
| Public projection | `workers/public-projection/` | Consume v3 projection without new mutation or public D1 authority |
| MCP | `workers/textbook-mcp/src/index.mjs` | Typed reference and block operations |
| Import/export | `scripts/content/import-git.mts`, `export-snapshot.mts`, `seed-d1.mts` | Deterministic v2/v3 adapters and reports |
| Migration tests | `tests/migration/` | Idempotency, parity, all-chapter counts, rollback readability |
| API tests | `tests/api/` | Atomicity, validation, context, conflict, idempotency |
| Renderer tests | `tests/renderer/` | v2/v3 parity and single-order proof |
| MCP/Skill tests | `tests/mcp/`, `tests/skills/` | Browser/agent parity and publication boundaries |
| Architecture docs | `docs/architecture/adr/` | New ADR for ordered flow and narrowed anchor semantics |
| Author guidance | `docs/AUTHORING.md`, `docs/CONTENT_MODEL.md` | Explain visible order, references, identity, and recovery |
| Prompt guidance | `docs/READING_RECORD_PROMPT_DESIGN.md` | Preserve pedagogical context while removing positional-anchor ambiguity |
| Platform plan | `docs/UNIFIED_READER_AUTHORING_IMPLEMENTATION_PLAN.md` | Record superseded anchor-order assumptions and rollout state |
| Workspace-local plan | `PLAN.md` (not tracked on `origin/main`) | Reconcile the local planning record separately after the repository plan is approved |

## Pull-request structure

Use an isolated branch and separate reviewable PRs:

1. **PR 1 — Incident fixture and editor hotfix**
   Stable IDs, non-remounting Save, actionable validation, recovery normalizer, and regression tests.

2. **PR 2 — ADR and content contract v3**
   Ordered reference nodes, compatibility rules, OpenAPI, and contract tests.

3. **PR 3 — Renderer/API dual-read support**
   v3 projector, semantic operations, authoring client, MCP, and server tests.

4. **PR 4 — Editor v3 flow**
   Tiptap reference nodes, movement controls, serializer, undo/recovery, and browser tests.

5. **PR 5 — Deterministic migration and rollout evidence**
   Dry-run reports, Chapter 4/7 canaries, parity evidence, and documentation closure.

Do not combine the current draft's live content Save with a code PR or protected code release. Code deployment, content migration, and live chapter publication require distinct evidence and authorization.

## Acceptance criteria

The update is complete only when all of the following are true:

- The current Chapter 4 recovery draft can be restored and saved without manual prose reconstruction.
- Pressing Enter in an anchored paragraph creates a new unique paragraph and leaves the checkpoint visually where the author sees it.
- Moving prose or a checkpoint remains stable through Save and reload.
- Save never remounts the document or erases undo history.
- Duplicate or orphan identities are impossible through supported editor operations and rejected with actionable detail otherwise.
- Inline and sidebar checkpoint order come from one canonical flow.
- Passage deep links, annotations, agent addressing, excerpt hashes, aliases, and tombstones continue to work.
- All 18 chapters retain public projection parity unless an intentional content change is separately approved.
- Required reading remains complete without JavaScript.
- Print, offline, voice, mobile, keyboard, focus, zoom, and privacy gates pass.
- Every accepted live Save has an immutable revision, projection hash, public delivery evidence, and audit record.
- No migration, deploy, authority change, or publication occurred without its own explicit authorization.

## Estimated effort

| Workstream | Estimate |
| --- | ---: |
| Incident fixture and immediate hotfix | 2–3 engineering days |
| ADR, schema v3, and compatibility adapters | 2–4 engineering days |
| Renderer, API, client, and MCP changes | 4–6 engineering days |
| Editor v3 flow and recovery UX | 4–6 engineering days |
| Migration, all-chapter parity, browser QA, and rollout evidence | 3–5 engineering days |
| Total | 15–24 engineering days |

The durable implementation is not a one-line anchor patch. The hotfix can stop the present failure quickly, but the ordering model, migration compatibility, and cross-surface tests are what prevent the same class of defect from returning.
