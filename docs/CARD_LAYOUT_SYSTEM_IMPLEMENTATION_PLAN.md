# Flexible Card Layout System Implementation Plan

Status: baseline implemented in code; protected production rollout and human crop-approval slice pending

Updated: August 5, 2026

Primary dependency: schema-v3 ordered chapter flow

Target content schema: v4

Initial canary: Chapter 7, Aristotle manuscript and thinker cards

## 1. Objective

Implement a flexible, agent-native card layout system for the AI Ethics textbook. Instructors and authorized agents must be able to control card size, placement, grouping, media framing, and card-versus-prose arrangements through the browser editor, Content API, and textbook MCP without supplying CSS, HTML, pixel values, or renderer code.

The system must support, at minimum:

- small, medium, reading-width, wide, full-surface, and bleed cards;
- block cards aligned to the logical start, center, or logical end;
- compact cards placed to the logical left or right of an explicit, bounded prose span, with text wrapping;
- card-and-text split layouts;
- responsive two- to six-card groups, including two-, three-, and four-column arrangements;
- equal and featured column arrangements;
- compact, standard, and expanded card detail;
- placement-specific image fit, aspect ratio, and focal point;
- deterministic mobile stacking, print output, offline HTML, and no-JavaScript rendering;
- clear MCP guidance about when each arrangement is appropriate.

After the platform capability is deployed once, ordinary layout changes must be D1-authoritative content operations. They must not require a Git commit or website deployment unless a new renderer capability or layout primitive is being introduced.

## 2. Why this is a platform feature

The current system has individual `displayPreset` values, but it does not have a complete layout model:

- body cards such as media and embeds carry their own limited display preset;
- person features are separately managed placements;
- legacy Wikimedia artifacts, scholar figures, diagrams, and release placements still have code-owned insertion paths;
- the current Aristotle pairing is detected from adjacent DOM nodes and wrapped in the browser;
- the MCP can move a managed placement but cannot express a relationship among several cards or between a card and prose;
- `MediaFigure.align` and embed display presets are accepted by parts of the contract but are not consistently enforced by the frozen renderer;
- schema-v3 MCP creation tools for media and embeds do not yet expose the exact flow position required by the Content API;
- the renderer does not own a normalized, reusable vocabulary for bounded wraps, split layouts, grids, density, or framing.

Layout therefore needs a typed contract shared by every authoring and rendering surface. It cannot be solved by expanding one component's CSS or by allowing an agent to submit arbitrary style values.

## 3. Controlling architectural decisions

### 3.1 Ordered flow remains the only placement authority

This plan depends on the schema-v3 ordered-flow model described in `docs/EDITOR_ORDERING_AND_ANCHORING_REPAIR_PLAN.md` and ADR 0008.

- Blocks, `checkpointRef` nodes, and `placementRef` nodes remain in one canonical body sequence.
- A layout record may change presentation but may not become a second source of document order.
- A shared `presentation` field lives on each rendered occurrence: directly on a layout-capable body card and on `ManagedPlacement` for a separately stored person feature; `layoutRegions` decorate explicit contiguous spans of the same flow.
- Presentation never lives on a `placementRef`, passage anchor, immutable media/entity record, or normalized D1 side table.
- Region members must already be contiguous in canonical flow.
- Moving a card or prose block remains a flow operation.
- Creating or changing a layout never silently moves content.
- The renderer always traverses `body`; a region boundary groups nodes during that traversal and never supplies a second member order.

Schema v3 and ADR 0008 already establish ordered flow. Treat those semantics as frozen. Card presentation and layout regions ship in schema v4, with deterministic v3-to-v4 draft-head migration and read-only v2/v3 historical adapters. Do not add layout fields to the declared v3 contract.

### 3.2 Styling remains renderer-owned

Agents and instructors select semantic layout fields and approved recipes. They never provide:

- CSS declarations or class names;
- raw HTML or wrapper markup;
- pixel, `rem`, percentage, grid-template, or breakpoint values;
- negative margins, absolute positioning, overlap, or z-index;
- arbitrary mobile or print overrides;
- visual reordering that contradicts source order.

The renderer maps semantic choices to reviewed HTML and CSS. Releases pin the renderer version and layout-catalog version.

### 3.3 Maximum flexibility comes from orthogonal typed controls

A single long preset enum would be easy to ship but difficult to extend. Arbitrary CSS would be flexible but unsafe and impossible for agents to use reliably. Use two layers instead:

1. **Typed primitives** stored in canonical chapter data.
2. **Named recipes** returned by a versioned layout catalog and used by agents and the editor to populate valid primitive combinations.

Recipes make common choices clear. Orthogonal primitives preserve flexibility when a common recipe needs a safe adjustment.

### 3.4 Logical reading order is never inferred from visual placement

- `start` and `end` are stored instead of `left` and `right`.
- The English editor may label them Left and Right, but the contract remains direction-safe.
- Mobile and assistive-technology order follows canonical chapter flow.
- Grid and split regions never use CSS `order` to contradict source order.
- A card visually placed beside prose must have an explicit, reviewable position in the flow.

### 3.5 Essential reading remains complete without JavaScript

All layout wrappers are produced server-side in the frozen public projection. JavaScript may enhance controls but may not create the essential layout, restore missing content, or determine reading order.

### 3.6 Card identity and card presentation are separate

`thinker-card`, `figure`, `diagram`, `rich-link`, and `embed` identify renderer components. `compact`, `narrow`, `reading`, `wide`, `full`, and `bleed` describe presentation. Do not preserve `thinker-card` as a width or combine identity and arrangement into compound values such as `narrow-right-wrap-thinker-card`.

The v2/v3 compatibility path reads old `displayPreset` values and synthesizes the equivalent v4 `presentation` for migration and historical rendering. V4 removes `PersonFeatureProjection.displayPreset` as a second canonical setting.

### 3.7 Platform release and content edits remain separate

The first implementation changes contract, renderer, editor, API, MCP, and Skill code, so it follows the protected Git release path. After that release and a chapter's D1 cutover, choosing an existing size, wrap, split, grid, density, or frame is an ordinary Content API revision and live-save operation. It does not edit GitHub or redeploy the website.

The API and MCP must report the chapter's active authority and schema version. They reject layout mutation for a Git-authoritative or pre-v4 chapter and never dual-write Git and D1. Adding a new primitive, renderer behavior, or catalog recipe remains platform code work; applying an already released primitive or recipe remains content work.

## 4. Layout-capable content

### 4.1 Supported card kinds

The first complete release should support:

| Card kind | Single-card sizing | Wrap | Multi-card group | Card-text split | Density | Framing |
|---|---:|---:|---:|---:|---:|---:|
| Person / thinker feature | Yes | Yes | Yes | Yes | Yes | Portrait |
| Artifact / primary-source figure | Yes | No by default | Yes | Yes | Yes | Contain/intrinsic |
| Still image / media figure | Yes | Yes | Yes | Yes | Yes | Yes |
| Document / PDF card | Yes | No | No in P0 | Yes | Yes | Poster only |
| Audio / video card | Yes | No | No in P0 | Yes | Yes | Poster only |
| External embed / provider player | Yes | No | No in P0 | Yes | Yes | Poster only |
| Rich link | Yes | Yes | Yes | Yes | Yes | Poster if present |
| Diagram | Yes | No by default | Yes | Yes | Standard | Contain only |
| Source / citation card | Yes | Yes | Yes | Yes | Yes | If present |

Checkpoint cards are excluded from free-form layout in P0. Their inline order and relationship to the reading-record progression are pedagogically significant. Prose callouts remain prose blocks, not layout cards, in P0. A later proposal may add reviewed checkpoint or callout layouts without weakening reading order.

### 4.2 Closed-world v4 card union

The capability table is implemented against an explicit v4 discriminated union, not visual guesses or renderer class names:

```ts
type LayoutCapableBodyCardV4 =
  | MediaFigureV4
  | ArtifactCardV4
  | MediaCardV4
  | ExternalEmbedV4
  | RichLinkV4
  | DiagramCardV4
  | SourceCardV4;

type LayoutCapableOccurrenceV4 =
  | LayoutCapableBodyCardV4
  | PersonFeatureManagedPlacementV4;
```

