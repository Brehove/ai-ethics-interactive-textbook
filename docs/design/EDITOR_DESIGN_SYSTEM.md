# AI Ethics Textbook Editor design system

Status: accepted implementation specification  
Concept: `docs/design/agent-native-editor-concept.png`  
Native concept viewport: 1536 x 1024

## Product frame

The editor is an instructor-only production tool, not a student surface and not a generic CMS. The chapter prose remains the visual center. Structured controls expose content semantics without turning the page into a grid of dashboard cards.

## Locked primary-screen copy

- Product: `AI Ethics Textbook`
- Chapter: `7. Aristotle, Character, and the AI-Assisted Life`
- Release state: `Draft`
- Top actions: `Preview`, `Review changes`, `Publish`
- Left navigation: `Chapter`, `Checkpoints`, `Media`, `Sources`, `Rights`, `Releases`
- Checkpoint inspector: `Prompt checkpoint`, `Type`, `Prompt`, `Passage anchor`, `Show in sidebar preview`, `Student response format`, `Accessibility check`, `Editorial approval`, `Save checkpoint`
- Draft action: `Add checkpoint`
- Media actions: `Image or GIF`, `YouTube`, `Vimeo`, `X post`, `Audio/Video`, `PDF`, `Link card`
- Agent rail: `Agent activity`, `Proposed`, `Accepted`, `All activity`, `Accept`, `Reject`

Additional visible copy is allowed only when a real workflow or accessibility requirement needs it.

## Layout

- Quiet top bar, 68 px high.
- Left navigation rail, 220-240 px.
- Central writing canvas with a readable prose measure of roughly 66-72 characters.
- Contextual inspector, 340-420 px.
- Collapsible agent activity drawer along the bottom.
- At widths below 1100 px, the inspector becomes an overlay drawer.
- At widths below 760 px, the left rail collapses to a menu and agent diffs stack vertically.

## Tokens

```css
--editor-canvas: #ffffff;
--editor-chrome: #f7f8fa;
--editor-ink: #111b32;
--editor-muted: #5f6878;
--editor-line: #d8dde5;
--editor-accent: #bd8610;
--editor-accent-strong: #9d6f08;
--editor-selection: #e6eef9;
--editor-success: #18794e;
--editor-danger: #b42318;
--editor-radius-control: 7px;
--editor-focus: 0 0 0 3px rgb(189 134 16 / 28%);
```

- Application chrome uses a disciplined sans-serif system stack.
- Chapter headings and prose use the reader's existing book-serif family.
- Form controls must specify font size, weight, and line-height explicitly.
- Borders are 1 px; shadows are reserved for overlay drawers and menus.
- The background is true white, not cream or warm gray.

## Component families

- `EditorShell`: top bar, navigation rail, main canvas, inspector, activity drawer.
- `ChapterSelector`: book-order aware chapter picker.
- `EditorNav`: six semantic workspaces with selected and focus states.
- `StructuredChapterEditor`: sections, passage IDs, selection, block insertion.
- `CheckpointInspector`: zero or more passage-anchored checkpoints; optional Commit, Work, Reconcile labels plus instructor-defined labels and ordering.
- `MediaInsertMenu`: seven P0 media/embed choices.
- `MediaInspector`: caption, alt text, transcript, rights, crop, poster, fallback.
- `ChangeReview`: semantic before/after diff with explicit accept/reject.
- `AgentActivity`: attributed proposals and immutable audit references; auto-apply is off by default.
- `ReleaseControl`: validation, candidate, approval, deployment receipt, rollback.

## Icon inventory

Use one 1.5 px outline icon family with 20 px default optical size:

- book/product, chapter/document, checkpoint/bookmark, image/media, quotation/source, shield/rights, clipboard-check/release;
- eye/preview, comment-square/review, upload/publish, plus/insert, close, chevrons;
- image, video-provider marks where legally appropriate, volume/audio, file/PDF, link;
- sparkle/agent, info, check, warning, reject.

Provider wordmarks are not required in the first build. Accessible text labels remain visible.

## Interaction rules

- Every mutation belongs to an isolated change set and shows pending/saved/conflict state.
- Selecting prose exposes its stable passage ID and available anchor actions.
- Chapters may contain zero or more checkpoints. Publication validates stable IDs, anchors, ordering, accessibility, and prompt quality; it does not enforce a fixed count or unique stage label.
- Preview shows inline and sidebar checkpoint placement before approval.
- Media URL paste resolves to a typed provider definition or an instructor-authored link card; raw embed HTML is never accepted.
- X loads only its safe fallback until the reader explicitly activates the live post.
- Agent changes are proposals unless an operation and change set were explicitly authorized for automatic application.
- Keyboard focus is always visible; all targets are at least 44 px on touch layouts.

## Fidelity checks

The implementation must match the concept's open layout, true-white canvas, navy/slate typography, restrained ochre accent, serif/sans division, rail proportions, low-shadow treatment, and centrality of chapter prose. It must not become a marketing page, chat-first interface, bento dashboard, or collection of nested cards.