| V4 card type | Source/migration path | Closed-world validation |
|---|---|---|
| `MediaFigureV4` | Existing `mediaFigure` | Frozen media version resolves to `image` or `animatedImage` |
| `ArtifactCardV4` | Current static Wikimedia/primary-source artifacts | Typed artifact/source record, still-image media version, rights case, and teaching-use fields all resolve |
| `MediaCardV4` | New typed renderer for existing media asset kinds | Frozen media version resolves to exactly `shortVideo`, `audio`, or `document`; poster/transcript/fallback requirements vary by kind |
| `ExternalEmbedV4` | Existing `externalEmbed` | Provider identity/options/fallback remain valid; provider players are not wrap/grid capable in P0 |
| `RichLinkV4` | Existing `richLink` | Canonical URL, summary, fallback link, and any poster version resolve |
| `DiagramCardV4` | Existing `diagram` plus its typed diagram record | Diagram identity and complete accessible description resolve; crop remains forbidden |
| `SourceCardV4` | New typed body block for a source/citation record | Frozen source identity and locator resolve; optional media uses the same media-version checks |
| `PersonFeatureManagedPlacementV4` | Existing person feature plus managed placement | Placement resolves to one frozen person feature/entity revision and carries the sole presentation value |

Media-based blocks declare their expected media kind for contract discrimination, but the Content API, repository validator, and release materializer must independently resolve `mediaVersionId` against the frozen media record and reject any mismatch. No client-supplied kind is trusted by itself. All other block and placement types are non-card nodes unless a later schema version adds them explicitly.

### 4.3 Legacy content that must become typed

MCP layout control cannot be complete while cards remain outside the canonical D1 chapter projection. Inventory and migrate:

- `InlineArtifacts.astro` records;
- `InlineScholarFigures.astro` records;
- `InlineConceptDiagrams.astro` records;
- `InlineReleasePlacements.astro` records;
- any remaining code-owned chapter-specific card or aside;
- legacy markup that is visually a card and has an approved typed replacement.

Preserve stable identities, source provenance, rights, captions, alt text, teaching use, and existing visual order. Do not migrate decorative or obsolete cards merely to increase feature count.

## 5. Canonical data model

The exact Zod syntax may change during contract review, but the semantic model must remain equivalent to the following.

### 5.1 Card presentation

Store one required normalized `presentation` object on each v4 rendered occurrence: directly on a layout-capable body card, and on `ManagedPlacement` for a separately stored person feature. Do not attach it to `placementRef` or `PersonFeatureProjection`; those would create a second canonical value for the same rendered occurrence. Every supported occurrence uses the same `CardPresentation` schema. Only v2/v3 historical readers and the v3-to-v4 migration adapter may synthesize a missing presentation from legacy defaults; a v4 document with a missing presentation is invalid.

```ts
type CardWidth =
  | "compact"
  | "narrow"
  | "medium"
  | "reading"
  | "wide"
  | "full"
  | "bleed";

type LayoutNodeRef =
  | { refType: "block"; blockId: `block_${string}` }
  | { refType: "placement"; placementId: `placement_${string}` };

type CardPresentation = {
  width: CardWidth;
  align: "start" | "center" | "end";
  density: "compact" | "standard" | "expanded";
  mediaFrame?: MediaFrame;
};

type LayoutCapableBodyCard = ExistingTypedCardFields & {
  presentation: CardPresentation;
};

type LayoutCapableManagedPlacement = ExistingManagedPlacementFields & {
  presentation: CardPresentation;
};
```

Semantics:

| Field | Meaning |
|---|---|
| `width` | Semantic maximum width or breakout surface; never a client-supplied measurement |
| `align` | Alignment of a standalone card inside its available surface; it does not create text wrapping |
| `density` | Renderer-supported amount of visible card detail; never blind string truncation |
| `mediaFrame` | Placement-specific visual treatment of an image or poster |

Text wrapping and card-versus-prose relationships belong to explicit layout regions, not to individual cards. This prevents a wrap scope from being inferred from the next heading or from mutable DOM adjacency.

`mediaFrame` is absent for card kinds without visual media. V4 requires it whenever the occurrence resolves to an image or poster and forbids it when no visual asset exists; historical adapters synthesize `intrinsic` when needed. The normalized effective presentation returned by the API always makes the result explicit.

Width definitions are renderer tokens:

| Width | Author meaning |
|---|---|
| `compact` | Label, thumbnail, or very short contextual card |
| `narrow` | Small supporting card that remains independently legible |
| `medium` | Substantial supporting card or large wrapped card |
| `reading` | Normal prose-column width; safe default |
| `wide` | Wider than prose but contained within the reading workspace |
| `full` | Full primary reader surface without entering application chrome |
| `bleed` | Reviewed visual breakout to the safe reader boundary |

The renderer owns the actual measurements. Agents never reason from hard-coded pixels. `Bleed` means the safe chapter canvas, never the viewport, reader outline rail, application gutter, or context panel.

The reader shell must expose named renderer lanes so `wide`, `full`, and `bleed` cannot collapse into subjective CSS:

| Renderer lane | Required boundary |
|---|---|
| `reading` | Normal prose measure |
| `wide` | Reviewed visual measure inside the primary chapter column |
| `full` | Entire primary chapter content box, preserving its internal padding |
| `bleed` | Separate safe breakout lane extending into the primary column's internal gutters but never into outline/context rails or viewport edges |

Implement these as named grid lines or equivalent renderer-owned container tokens in `ReaderShell`; prohibit viewport-width and negative-margin emulation. The specimen catalog must show all four lanes at every supported reader-shell configuration before contract freeze.

### 5.2 Media framing

```ts
type FrameAspect =
  | "square-1x1"
  | "portrait-2x3"
  | "portrait-4x5"
  | "landscape-4x3"
  | "widescreen-16x9";

type MediaFrame =
  | { mode: "intrinsic" }
  | { mode: "contain"; aspect: FrameAspect }
  | {
      mode: "crop";
      aspect: FrameAspect;
      focalPoint: { x: number; y: number }; // integers 0-100
      framingApprovalId?: `approval_${string}`;
    };
```

Rules:

- `focalPoint` is accepted only with `mode: "crop"`.
- `intrinsic` and `contain` must never crop the source.
- diagrams, manuscripts, screenshots containing text, charts, tables, documents, and other evidence-bearing images may not use `crop` in a publishable revision;
- portraits and decorative imagery may use `crop` with a reviewed focal point;
- the editor may offer nine-point shortcuts, but the canonical 0-100 coordinates preserve fine placement control;
- a meaningful crop requires an approval bound to media version, card placement, frame hash, alt text, caption, and teaching use; an agent may propose a crop but may not create its approval;
- a framing change updates the placement's semantic hash and invalidates the applicable visual/editorial approval and any crop-bound rights approval;
- the full source image and credit remain reachable when required by the rights record.

#### Human-only framing approval

A crop may exist in a draft without approval so an agent or instructor can propose and preview it. A publishable crop requires a separate immutable approval whose subject is exact:

```ts
type FrameApprovalSubject = {
  chapterId: string;
  target: LayoutNodeRef;
  mediaVersionId: string;
  normalizedFrameHash: string;
  altHash: string;
  captionHash: string;
  teachingUseHash: string;
  rendererFramingPolicyVersion: string;
  protectedPreviewSetHash: string; // wide, mobile, and print crop artifacts
};

type FrameApproval = {
  framingApprovalId: `approval_${string}`;
  subjectHash: string;
  approvedBy: HumanActorReference;
  approvedAt: string;
};
```

Add `FrameApproval` as a first-class approval subject rather than overloading the current generic editorial approval. The editor exposes a human-only “Approve this framing” action after rendering the exact crop. The Content API recomputes the subject hash, creates the immutable approval record, and attaches its ID atomically. It requires a dedicated human capability such as `content:approve-framing`; that capability is never minted to the textbook MCP or an agent.

Any change to the target, media version, frame, alt text, caption, teaching use, or framing-policy version detaches the approval. Protected preview, live save, and release independently resolve the approval and compare the full subject hash. Agent-facing `set_card_frame` never accepts a `framingApprovalId`; an agent can propose or clear framing but cannot manufacture, select, or attach an approval.

### 5.3 Layout regions

Store relationships among contiguous flow nodes in a top-level `layoutRegions` collection. A region controls presentation only; canonical body order remains authoritative. It identifies a body span by its first and last stable references rather than copying a second ordered member list.

```ts
type FlowSpan = {
  from: LayoutNodeRef;
  through: LayoutNodeRef;
};

type LayoutRegion =
  | {
      layoutRegionId: `layout_${string}`;
      kind: "wrap";
      span: FlowSpan;
      card: LayoutNodeRef;
      side: "start" | "end";
      width: "reading" | "wide" | "full";
      spacing: "tight" | "normal" | "relaxed";
      collapse: "stack";
    }
  | {
      layoutRegionId: `layout_${string}`;
      kind: "card-text-split";
      span: FlowSpan;
      card: LayoutNodeRef;
      side: "start" | "end";
      proportion: "card-narrow" | "balanced" | "card-wide";
      width: "reading" | "wide" | "full" | "bleed";
      spacing: "tight" | "normal" | "relaxed";
      verticalAlign: "start" | "center" | "stretch";
      collapse: "stack";
    }
  | {
      layoutRegionId: `layout_${string}`;
      kind: "card-grid";
      span: FlowSpan;
      columns: 2 | 3 | 4;
      template: "equal" | "start-wide" | "center-wide" | "end-wide";
      width: "reading" | "wide" | "full" | "bleed";
      spacing: "tight" | "normal" | "relaxed";
      verticalAlign: "start" | "center" | "stretch";
      collapse: "reflow" | "stack";
    };

type ChapterLayoutFields = {
  layoutCatalogVersion: string;
  layoutRegions: LayoutRegion[];
};
```

Region sizing has two levels. `width` sizes the whole arrangement on the reader surface. `proportion` or `template` sizes members within that arrangement:

| Token | Intended emphasis |
|---|---|
| `card-narrow` | Card supports prose; approximately a 2:3 relationship |
| `balanced` | Card and prose are co-equal |
| `card-wide` | Card is primary evidence; approximately a 3:2 relationship |
| `equal` | Peer cards receive equal tracks |
| `start-wide` / `center-wide` / `end-wide` | Named card receives a strong featured track; companions remain equal |

These are semantic relationships, not author-controlled CSS ratios. The renderer owns exact min/max behavior and may reduce emphasis to preserve legibility at narrower containers.

Validation rules:

- every span boundary and card reference resolves exactly once in chapter flow;
- each region resolves to one nonempty contiguous body slice;
- each flow node belongs to at most one region;
- regions cannot nest or overlap;
- no region may contain a checkpoint reference, heading, table, code block, or `legacyMarkup` node;
- `wrap` contains exactly one card followed by one to eight eligible prose blocks; the card is first in source order for both `start` and `end`, because a true CSS float can wrap only following content;
- wrap cards use `compact`, `narrow`, or `medium` presentation and may not be interactive players, audio, video, documents, or expanded-density cards;
- `card-text-split` contains exactly one card plus one to eight eligible prose blocks; the card is first for `start` and last for `end`;
- `card-grid` contains two to six card-capable nodes in source row-major order and no prose;
- four columns require `wide`, `full`, or `bleed`; three columns require at least `wide` when any member uses standard or expanded density;
- `center-wide` requires exactly three cards in one row;
- `start-wide` and `end-wide` require a single row of two or three cards;
- multi-row grids use `equal` only;
- `columns` never exceeds card count; four columns requires exactly four cards, while five- and six-card collections use two or three columns;
- source order determines mobile order and assistive-technology order;
- removing a region returns all members to ordinary block flow without deleting or moving them.
- moving or removing a region member through an ordinary operation fails with `LAYOUT_DEPENDENCY_CONFLICT`; an explicit `layoutRegion.reconcile` final-state plan is required to move and preserve/replace the arrangement atomically. The server never silently widens, shrinks, or dissolves a region.

Effective layout resolution is deterministic:

- outside a region, a card's own `width`, `align`, `density`, and `mediaFrame` all apply;
- inside `wrap`, the card's width/density/frame apply, while region `side` controls the logical float side and region `width` controls the surrounding surface;
- inside `card-text-split` or `card-grid`, the region controls track width and card alignment, while each card keeps its density and frame;
- individual width/alignment values remain stored while grouped so removing the region restores the prior standalone presentation;
- the API and MCP return both stored and effective presentation whenever a card belongs to a region.

### 5.4 Card density

Density is a semantic renderer contract, not a request to truncate arbitrary prose.

| Density | Expected rendering |
|---|---|
| `compact` | Essential identity, title, short label, image/poster when useful, source link |
| `standard` | Normal card content, caption, teaching context, and credit |
| `expanded` | Full approved contextual record and optional details |

Every card renderer must explicitly implement its supported densities. If a card kind lacks a reviewed compact or expanded renderer, the API returns an unsupported-combination error rather than silently hiding content.

Required content—alt text equivalents, essential captions, source identity, rights credit, transcript access, and fallback links—may never disappear solely because density is compact.

### 5.5 Layout catalog and recipes

Publish a versioned, machine-readable layout catalog derived from the shared contract. The catalog contains:

- semantic primitives;
- named recipes;
- card-kind capability matrix;
- valid and invalid combinations;
- default presentation by card kind;
- renderer version compatibility;
- concise agent guidance and example intentions;
- mobile, print, offline, and no-JavaScript projection behavior.

Initial recipes:

| Recipe | Normalized result | Use when |
|---|---|---|
| `default-reading-card` | block, reading, center, standard | No special relationship justifies another layout |
| `compact-aside-start` | start-side wrap, compact card, compact density | Brief supplemental identity beside one bounded prose span |
| `compact-aside-end` | end-side wrap, compact card, compact density | Brief supplemental evidence beside one bounded prose span |
| `narrow-aside-start` | start-side wrap, narrow card, standard density | Small but substantive supporting card |
| `narrow-aside-end` | end-side wrap, narrow card, standard density | Small but substantive supporting card |
| `medium-aside-start` | start-side wrap, medium card, standard density | Large supporting visual with short adjacent prose |
| `medium-aside-end` | end-side wrap, medium card, standard density | Large supporting visual with short adjacent prose |
| `centered-compact` | block, compact, center, compact | Small standalone card without text wrap |
| `centered-narrow` | block, narrow, center, standard | Focused supporting card |
| `reading-evidence` | block, reading, center, standard | Legible document, diagram, or primary evidence |
| `wide-evidence` | block, wide, center, expanded | Detailed visual or primary source requiring space |
| `full-surface-feature` | block, full, center, expanded | Major visual/interactive feature |
| `safe-bleed-feature` | block, bleed, center, expanded | Exceptional visual that benefits from breakout |
| `pair-equal` | two-column equal card grid | Direct comparison between peers |
| `pair-feature-start` | two-column start-wide card grid | First card is primary; second supports it |
| `pair-feature-end` | two-column end-wide card grid | Second card is primary |
| `trio-equal` | three-column equal card grid | Three comparable, compact items |
| `trio-feature-start` | three-column start-wide card grid | One primary card plus two supports |
| `trio-feature-center` | three-column center-wide card grid | Center item is primary |
| `trio-feature-end` | three-column end-wide card grid | Final item is primary |
| `quartet-equal` | four-column equal grid on wide/full surface | Four brief, parallel cards |
| `collection-two-column` | two-column responsive equal grid | Four to six peer cards that may occupy multiple rows |
| `collection-three-column` | three-column responsive equal grid | Four to six brief peer cards on a wide/full surface |
| `card-text-narrow-start` | start-side card-text split, card-narrow | Small card left of sustained prose |
| `card-text-narrow-end` | end-side card-text split, card-narrow | Small card right of sustained prose |
| `card-text-balanced-start` | start-side balanced split | Card and prose are co-equal; card appears first |
| `card-text-balanced-end` | end-side balanced split | Card and prose are co-equal; card appears last |
| `card-text-wide-start` | start-side card-text split, card-wide | Visual evidence is primary; prose supports it |
| `card-text-wide-end` | end-side card-text split, card-wide | Visual evidence is primary and appears last in source order |

The Content API expands a recipe into normalized primitive fields before validation. Canonical data stores the normalized result and catalog version, not an opaque style name. The audit entry retains the requested recipe for provenance.

Adding a recipe that compiles entirely to existing primitives does not require a content-schema change. It still requires reviewed catalog/renderer compatibility and normal code release controls.

## 6. Combination rules

### 6.1 Allowed wrap combinations

- Wrap regions support `compact`, `narrow`, and `medium` card widths only.
- Wrapped cards support compact or standard density; expanded density is rejected.
- The region's explicit `from`/`through` span is the entire wrap scope. No heading, passage anchor, or DOM adjacency may be used to infer it.
- Wrap is rejected around tables, code blocks, headings, checkpoint references, legacy markup, or another layout region.
- Interactive audio/video/embed activation cards and document cards do not wrap in P0.
- The renderer creates one server-rendered bounded scope so visual wrapping never leaks into an unrelated section.
- At narrow container widths, 200% zoom/reflow, print, and offline narrow rendering, wrap regions become normal blocks in source order.

### 6.2 Allowed group combinations

- Two cards may use any region width.
- Three cards require at least `reading`; standard or expanded cards require `wide` or greater.
- Four columns require `wide`, `full`, or `bleed` and compact density.
- Five- and six-card collections use two or three equal columns and reflow by row; they may not use a featured template.
- Text-bearing artifacts and diagrams must remain individually legible at the chosen column width.
- A group may contain mixed card kinds when their teaching relationship is explicit.
- A group must not be used merely to save vertical space.

### 6.3 Layout warnings versus hard failures

Hard failures protect structure, accessibility, and deterministic rendering. Warnings identify questionable but potentially intentional choices.

Examples of hard failures:

- wrap plus a card wider than medium;
- crop on an unsupported or evidence-bearing card kind;
- focal point without crop;
- noncontiguous group members;
- nested or overlapping regions;
- four columns at reading width;
- hidden required credit or transcript access;
- visual order that differs from source order;
- unknown recipe, primitive, class, CSS, or measurement.

Examples of warnings:

- two consecutive wide or bleed regions;
- a medium wrapped card beside a very short paragraph;
- three dense cards with long captions;
- repeated start-side wraps that create a lopsided page;
- compact density for a card whose teaching use calls for close reading;
- crop framing where contain would preserve more evidence.

Warnings appear in the editor, semantic diff, preview result, and MCP response. Agents must report unresolved warnings before live save.

An otherwise valid portrait/decorative crop without a matching approval is allowed as a draft proposal and reported as `FRAME_APPROVAL_REQUIRED`, but live save and release fail until a human attaches a matching approval. Evidence-bearing crop is invalid even in draft; approval cannot override that prohibition.

## 7. Agent decision standard

The agent-facing Skills and MCP descriptions must teach a repeatable choice process.

### 7.1 Required decision sequence

Before changing layout, an agent must:

1. Read the complete authoring view and identify the stable card and nearby flow-node IDs.
2. Read the live layout catalog or valid-options response instead of relying on a remembered enum.
3. Identify the intellectual relationship among the card, prose, and any companion cards.
4. Preserve or deliberately change canonical reading order through separate flow operations.
5. Choose the least elaborate arrangement that makes the relationship clearer.
6. Choose density based on required teaching content, not available space.
7. Choose framing based on the informational character of the image.
8. Apply layout without changing prose, rights, or media identity unless those changes were separately requested.
9. Validate the proposal, then inspect the required protected wide, narrow/mobile, print, offline, and no-JavaScript preview artifacts.
10. Check overflow, reading order, crop, captions, credits, and interaction fallbacks.
11. Summarize the semantic layout change and any warnings.
12. Save live only after explicit user save/publish language and the existing capability checks.

### 7.2 Arrangement-selection guide

| Teaching relationship | Preferred arrangement | Avoid |
|---|---|---|
| Brief optional context beside one claim | compact/narrow wrap at start or end | Wide card interrupting the argument |
| Primary evidence that students must inspect | reading or wide block, contain framing | Small wrap or crop |
| Two peer positions, sources, or examples | equal pair | Featured layout implying hierarchy |
| One primary item plus one support | featured pair | Equal pair that obscures hierarchy |
| Three or four parallel, brief items | equal trio/quartet | Expanded cards or long prose in each column |
| Five or six brief peer items | equal two-/three-column collection | Featured template or mixed hierarchy |
| Thinker/source supporting a sustained prose unit | card-text split | Wrap whose relationship would remain ambiguous |
| Portrait used for identity/context | narrow/medium card; crop only with focal point and approval | Cropping face, hair, inscription, or credit |
| Manuscript, screenshot, diagram, or text-bearing image | reading/wide; contain or intrinsic | Crop or compact multi-column card |
| Audio, video, document, or external embed | block or split with complete fallback | Wrap in P0 |
| No clear relationship beyond nearby placement | default reading card | Decorative grouping |

### 7.3 Tie-breaking rules

When several arrangements are valid, agents choose in this order:

1. explicit instructor request;
2. legibility of required evidence;
3. logical reading order;
4. accessibility and fallback completeness;
5. smallest adequate layout complexity;
6. visual balance and variety.

Visual variety is a legitimate secondary goal, but it never overrides meaning, legibility, source order, or accessibility.

Agents must distinguish wrap from split: a wrap is for a short ancillary card that reads before the prose and allows prose to flow beside and below it; a split is for a deliberate two-column relationship and can place the card either before or after prose in canonical/mobile order. “On the right” alone does not decide between them.

### 7.4 Examples agents must understand

| Instructor request | Expected operation |
|---|---|
| “Put Aristotle in a small card to the right of this paragraph.” | For true wrap, place Aristotle immediately before the bounded prose in source order, then apply `narrow-aside-end`; if prose must read first on mobile, use an end-side split instead |
| “Make the manuscript and Aristotle the same size, side by side.” | Make nodes contiguous, create `pair-equal`, use evidence-safe framing |
| “Make the manuscript larger than Aristotle.” | Create `pair-feature-start` or `pair-feature-end` according to source order |
| “Put these three source cards together.” | Create `trio-equal` if all are peers and compact enough |
| “Put the thinker on the left and the explanation on the right.” | Create the appropriate `card-text-*-start` split over one card and a bounded prose range; choose narrow, balanced, or wide according to emphasis |
| “Make this image bigger.” | Inspect current width and teaching use; choose the next semantic width, not an arbitrary measurement |
| “Show the complete manuscript.” | Use contain/intrinsic at reading or wide width; do not crop |
| “Focus the portrait on Aristotle’s face.” | Propose crop plus a precise focal point; obtain the required human framing approval; preview mobile and print |
| “Undo the special layout.” | Remove the layout region or reset the card presentation; do not move or delete content |

## 8. Content API operations

Add revision-bound, idempotent semantic operations:

```text
cardPresentation.set
cardPresentation.reset
cardFrame.set
cardFrame.reset
cardFrame.approve
layoutRegion.create
layoutRegion.update
layoutRegion.remove
layoutRegion.reconcile
```

Responsibilities:

### `cardPresentation.set`

- targets one layout-capable `blockId` or `placementId`;
- accepts a card-scoped recipe or explicit typed primitives, never both unless the API supports documented safe overrides; region-scoped recipes are rejected here;
- normalizes through the current catalog;
- validates the card-kind capability matrix;
- does not move the target;
- reports approval invalidation caused by density changes.

### `cardPresentation.reset`

- restores the card kind's catalog default;
- does not remove or move the card;
- is reversible through revision history.

### `cardFrame.set` and `cardFrame.reset`

- change only the placement-specific image/poster framing record;
- validate media kind, aspect, focal-point bounds, evidence-bearing crop prohibitions, and approval requirements;
- never modify the source asset or its global derivatives;
- report exactly which visual, rights, or editorial approvals are invalidated;
- keep framing separate from ordinary size/alignment changes because its review consequences are materially different.

### `cardFrame.approve`

- is a human-session-only operation and is not exposed by the textbook MCP;
- renders and hashes the exact current frame subject server-side;
- creates an immutable approval and attaches it to the same draft atomically;
- rejects agent/service actors and any stale preview, media version, frame, alt, caption, teaching-use, or policy hash.

### `layoutRegion.create`

- accepts an explicit existing `from`/`through` flow span and the card reference when applicable;
- accepts a region-scoped recipe or explicit typed region primitives and records the requested recipe in the audit event;
- accepts no caller-selected ID on create; the server generates and returns the stable `layoutRegionId`;
- does not reorder them;
- validates resolved span structure and compatible card/prose types;
- rejects membership conflicts and nested/overlapping regions.

### `layoutRegion.update`

- updates region width, side, proportion/template, column count, spacing, vertical alignment, collapse policy, or span;
- may change the span only when the result remains contiguous and structurally valid;
- never silently moves members.

### `layoutRegion.remove`

- removes only the presentation relationship;
- leaves every member in its existing source position;
- is destructive only with respect to the layout record, not content.

### `layoutRegion.reconcile`

- accepts explicit flow moves plus one region create/update/remove action when the intended final arrangement cannot be reached through individually valid intermediate states;
- clones the current flow/region graph, applies the complete plan in memory, validates only the final graph, and commits one revision in one transaction;
- never infers moves from desired visual layout; every moved node and destination is present in the request and semantic diff;
- lets the server generate and return `layoutRegionId` on create; update/remove always target that stable ID;
- is the only supported path for atomically moving an existing region member while preserving or replacing its arrangement.

All operations participate in existing changesets, optimistic concurrency, semantic diff, validation, protected preview, immutable revision history, live-save authorization, idempotency, and audit attribution.

Any ordinary flow move/removal operation that touches a layout-region member fails with `LAYOUT_DEPENDENCY_CONFLICT`. Use `layoutRegion.reconcile` when an explicit move and region change must be atomic; do not rely on sequential operations whose intermediate state is invalid. Extend schema-v3/v4 `place_media` and `upsert_embed` MCP inputs to expose the Content API's required `FlowPosition`; otherwise agents cannot create those cards at an exact canonical position before arranging them.

### 8.1 Stable error codes

Add at least:

```text
LAYOUT_TARGET_NOT_FOUND
LAYOUT_TARGET_NOT_CARD
SCHEMA_V4_REQUIRED
LAYOUT_RECIPE_UNKNOWN
LAYOUT_CATALOG_VERSION_CONFLICT
LAYOUT_COMBINATION_UNSUPPORTED
LAYOUT_CAPABILITY_UNSUPPORTED
LAYOUT_SPAN_INVALID
LAYOUT_REGION_MEMBER_MISSING
LAYOUT_REGION_MEMBER_DUPLICATE
LAYOUT_REGION_NONCONTIGUOUS
LAYOUT_REGION_OVERLAP
LAYOUT_REGION_NESTING_FORBIDDEN
LAYOUT_REGION_STRUCTURE_INVALID
LAYOUT_CARD_COUNT_INVALID
LAYOUT_MEMBER_TYPE_INVALID
LAYOUT_REGION_WIDTH_INVALID
LAYOUT_SOURCE_ORDER_INVALID
LAYOUT_DEPENDENCY_CONFLICT
LAYOUT_FRAMING_UNSUPPORTED
LAYOUT_FOCAL_POINT_INVALID
FRAME_APPROVAL_REQUIRED
FRAME_APPROVAL_INVALID
```

Error details contain stable IDs and contract paths but no chapter prose.

## 9. MCP surface

### 9.1 Read-only tools

```text
get_layout_catalog
get_card_layout
get_valid_layout_options
validate_layout_proposal
```

`get_layout_catalog` returns the current catalog version, recipes, primitives, decision summaries, and renderer compatibility.

`get_card_layout` returns one card's normalized layout, group membership, supported capabilities, approval state, and nearby flow IDs.

`get_valid_layout_options` accepts a chapter and one or more node IDs and returns the active chapter authority, schema version, catalog version, and only currently valid recipes/combinations and warnings. This is the preferred agent tool before mutation.

`validate_layout_proposal` is a read-only dry run. It requires the catalog version returned during inspection, resolves the proposed span, and returns normalized data, effective wide/narrow/print behavior, approval invalidations, warnings, and stable errors without creating a revision.

### 9.2 Mutation tools

```text
set_card_layout
reset_card_layout
set_card_frame
clear_card_frame
create_card_wrap
create_card_group
create_card_text_split
update_layout_region
remove_layout_region
reconcile_layout_region
```

Keep tools narrow even if several map to the same Content API operation family:

- `set_card_layout` changes one card only;
- `set_card_frame` and `clear_card_frame` change placement-specific framing only and surface the separate crop-approval gate;
- no MCP framing tool accepts or attaches a framing approval;
- `create_card_wrap` requires one card and an explicit bounded prose span;
- `create_card_group` accepts only card-capable members;
- `create_card_text_split` accepts one card plus a bounded prose range;
- ordinary standalone movement remains in `move_block` and `move_managed_placement`; reconciliation reuses those typed move shapes inside one atomic final-state plan;
- `reconcile_layout_region` is used only when the agent explicitly proposes flow moves and a final region change that must validate atomically;
- layout removal does not imply content removal;
- no tool accepts raw CSS, HTML, class names, breakpoints, or measurements.

All region-creation tools first call the same proposal validator server-side. The narrow tool names guide agents, while the shared validator and Content API operation family prevent divergent behavior.

Every mutation uses the existing revision-bound write envelope:

```text
changeSetId
documentId
baseRevisionId
expectedVersion
expectedLayoutCatalogVersion
idempotencyKey
operation
```

`expectedLayoutCatalogVersion` is required on every layout proposal and mutation. The server rejects drift before recipe normalization with `LAYOUT_CATALOG_VERSION_CONFLICT`; it never silently compiles a remembered recipe against a newer catalog.

Safety annotations:

- catalog and inspection tools: read-only, idempotent, closed-world;
- set/create/update tools: mutating, reversible, idempotent, closed-world;
- reset/remove tools: mutating, destructive with respect to presentation metadata, reversible through history;
- live save remains a separate destructive/open-world operation.

### 9.3 MCP descriptions and examples

Tool descriptions must state:

- what the tool changes;
- what it deliberately does not change;
- prerequisites such as contiguity;
- when to use a bounded wrap, group, or split;
- which preview surfaces are required;
- that source order remains authoritative;
- that CSS and measurements are prohibited.

The MCP package version declares compatible Content API, content-contract, renderer, and layout-catalog versions and fails startup on incompatible versions.

### 9.4 Preview contract for agents

Extend `preview_changes` with MCP-accessible, hash-bound artifacts for `webWide`, `webNarrow`, `mobile`, `print`, `offline`, and `noJs`. A layout proposal may return an effective collapse plan, but that plan does not substitute for the required rendered artifacts before live save. The preview response identifies the revision, renderer, stylesheet, catalog, viewport/output surface, and content hash for every artifact.

Routine layout mutations require those six protected surfaces. A crop proposal additionally requires visual inspection of the wide and mobile artifacts before a human can approve it. Browser zoom at 200%/400%, 320-pixel reflow, keyboard, and screen-reader checks remain mandatory for new primitives/recipes, the Chapter 7 canary, and release QA; they are not falsely claimed as current per-mutation API surfaces.

## 10. Agent Skills

Update `ai-ethics-author-textbook-chapter`, `ai-ethics-publish-textbook-media`, and the layout-relevant checks in `ai-ethics-release-steward`; add a dedicated reference file such as `references/card-layout-rules.md` shared by their validation tests.

The rules file must include:

- the required decision sequence from this plan;
- the arrangement-selection matrix;
- card-kind capability table;
- crop/framing rules;
- examples and anti-examples;
- required tool order;
- preview and save gates;
- stable failure handling;
- instructions to report unresolved warnings;
- catalog/version drift behavior.

Do not duplicate the complete catalog manually in every Skill. Skills instruct agents to read the live catalog and pin the compatible version. Bundle tests fail if documented tool names or catalog versions drift from the MCP package.

## 11. Browser editor experience

### 11.1 Single-card inspector

Add a Layout section to the contextual inspector containing:

- named recipe picker with plain-language preview;
- size control;
- block/left-wrap/right-wrap placement control;
- block alignment control;
- density control;
- start/end flow-node pickers that make the wrap or split span explicit;
- narrow/balanced/wide card proportion control for splits;
- image fit and aspect controls;
- focal-point picker over the actual image when crop is selected;
- “Reset to recommended layout” action;
- warnings and approval-impact summary.

Disable invalid controls based on the live capability response. Do not let the browser maintain a separate hand-coded capability matrix.

### 11.2 Group creation

Support multi-selection of contiguous layout-capable nodes. The Arrange action offers:

- Equal pair;
- Feature first / feature last;
- Equal trio;
- Feature start / center / end trio;
- Equal quartet when the surface permits;
- Two-/three-column collection for four to six peer cards;
- Card left of text: narrow, balanced, or wide;
- Card right of text: narrow, balanced, or wide;
- Remove arrangement.

If selected nodes are not contiguous, the editor explains that grouping does not move content and offers a separate explicit move workflow.

After creation, a region inspector exposes whole-arrangement width, template or card/prose proportion, column count, spacing, vertical alignment, and the supported collapse policy. Thus “make the pair smaller” changes the region surface, while “make Aristotle smaller than the manuscript” changes the pair template; the editor does not pretend an individual grid member has an independent track width.

### 11.3 Preview

The editor preview must show:

- wide desktop;
- standard desktop/laptop;
- tablet/narrow container;
- 390-pixel mobile;
- 200% zoom/reflow;
- print;
- offline/no-JavaScript.

Preview uses the same frozen renderer package as production. It must not reimplement layouts with editor-only CSS.

## 12. Renderer implementation

The current public reader, protected preview, and release materializer do not yet prove projection-equivalent rendering, and the site Worker must be audited to confirm that the chapter renderer's hashed stylesheet is actually delivered. Converge these surfaces before exposing layout controls. Reader, editor preview, protected preview, live projection, offline output, and release fallback must consume the same renderer semantics and versioned stylesheet.

### 12.1 Server-rendered structure

Render semantic wrappers such as:

```html
<aside
  class="chapter-card"
  data-card-width="narrow"
  data-card-align="end"
  data-card-density="standard"
>
  ...
</aside>
```

```html
<section
  class="chapter-layout-region"
  data-layout-kind="card-grid"
  data-layout-template="equal"
  data-layout-columns="2"
  data-layout-width="wide"
>
  <div class="chapter-layout-item">...</div>
  <div class="chapter-layout-item">...</div>
</section>
```

Data attributes are renderer output, not author-provided class names.

### 12.2 CSS strategy

- Use CSS logical properties for start/end placement.
- Prefer container queries for reader-surface responsiveness; provide media-query fallback if required by the browser support contract.
- Bound every wrap in one server-rendered scope wrapper derived from the explicit flow span.
- Use grid for card groups and card-text splits.
- Collapse layouts in canonical source order.
- Reading JSON, plain text, voice output, and assistive-technology order ignore visual regions and continue to follow canonical `body` order.
- Prevent horizontal overflow at every supported zoom and viewport.
- Avoid fixed heights for textual cards.
- Permit equal-height stretch only when it does not clip content.
- Keep focus outlines, details controls, links, and media activation reachable.
- P0 print output unconditionally stacks wrap, split, and grid regions in canonical source order; do not force `break-inside: avoid` on a region taller than one page.
- Offline HTML includes identical semantic wrappers and first-party styles.

### 12.3 Density renderers

Implement explicit compact/standard/expanded renderers per card kind. Do not hide arbitrary DOM descendants with generic selectors. Unit tests assert the required accessible and rights content for every density.

### 12.4 Framing renderers

- `intrinsic`: intrinsic dimensions, no forced frame;
- `contain`: entire image visible inside selected aspect frame;
- `crop`: cropped visual frame with validated focal point and approval;
- print uses the same normalized frame as other surfaces; there is no P0 print-only override, and the framing approval is valid only after the print artifact is included in its review set;
- offline output uses the same local derivative and framing metadata.

### 12.5 Versioning

Bump the chapter renderer style/version identifier and include:

- renderer version;
- layout-catalog version;
- normalized layout records;
- layout-dependent asset/framing hashes;

in projection identity, protected previews, build attestations, release manifests, and live-delivery verification.

## 13. Migration and compatibility

### 13.1 Existing display presets

The compatibility adapter maps existing values without visual change:

| Existing preset | Normalized presentation |
|---|---|
| `compact` | compact, center, compact |
| `narrow` | narrow, center, standard |
| `reading` | reading, center, standard |
| `wide` | wide, center, standard |
| `bleed` | bleed, center, expanded |
| `thinker-card` | renderer component remains person/thinker; presentation becomes reading, center, standard |

Existing `align` values map to logical block alignment. V4 body cards receive `presentation` directly; person features receive it on their `ManagedPlacement`, and the duplicated projection preset is retired. Migration must preserve normalized DOM and screenshots before any chapter receives a new layout choice.

### 13.2 Typed legacy-card migration

Occurrence-level layout lives inside immutable chapter revision JSON. Do not add a normalized D1 layout table merely to store presentation. The deterministic v3-to-v4 migration creates new draft heads and preserves prior v2/v3 revision history; any D1 migration is limited to independently justified runtime/catalog or approval metadata.

For each legacy card:

1. inventory current source, stable passage relationship, card kind, media identity, rights, caption, alt text, teaching use, and visual behavior;
2. create or bind the typed immutable media/entity/source record;
3. create a stable body card or managed placement plus explicit flow reference;
4. apply the compatibility presentation matching current output;
5. compare web, mobile, print, offline, and no-JavaScript output;
6. cut over the chapter only after parity passes;
7. remove the code-owned insertion path only when no chapter uses it.

### 13.3 Chapter 7 canary

Use the existing manuscript and Aristotle cards to prove:

- the manuscript is a typed D1 artifact/media card;
- Aristotle remains a typed person feature;
- both appear as explicit v4 body nodes under the inherited ordered-flow model;
- MCP can create and remove an equal pair;
- MCP can feature either member;
- MCP can wrap Aristotle beside an explicit bounded prose span;
- Aristotle's portrait focal point is explicit occurrence metadata rather than the current shared hard-coded `object-position`, and the approved crop preserves the face and hair at wide/mobile/print surfaces;
- MCP can restore the default reading-card layout;
- no layout operation changes prose, media identity, rights, or source order;
- public delivery identity changes exactly when expected;
- revision restore returns the previous layout.

### 13.4 Feature flags and rollback

Add a chapter-scoped `card_layouts_v1` authoring/runtime flag. The public reader consumes only a frozen projection produced by a compatible renderer. Rollback uses the existing immutable revision and protected release path; it never edits D1 in place.

Unknown layout schema, catalog version, or renderer compatibility fails closed during validation/build rather than falling back to an unpredictable layout.

## 14. Testing strategy

### 14.1 Contract tests

- parse every primitive and initial recipe;
- reject unknown fields and raw styling;
- exhaustively test valid width/layout-kind/density combinations;
- test region spans, card counts, member types, contiguity, uniqueness, overlap, and nesting;
- test focal-point bounds and frame-mode dependencies;
- prove one presentation authority per rendered occurrence and reject a duplicate person-projection preset in the new schema;
- prove v2/v3 historical adapters and deterministic v3-to-v4 migration output;
- prove layout fields participate in deterministic hashes.

Use table-driven and property-based tests where appropriate so the combination matrix does not depend on a few hand-picked examples.

### 14.2 Content API tests

- success and idempotent replay for every operation;
- stale revision and version conflicts;
- stale `expectedLayoutCatalogVersion` conflicts before normalization and creates no revision;
- structured stable errors;
- operations never move or delete content implicitly;
- ordinary flow moves/removals touching a region fail with `LAYOUT_DEPENDENCY_CONFLICT`;
- `layoutRegion.reconcile` validates the complete final graph and commits explicit move-plus-arrange plans atomically, while equivalent sequential operations are rejected;
- semantic diff output;
- approval invalidation for framing/density changes;
- human-only frame approval subject hashing, immutable storage, stale-preview rejection, agent denial, and release-time resolution;
- preview and live-save projection identity;
- restore-as-draft behavior;
- feature-flag enforcement;
- schema-v3/v4 media/embed creation requires and honors exact `FlowPosition`.

### 14.3 MCP tests

- schema parity with the Content API;
- capability allowlists and annotations;
- unknown recipes and unsafe combinations rejected before mutation;
- proposal validation returns resolved spans and effective wide/narrow/print behavior without creating a revision;
- tool descriptions include decision and preview requirements;
- catalog/version mismatch fails startup;
- inspection-to-write catalog drift fails with `LAYOUT_CATALOG_VERSION_CONFLICT`;
- example natural-language instructions select the expected tools and recipes;
- no tool accepts CSS, HTML, measurements, or breakpoints.

### 14.4 Renderer tests

- normalized DOM fixtures for each card kind, standalone width/alignment/density, wrap side, split proportion, and grid template;
- named reading/wide/full/bleed lane boundaries remain distinct and never invade reader rails or viewport edges;
- bounded wraps do not leak across their explicit spans;
- group members render once and in source order;
- required caption, credit, alt equivalent, transcript/fallback access, and links survive every density;
- intrinsic/contain/crop/focal-point rendering and crop approval enforcement;
- no JavaScript required;
- print and offline parity;
- legacy projection parity;
- public reader, protected preview, editor preview, live projection, and release fallback use the same renderer/style identity.

### 14.5 Browser and visual matrix

Test representative and worst-case fixtures at:

- 1536 × 1024 desktop;
- 1280 × 800 laptop;
- 1024-pixel narrow desktop/tablet landscape;
- 768-pixel tablet;
- 390 × 844 mobile;
- 320-pixel reflow minimum where supported;
- 200% and 400% zoom/reflow;
- print/PDF;
- JavaScript disabled;
- offline self-contained HTML.

Assertions include:

- no horizontal overflow;
- no clipped card text or controls;
- source/mobile order matches canonical flow;
- focus order matches DOM order;
- wrap scopes terminate exactly at their declared flow boundaries;
- cards do not overlap headings, checkpoints, tables, or reader chrome;
- text-bearing images remain legible;
- credits and fallback links remain visible;
- print does not split critical card units unexpectedly.

Run automated accessibility checks and manual keyboard/screen-reader-order inspection for the canary layouts.

### 14.6 Agent conformance fixtures

Create a fixture corpus of instructor requests and expected decisions. Include direct requests, ambiguous requests, unsafe requests, and correction requests.

Examples:

- “Put this on the right.” → inspect context; do not guess card identity or scope.
- “Make it smaller.” → inspect current size and choose the next semantic width.
- “Put four detailed cards side by side in the prose column.” → reject and propose wide compact quartet or stacked alternative.
- “Crop this manuscript to fill the card.” → reject crop for text-bearing evidence and propose contain at a larger width.
- “Pair these cards but leave their order alone.” → create a region only if already contiguous.
- “Make this visually first but read second on mobile.” → reject visual/source-order divergence and explain the supported alternative.

## 15. Implementation phases

### Phase 0 — Freeze decisions and evidence

Tasks:

1. Approve an ADR for the layout primitives, region model, source-order rule, schema integration point, and catalog versioning.
2. Record schema v4 as the layout contract and freeze the deterministic v3-to-v4 migration rules.
3. Inventory every current card path and card kind.
4. Capture representative desktop/mobile/print/offline/no-JS baselines.
5. Build a static specimen matrix showing every proposed recipe with real textbook content.
6. Review the recipe catalog for excessive overlap or missing use cases.
7. Audit and close existing contract/API/MCP drift for media/embed insertion and whole-document schema-v3 validation.
8. Prove how renderer CSS reaches the public site and inventory every independent preview/release rendering path.

Exit gate:

- Joel can point to the specimen for every requested arrangement;
- every recipe has a clear teaching use and responsive fallback;
- no unresolved ordering-model conflict remains.

### Phase 1 — Shared contract and layout catalog

Owned surfaces:

- `packages/content-contract/`;
- generated JSON Schema/OpenAPI;
- contract tests;
- compatibility adapters;
- new layout ADR and catalog source.

Tasks:

1. Add shared `CardPresentation`, `MediaFrame`, `FrameApprovalSubject`, `LayoutNodeRef`, `FlowSpan`, and discriminated `LayoutRegion` schemas.
2. Bump the content schema to v4 and the content-contract major version while retaining explicit v2/v3 historical read schemas.
3. Define the closed v4 card union, including new typed artifact, non-image media, and source-card blocks, and add card-kind capability metadata.
4. Add recipe catalog generation and versioning.
5. Add chapter validation invariants.
6. Define stable error codes.
7. Map v2/v3 legacy presets into required v4 presentation without visual change and remove `PersonFeatureProjection.displayPreset` from v4.
8. Regenerate and freeze OpenAPI schemas.
9. Generate operation schemas and validators consumed by the Content API, authoring client, MCP, and editor rather than re-declaring them independently.

Exit gate:

- one source generates contract, OpenAPI, MCP schemas/helpers, editor types, and catalog;
- all compatibility and combination tests pass;
- no client maintains a parallel enum.

### Phase 2 — Renderer and projection identity

Owned surfaces:

- `packages/chapter-renderer/`;
- `workers/site/` and `workers/textbook-preview/`;
- release materializer and projection generators;
- public projection generation;
- reader styles;
- print/offline projections;
- renderer and visual tests.

Tasks:

1. Render every member of the closed v4 card union and its single-card presentation server-side.
2. Implement bounded logical wraps over explicit spans.
3. Implement grid and split regions.
4. Implement explicit density renderers by card kind.
5. Implement framing and focal points.
6. Add container-responsive collapse and print rules.
7. Add named reading/wide/full/bleed reader-shell lanes and remove viewport/negative-margin breakout hacks.
8. Include layout catalog and normalized layout in projection hashes.
9. Prove legacy normalized-DOM parity.
10. Deliver the versioned renderer stylesheet through the public site projection.
11. Replace independent protected-preview/release renderers with the shared renderer or prove byte-for-byte equivalent semantics and stylesheet identity.

Exit gate:

- specimen matrix passes all viewport/output surfaces;
- no-JavaScript and offline layouts are complete;
- no source-order or accessibility regression exists.

### Phase 3 — Content API operations and validation

Owned surfaces:

- `workers/content-api/`;
- `workers/editor-auth/` human-only framing-approval boundary;
- authoring-client package;
- immutable chapter revision JSON; no occurrence-layout side table;
- API and atomic live-save tests.

Tasks:

1. Implement presentation and region operations.
2. Require `expectedLayoutCatalogVersion` and normalize recipes server-side only after the version matches.
3. Validate capabilities, contiguity, combinations, and framing.
4. Add warnings and approval-impact reports.
5. Add semantic diff descriptions.
6. Include layout in preview, commit-live, history, restore, and release snapshots.
7. Add `card_layouts_v1` flags.
8. Make ordinary flow moves/removals fail on layout dependencies and implement final-graph-validated `layoutRegion.reconcile` for explicit atomic move-plus-arrange plans.
9. Close inherited v3 whole-document person-placement validation gaps, then enforce required presentation, region, and catalog-pin invariants in v4 before enabling the flag.
10. Extend the protected preview contract with hash-bound `webWide`, `webNarrow`, `mobile`, `print`, `offline`, and `noJs` artifacts.
11. Implement immutable frame-approval storage, human-only `cardFrame.approve`, exact subject-hash verification, invalidation, and release-time enforcement.

Exit gate:

- API operations are revision-bound, idempotent, and atomic;
- malformed or unsafe layout cannot create a revision or projection;
- layout removal never deletes content.

### Phase 4 — Instructor editor

Owned surfaces:

- `apps/instructor-editor/`;
- editor model/Tiptap integration;
- authoring-client usage;
- editor unit and production-shaped browser tests.

Tasks:

1. Add card selection and contextual layout inspector.
2. Make body media, embeds, diagrams, rich links, and managed person placements all resolvable by the inspector.
3. Store presentation attributes on each outer editor atom/node wrapper so it is the actual grid item.
4. Add capability-driven controls and recipes.
5. Add contiguous multi-selection and Arrange workflow.
6. Add focal-point picker and framing preview.
7. Show warnings and approval impacts.
8. Add multi-surface preview.
9. Apply presentation as incremental Tiptap transactions; do not destroy/recreate the editor and lose selection or undo history.
10. Preserve undo, recovery, selection, and save state through layout changes.
11. Add the human-only framing review action, show the exact wide/mobile/print preview set being approved, and never expose the action in agent-authenticated UI state.

Exit gate:

- instructor can create, revise, remove, undo, recover, preview, and save every initial recipe;
- no editor-only layout semantics exist.

### Phase 5 — MCP tools and Skills

Owned surfaces:

- `workers/textbook-mcp/`;
- `packages/textbook-mcp/`;
- `workers/content-api/src/index.mjs` capability map;
- `workers/editor-auth/src/mcp-oauth.mjs` and agent-capability enforcement;
- `scripts/mcp/` capability request/launcher defaults;
- plugin MCP metadata;
- agent Skills and bundle manifest;
- MCP and Skill conformance tests.

Tasks:

1. Expose catalog, valid-options, and proposal-validation tools.
2. Expose narrow presentation, framing, wrap, group, and split tools.
3. Update and parity-test every authorization registry: MCP `operationScopes`, Content API `SEMANTIC_OPERATION_CAPABILITIES`, editor-auth OAuth `WRITE_OPERATIONS`, capability request/launcher operation lists, runtime schemas, and test fixtures. Keep `cardFrame.approve` and `content:approve-framing` out of all agent grants.
4. Add accurate safety annotations.
5. Add agent decision rules and examples.
6. Add catalog/version compatibility checks.
7. Run MCP Inspector and production-client conformance.
8. Add the required schema-v3/v4 `FlowPosition` to media/embed creation and assert MCP/API schema parity.
9. Return protected preview artifacts through the agent surface and test that live save refuses stale or incomplete required surfaces.

Exit gate:

- an authorized agent can perform every layout user story without raw source editing;
- agent chooses appropriate layouts in the conformance fixture corpus;
- Skills fail closed on catalog drift.

### Phase 6 — Typed-card migration

Owned surfaces:

- content repository/importers;
- media/entity/source/rights records;
- chapter migrations;
- legacy component retirement.

Tasks:

1. Migrate Chapter 7 manuscript and Aristotle records first.
2. Migrate remaining artifacts, scholars, diagrams, and release placements chapter by chapter.
3. Preserve visual parity before applying new layouts.
4. Record authority/cutover evidence.
5. Retire legacy insertion code only after zero-use verification.
6. Seed deterministic v4 draft heads rather than rewriting or normalizing prior immutable v2/v3 revisions.
7. Disable legacy static injection for each migrated identity so no card can render twice.

Exit gate:

- every layout-capable public card has a stable API/MCP identity;
- no migrated chapter depends on browser DOM relocation for essential placement.

### Phase 7 — Chapter 7 live canary

Tasks:

1. Exercise equal pair, featured pair in both directions, bounded wrap in both directions, all three card-text proportions, size changes, framing proposal/human approval/invalidation, reset, revision restore, and rollback.
2. Verify the exact public revision/projection headers after each authorized save.
3. Verify desktop, mobile, print, offline, no-JS, keyboard, and screen-reader order.
4. Collect usability findings from ordinary editor and agent use.
5. Audit Cloudflare/D1/R2 cost and performance.

Exit gate:

- no GitHub content change is needed for ordinary layout adjustments;
- all receipts and delivery checks pass;
- Joel confirms the available arrangements are understandable and sufficient.

### Phase 8 — Controlled rollout and cleanup

Tasks:

1. Enable additional chapters in small batches.
2. Run all-chapter layout and parity reports.
3. Remove compatibility code only after rollback window and zero-use evidence.
4. Update authoring, content-model, deployment, rights, and public-boundary documentation.
5. Record final production release evidence.

Exit gate:

- all 18 chapters validate/build/render;
- all current card paths are typed or explicitly code-owned and pinned;
- no undocumented layout mechanism remains.

## 16. Parallel work lanes after contract freeze

After Phase 1 freezes the contract, work may proceed in parallel:

- **Lane A — Renderer:** card primitives, regions, density, framing, output surfaces.
- **Lane B — API:** normalization, operations, validation, diff, preview/live-save integration.
- **Lane C — Editor:** inspector, arrangement workflow, focal point, preview, recovery.
- **Lane D — MCP/Skills:** tool schemas, descriptions, catalog tools, conformance fixtures.
- **Lane E — Migration:** inventory, typed records, rights/identity preservation, parity fixtures.
- **Lane F — QA:** accessibility, visual matrix, print/offline/no-JS, release and rollback evidence.

No lane may invent its own enums, measurements, breakpoints, or compatibility rules.

## 17. Required documentation updates

Update or add:

- layout ADR;
- `docs/CONTENT_MODEL.md`;
- `docs/AUTHORING.md`;
- `docs/RIGHTS_AND_LICENSING.md` for framing/crop approval impact;
- `docs/PUBLIC_BOUNDARY.md`;
- `docs/DEPLOYMENT.md` and release checklist;
- editor design-system documentation;
- MCP OpenAPI/tool reference;
- Skill layout rules;
- a visual layout catalog with real chapter examples.

The visual catalog should be available in the instructor editor and as a bounded MCP resource so instructors and agents use the same vocabulary.

## 18. Release gates

Before production rollout:

- ordered-flow dependency is merged and verified;
- contract, OpenAPI, API, MCP, editor, renderer, and Skills agree on versions and enums;
- all existing layout output retains parity before chapter-specific changes;
- full validation and build pass;
- public-boundary checks pass;
- desktop/mobile/zoom/print/offline/no-JS visual matrix passes;
- accessibility and focus/source-order checks pass;
- no student data behavior changes;
- framing changes have correct rights/editorial approval handling;
- protected preview and live-save delivery identity pass;
- immutable release candidate, canary, production receipt, authority activation, and state audit pass;
- exact rollback version and prior active release are recorded.

## 19. Definition of done

This project is complete when:

1. An instructor can select a card and choose a meaningful range of sizes and placements without source editing.
2. An instructor can arrange two to six cards, including up to four columns on an adequate surface, or arrange a card and bounded prose into reviewed responsive layouts.
3. An authorized agent can make the same changes through typed MCP tools.
4. Agents can retrieve a live layout catalog and valid-options response that explains when each arrangement should be used.
5. Layout edits never accept arbitrary CSS, HTML, measurements, breakpoints, or visual/source-order divergence.
6. Desktop, mobile, zoom, print, offline, and no-JavaScript behavior is deterministic.
7. Required meaning, accessibility equivalents, fallbacks, source identity, and rights credit survive every supported presentation.
8. Existing v2/v3 history and rollback remain readable while all new layout mutations require v4.
9. The Aristotle manuscript/thinker layout can be changed, previewed, saved, restored, and verified entirely through the authoring control plane.
10. Ordinary layout changes no longer require GitHub; only new platform capabilities and renderer/catalog releases do.

## 20. Deliberate non-goals

This plan does not authorize:

- a free-form page builder;
- arbitrary CSS, HTML, JavaScript, or iframe parameters;
- pixel-perfect absolute positioning;
- overlapping cards or text;
- visual order that differs from semantic order;
- custom per-chapter breakpoints;
- nested layout regions in the initial release;
- carousels that hide required reading;
- layout-controlled analytics or student-state persistence;
- agent self-approval of rights, accessibility, or live publication.

These boundaries preserve substantial Pressbooks-like flexibility while keeping the textbook deterministic, accessible, auditable, agent-usable, and safe to publish.
