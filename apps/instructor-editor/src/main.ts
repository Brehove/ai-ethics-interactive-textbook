import { AuthoringApiError, createAuthoringClient, type CommitLiveResult } from "@ai-ethics/authoring-client";
import { DEMO_CHAPTER } from "./demo-chapter";
import {
  addCheckpoint,
  addPersonFeature,
  blockPassage,
  checkpointAnchorBlock,
  checkpointExcerpt,
  chapterFromAuthoringView,
  chapterReplaceOperation,
  cloneChapter,
  moveCheckpoint,
  newId,
  nearestPassage,
  type ChapterDocument,
} from "./editor-model";
import { mountTiptap } from "./tiptap-editor";
import { legacyCuratedArtifacts } from "./generated-legacy-artifacts";
import { CHAPTER_ROUTE_BY_SLUG } from "./chapter-route-manifest";
import "./styles.css";

type SaveState = "clean" | "dirty" | "saving" | "pending" | "saved" | "attention";
type Inspector = { kind: "checkpoint"; id: string } | { kind: "managed"; id: string } | { kind: "chapter" } | null;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Instructor editor mount is missing.");

const params = new URLSearchParams(window.location.search);
const agentAccessRequestId = /^\/agent-access\/?$/.test(window.location.pathname) ? params.get("request") : null;
const reviewChangeSetId = params.get("review");
const requestedSlug = window.location.pathname.match(/^\/chapter\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/)?.[1] ?? params.get("chapter") ?? DEMO_CHAPTER.slug;
const requestedRoute = CHAPTER_ROUTE_BY_SLUG.get(requestedSlug);
const requestedDocument = requestedRoute?.documentId ?? params.get("document") ?? DEMO_CHAPTER.documentId;
const requestedAnchor = (window.location.hash ? window.location.hash.slice(1) : params.get("anchor")) ?? "";
const configuredApiOrigin = import.meta.env.VITE_CONTENT_API_ORIGIN as string | undefined;
const apiOrigin = configuredApiOrigin ?? (["localhost", "127.0.0.1"].includes(window.location.hostname) ? undefined : "https://auth.ethicsandai.your-digital-life.org");
const publicOrigin = (import.meta.env.VITE_PUBLIC_READER_ORIGIN as string | undefined) ?? "https://ethicsandai.your-digital-life.org";
const authOrigin = (import.meta.env.VITE_AUTH_ORIGIN as string | undefined) ?? "https://auth.ethicsandai.your-digital-life.org";
const returnUrl = `${publicOrigin}/chapter/${requestedSlug}/`;
let chapter = cloneChapter(DEMO_CHAPTER);
let selectedPassage = nearestPassage(chapter, requestedAnchor);
let inspector: Inspector = { kind: "chapter" };
let saveState: SaveState = "clean";
let historyOpen = false;
let moreOpen = false;
let activeDialog: "checkpoint" | "person" | "media" | "mediaUpload" | "embed" | "replace" | "source" | "leave" | null = null;
let lastSavedAt = "";
let tiptapEditor: ReturnType<typeof mountTiptap> | null = null;
let historyItems: Array<Record<string, unknown>> = [];
let csrfToken: string | undefined;
let pendingCommitKey: string | null = null;
let changeSetRequestKey = crypto.randomUUID();
let mediaItems: Array<Record<string, unknown>> = [];
let personItems: Array<Record<string, unknown>> = [];
let mediaPlacementDefaults = { alt: "", caption: "", teachingUse: "" };

const MEDIA_MIME_LIMITS = new Map<string, number>([
  ["image/png", 15 * 1024 * 1024], ["image/jpeg", 15 * 1024 * 1024], ["image/gif", 25 * 1024 * 1024], ["image/webp", 15 * 1024 * 1024],
  ["audio/mpeg", 25 * 1024 * 1024], ["audio/wav", 25 * 1024 * 1024], ["audio/mp4", 25 * 1024 * 1024],
  ["video/mp4", 25 * 1024 * 1024], ["video/webm", 25 * 1024 * 1024], ["application/pdf", 25 * 1024 * 1024], ["text/plain", 5 * 1024 * 1024],
]);
const MEDIA_EXTENSIONS = new Map<string, string>([["image/png", "png"], ["image/jpeg", "jpg"], ["image/gif", "gif"], ["image/webp", "webp"], ["audio/mpeg", "mp3"], ["audio/wav", "wav"], ["audio/mp4", "m4a"], ["video/mp4", "mp4"], ["video/webm", "webm"], ["application/pdf", "pdf"], ["text/plain", "txt"]]);

const dataSource = apiOrigin
  ? createAuthoringClient({ baseUrl: apiOrigin, getCsrf: () => csrfToken })
  : null;

function startAgentApprovalSignIn(requestId: string) {
  const start = new URL("/auth/start", authOrigin);
  start.searchParams.set("mode", "agent-access");
  start.searchParams.set("request", requestId);
  window.location.assign(start.toString());
}

async function loadAgentAccess(requestId: string) {
  if (!/^capreq_[A-Za-z0-9_-]{8,}$/.test(requestId) || !dataSource) {
    app.innerHTML = `<main class="agent-access"><p class="eyebrow">Agent authorization</p><h1>This authorization link is invalid</h1><p>Return to the agent and start a new authorization request.</p></main>`;
    return;
  }
  if (params.get("authenticated") !== "1") {
    app.innerHTML = `<main class="agent-access"><p class="eyebrow">Agent authorization</p><h1>Sign in to review this request</h1><p>GitHub verifies that only the textbook owner can grant chapter access or Live Save.</p><button type="button" data-agent-sign-in>Sign in with GitHub</button></main>`;
    app.querySelector<HTMLButtonElement>("[data-agent-sign-in]")?.addEventListener("click", () => startAgentApprovalSignIn(requestId));
    return;
  }
  app.innerHTML = `<main class="agent-access"><p class="eyebrow">Agent authorization</p><h1>Loading the exact request…</h1></main>`;
  try {
    const session = await dataSource.getSession();
    csrfToken = session.csrf_token;
    const request = await dataSource.getAgentCapabilityRequest(requestId);
    const scopes = Array.isArray(request.scopes) ? request.scopes.map(String) : [];
    const documents = Array.isArray(request.allowedDocumentIds) ? request.allowedDocumentIds.map(String) : [];
    const operations = Array.isArray(request.allowedOperations) ? request.allowedOperations.map(String) : [];
    const liveSave = request.liveSave === true;
    const pending = request.state === "pending";
    app.innerHTML = `<main class="agent-access"><p class="eyebrow">Agent authorization</p><h1>${liveSave ? "Review agent editing and Live Save" : "Review agent editing access"}</h1><p>An agent named <strong>${escapeText(String(request.clientId ?? "unknown"))}</strong> is requesting short-lived access for run <code>${escapeText(String(request.runId ?? "unknown"))}</code>.</p><dl class="agent-access__summary"><div><dt>Chapter</dt><dd>${documents.map((value) => `<code>${escapeText(value)}</code>`).join(", ") || "None"}</dd></div><div><dt>Expires</dt><dd>${escapeText(String(request.expiresAt ?? "Unknown"))}</dd></div><div><dt>Scopes</dt><dd>${scopes.map(escapeText).join(", ")}</dd></div></dl><details><summary>Exact API operations (${operations.length})</summary><ul>${operations.map((value) => `<li><code>${escapeText(value)}</code></li>`).join("")}</ul></details>${pending ? `<form data-agent-approval><label>Verification code<input name="userCode" inputmode="text" autocomplete="one-time-code" maxlength="8" required autofocus></label>${liveSave ? `<label class="agent-access__confirm"><input name="confirmLiveSave" type="checkbox" required> I authorize this agent to click Save and publish changes to the live chapter for this short-lived run.</label>` : ""}<p data-agent-status role="status" aria-live="polite"></p><button class="primary" type="submit">${liveSave ? "Approve editing and Live Save" : "Approve editing"}</button></form>` : `<p class="agent-access__result" role="status">This request is ${escapeText(String(request.state ?? "no longer pending"))}. Start a new request from the agent if needed.</p>`}</main>`;
    const form = app.querySelector<HTMLFormElement>("[data-agent-approval]");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = app.querySelector<HTMLElement>("[data-agent-status]");
      const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
      const values = new FormData(form);
      if (button) button.disabled = true;
      if (status) status.textContent = "Recording your approval…";
      try {
        await dataSource.approveAgentCapabilityRequest(requestId, {
          approve: true,
          userCode: String(values.get("userCode") ?? "").trim().toUpperCase(),
          ...(liveSave ? { confirmLiveSave: values.get("confirmLiveSave") === "on" } : {}),
        });
        app.innerHTML = `<main class="agent-access"><p class="eyebrow">Agent authorization</p><h1>Approved</h1><p class="agent-access__result" role="status">The short-lived capability is ready. Return to Codex; it will continue automatically. You can close this tab.</p></main>`;
      } catch (error) {
        if (button) button.disabled = false;
        if (status) status.textContent = error instanceof Error ? error.message : "Approval failed.";
      }
    });
  } catch (error) {
    if (error instanceof AuthoringApiError && error.status === 401) {
      startAgentApprovalSignIn(requestId);
      return;
    }
    app.innerHTML = `<main class="agent-access"><p class="eyebrow">Agent authorization</p><h1>The request could not be loaded</h1><p role="alert">${escapeText(error instanceof Error ? error.message : "Unknown error")}</p><p>Return to the agent and start a new authorization request.</p></main>`;
  }
}

function cutoverDocumentRows(documents: Array<Record<string, unknown>>) {
  return documents.map((document) => {
    const documentId = String(document.document_id ?? document.documentId ?? "");
    const revisionId = String(document.base_revision_id ?? document.baseRevisionId ?? "");
    const contentHash = String(document.content_hash ?? document.contentHash ?? "");
    return `<tr><th scope="row">${escapeText(documentId)}</th><td><code>${escapeText(revisionId)}</code></td><td><code>${escapeText(contentHash.slice(0, 16))}…</code></td></tr>`;
  }).join("");
}

async function loadCutoverReview(changeSetId: string) {
  if (!dataSource) return;
  try {
    const session = await dataSource.getSession();
    csrfToken = session.csrf_token;
    const changeSet = await dataSource.getChangeset(changeSetId);
    const documents = Array.isArray(changeSet.documents) ? changeSet.documents as Array<Record<string, unknown>> : [];
    const snapshot = changeSet.submittedSnapshot as Record<string, unknown> | null;
    const decision = changeSet.releaseDecision as Record<string, unknown> | null;
    const state = String(changeSet.state ?? "unknown");
    app.innerHTML = `<main class="cutover-review"><p class="eyebrow">Authority cutover review</p><h1>${escapeText(String(changeSet.title ?? "Multi-chapter authority cutover"))}</h1><p>This is a read-only migration proposal. Review the exact chapters and immutable source hashes before submitting or approving it.</p><dl class="review-summary"><div><dt>Changeset</dt><dd><code>${escapeText(changeSetId)}</code></dd></div><div><dt>State</dt><dd data-review-state>${escapeText(state)}</dd></div><div><dt>Documents</dt><dd>${documents.length}</dd></div></dl><div class="review-table-wrap"><table><thead><tr><th>Chapter</th><th>Base revision</th><th>Content hash</th></tr></thead><tbody>${cutoverDocumentRows(documents)}</tbody></table></div>${snapshot ? `<section class="snapshot-binding"><h2>Submitted snapshot</h2><p>Approval will bind this exact immutable snapshot.</p><dl><div><dt>Snapshot hash</dt><dd><code data-snapshot-hash>${escapeText(String(snapshot.snapshotHash ?? ""))}</code></dd></div><div><dt>Snapshot revision</dt><dd><code data-snapshot-revision>${escapeText(String(snapshot.snapshotRevision ?? ""))}</code></dd></div></dl>${decision ? `<p class="review-success" role="status">Approved by ${escapeText(String(decision.decidedBy ?? "the instructor"))}. This snapshot is ready for the protected release workflow.</p>` : `<label class="review-confirm"><input type="checkbox" data-confirm-snapshot> I reviewed all ${documents.length} chapter identities and approve this exact snapshot for release.</label><button type="button" data-approve-cutover>Approve exact snapshot</button>`}</section>` : `<button type="button" data-submit-cutover>Submit exact ${documents.length}-chapter snapshot for approval</button>`}<p class="review-status" role="status" data-review-status></p><p><a href="${escapeAttribute(returnUrl)}">Return to the textbook</a></p></main>`;
    const status = app.querySelector<HTMLElement>("[data-review-status]");
    const submit = app.querySelector<HTMLButtonElement>("[data-submit-cutover]");
    submit?.addEventListener("click", async () => {
      submit.disabled = true;
      if (status) status.textContent = "Submitting immutable snapshot…";
      try {
        await dataSource.submitChangeset(changeSetId, {
          documents: documents.map((document) => ({ documentId: document.document_id, baseRevisionId: document.base_revision_id, expectedVersion: document.version })),
          idempotencyKey: crypto.randomUUID(),
        });
        await loadCutoverReview(changeSetId);
      } catch (error) {
        submit.disabled = false;
        if (status) status.textContent = error instanceof Error ? error.message : "Submission failed.";
      }
    });
    const approve = app.querySelector<HTMLButtonElement>("[data-approve-cutover]");
    approve?.addEventListener("click", async () => {
      const confirmed = app.querySelector<HTMLInputElement>("[data-confirm-snapshot]");
      if (!confirmed?.checked) {
        if (status) status.textContent = "Check the confirmation after reviewing the exact snapshot.";
        return;
      }
      approve.disabled = true;
      if (status) status.textContent = "Recording human approval…";
      try {
        await dataSource.approveChangeset(changeSetId, {
          snapshotHash: snapshot?.snapshotHash,
          snapshotRevision: snapshot?.snapshotRevision,
          decisionKind: "release",
          comment: `Reviewed ${documents.length} seeded chapter identities and immutable content hashes for the unified authoring cutover.`,
          idempotencyKey: crypto.randomUUID(),
        });
        await loadCutoverReview(changeSetId);
      } catch (error) {
        approve.disabled = false;
        if (status) status.textContent = error instanceof Error ? error.message : "Approval failed.";
      }
    });
  } catch (error) {
    if (error instanceof AuthoringApiError && error.status === 401) {
      const start = new URL("/auth/start", authOrigin);
      start.searchParams.set("chapter", requestedSlug);
      start.searchParams.set("mode", "edit");
      start.searchParams.set("review", changeSetId);
      window.location.assign(start.toString());
      return;
    }
    app.innerHTML = `<main class="cutover-review"><h1>Cutover review could not be loaded</h1><p role="alert">${escapeText(error instanceof Error ? error.message : "Unknown error")}</p></main>`;
  }
}

function hydrateManagedMediaPreviews(source: ChapterDocument): ChapterDocument {
  if (!dataSource) return source;
  return {
    ...source,
    body: source.body.map((block) => {
      if (block.type !== "mediaFigure") return block;
      const mediaId = typeof block.mediaId === "string" ? block.mediaId : "";
      const mediaVersionId = typeof block.mediaVersionId === "string" ? block.mediaVersionId : "";
      const rightsCaseId = typeof block.rightsCaseId === "string" ? block.rightsCaseId : "";
      if (!mediaId || !mediaVersionId || !rightsCaseId) return block;
      const editorPreviewUrl = dataSource.getManagedMediaPreviewUrl(mediaId, mediaVersionId, rightsCaseId);
      // `src` is intentionally transient. The serializer and API both remove
      // it before the chapter can become canonical content.
      return { ...block, editorPreviewUrl, src: editorPreviewUrl };
    }),
  };
}

function managedMediaPreviewUrl(item: Record<string, unknown>) {
  if (!dataSource) return "";
  const mediaId = typeof item.id === "string" ? item.id : "";
  const mediaVersionId = typeof item.media_version_id === "string" ? item.media_version_id : "";
  const rightsCaseId = typeof item.rights_case_id === "string" ? item.rights_case_id : "";
  return mediaId && mediaVersionId && rightsCaseId ? dataSource.getManagedMediaPreviewUrl(mediaId, mediaVersionId, rightsCaseId) : "";
}

function recoveryKey() {
  return `ai-ethics-instructor-recovery/${chapter.documentId}/${chapter.revisionId}`;
}

function saveRecovery() {
  if (!["dirty", "attention", "saving", "pending"].includes(saveState)) return;
  sessionStorage.setItem(recoveryKey(), JSON.stringify({ savedAt: Date.now(), chapter, pendingCommitKey }));
}

function setState(next: SaveState) {
  saveState = next;
  saveRecovery();
  render();
}

function stateLabel() {
  return {
    clean: "All changes saved",
    dirty: "Unsaved changes",
    saving: "Saving…",
    pending: "Saved; confirming…",
    saved: "Saved",
    attention: "Save needs attention",
  }[saveState];
}

const publicAnchor = (value: string) => value.replace(/^passage_/, "");

async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256File(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizedMediaMime(file: File) {
  if (MEDIA_MIME_LIMITS.has(file.type)) return file.type;
  const extension = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", mp4: "video/mp4", webm: "video/webm", pdf: "application/pdf", txt: "text/plain" } as Record<string, string>)[extension] ?? "";
}

function sanitizedMediaFilename(file: File, mimeType: string) {
  const extension = MEDIA_EXTENSIONS.get(mimeType);
  if (!extension) throw new Error("Choose a supported PNG, JPEG, GIF, WebP, audio, video, PDF, or text file.");
  const originalStem = file.name.replace(/\.[^.]*$/, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const stem = originalStem.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 110) || "media";
  return `${stem}.${extension}`;
}

async function waitForMediaJob(jobId: string, update: (message: string) => void) {
  if (!dataSource) throw new Error("The content API is unavailable.");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const job = await dataSource.getMediaJob(jobId);
    const state = String(job.state ?? "unknown");
    update(state === "queued" ? "Uploaded. Creating safe web derivatives…" : state === "processing" ? "Processing media and accessibility metadata…" : `Media job: ${state}`);
    if (state === "ready") return job;
    if (["failed", "rejected", "blocked"].includes(state)) throw new Error(`Media processing failed${job.error_code ? `: ${String(job.error_code)}` : "."}`);
    await new Promise((resolve) => window.setTimeout(resolve, 3000));
  }
  throw new Error(`The upload is still processing. Its job ID is ${jobId}; reopen Media shortly to find the cleared item.`);
}

async function loadMediaLibrary() {
  if (!dataSource) return;
  const result = await dataSource.searchMedia({ rightsStatus: "cleared", limit: 50 });
  mediaItems = Array.isArray(result.media) ? result.media as Array<Record<string, unknown>> : [];
}

function selectedBlock() {
  return checkpointAnchorBlock(chapter, selectedPassage) ?? chapter.body.find((block) => Boolean(block.blockId));
}

function safeTitle(value: unknown) {
  return typeof value === "string" && value.trim() ? value : chapter.title;
}

function checkpointAnchorOptions(selected: string) {
  const seen = new Set<string>();
  return chapter.body.flatMap((block) => {
    const passageId = blockPassage(block);
    if (!passageId || seen.has(passageId)) return [];
    seen.add(passageId);
    const description = checkpointExcerpt(checkpointAnchorBlock(chapter, passageId));
    const label = description.trim().replace(/\s+/g, " ").slice(0, 72);
    return [`<option value="${escapeAttribute(passageId)}" ${passageId === selected ? "selected" : ""}>${escapeText(label ? `${passageId} — ${label}` : passageId)}</option>`];
  }).join("");
}

async function loadChapter() {
  if (!dataSource) return;
  try {
    const session = await dataSource.getSession();
    csrfToken = session.csrf_token;
    const view = await dataSource.getAuthoringView(requestedDocument);
    chapter = hydrateManagedMediaPreviews(chapterFromAuthoringView(view, chapter));
    const changeSet = await dataSource.createOrResumeChangeset(requestedDocument, { title: `Edit ${chapter.title}`, description: "Continuous instructor authoring session", resume: true, idempotencyKey: changeSetRequestKey });
    if (changeSet.chapter) chapter = hydrateManagedMediaPreviews(chapterFromAuthoringView({ ...view, chapter: changeSet.chapter, changeSetId: changeSet.id, baseRevisionId: changeSet.baseRevisionId, expectedVersion: changeSet.version }, chapter));
    else { chapter.changeSetId = changeSet.id; chapter.baseRevisionId = changeSet.baseRevisionId ?? chapter.revisionId; chapter.expectedVersion = changeSet.version ?? 1; }
    selectedPassage = nearestPassage(chapter, requestedAnchor);
    const recovery = sessionStorage.getItem(recoveryKey());
    if (recovery) {
      const parsed = JSON.parse(recovery) as { chapter?: ChapterDocument; pendingCommitKey?: string | null };
      if (parsed.chapter && window.confirm("A newer local instructor recovery draft is available. Restore it?")) {
        chapter = parsed.chapter;
        pendingCommitKey = parsed.pendingCommitKey ?? null;
        setState("dirty");
        return;
      }
    }
  } catch (error) {
    if (error instanceof AuthoringApiError && error.status === 401) {
      const start = new URL("/auth/start", authOrigin); start.searchParams.set("chapter", requestedSlug); start.searchParams.set("mode", "edit"); if (requestedAnchor) start.searchParams.set("anchor", requestedAnchor); window.location.assign(start.toString()); return;
    }
    console.error("Unable to load the canonical authoring view.", error);
    setState("attention");
    return;
  }
  render();
  window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-passage-id="${CSS.escape(selectedPassage)}"]`)?.scrollIntoView({ block: "center" }));
}

function inspectorHtml() {
  if (!inspector || inspector.kind === "chapter") {
    return `<section class="inspector__empty"><p class="eyebrow">Chapter metadata</p><h2>${safeTitle(chapter.title)}</h2><p>Select prose to anchor an insertion, or select a checkpoint, scholar card, or media node to inspect it.</p><dl><div><dt>Revision</dt><dd>${chapter.revisionId}</dd></div><div><dt>Anchor</dt><dd>${selectedPassage || "Choose a passage"}</dd></div></dl></section>`;
  }
  if (inspector.kind === "checkpoint") {
    const item = chapter.checkpoints.find((checkpoint) => checkpoint.checkpointId === inspector.id);
    if (!item) return "";
    const anchorCheckpoints = chapter.checkpoints
      .map((checkpoint, index) => ({ checkpoint, index }))
      .filter(({ checkpoint }) => checkpoint.passageId === item.passageId)
      .sort((a, b) => a.checkpoint.displayOrder - b.checkpoint.displayOrder || a.index - b.index)
      .map(({ checkpoint }) => checkpoint);
    const itemPosition = Math.max(0, anchorCheckpoints.findIndex((checkpoint) => checkpoint.checkpointId === item.checkpointId));
    return `<form data-inspector-form class="inspector-form"><p class="eyebrow">Prompt checkpoint</p><h2>${item.title}</h2><label>Title<input name="title" value="${escapeAttribute(item.title)}" required></label><label>Prompt<textarea name="prompt" rows="5" required>${escapeText(item.prompt)}</textarea></label><label>Guidance<textarea name="guidance" rows="3">${escapeText(item.guidance)}</textarea></label><label>Stage or label<input name="stage" list="checkpoint-stages" maxlength="120" value="${escapeAttribute(item.stage ?? "")}" placeholder="Commit, Work, Reconcile, or another label"><datalist id="checkpoint-stages"><option value="Commit"><option value="Work"><option value="Reconcile"></datalist></label><label>Anchor passage<select name="passageId">${checkpointAnchorOptions(item.passageId)}</select></label><label>Order at passage<input name="displayOrder" type="number" min="0" max="${Math.max(0, chapter.checkpoints.length - 1)}" value="${itemPosition}" required></label><p class="inspector-note">The anchor and order control where this card appears inline and in the reading-record sequence.</p><div class="inspector-actions"><button type="submit">Update checkpoint</button><button type="button" data-shift-checkpoint="-1" ${itemPosition <= 0 ? "disabled" : ""}>Move earlier</button><button type="button" data-shift-checkpoint="1" ${itemPosition >= anchorCheckpoints.length - 1 ? "disabled" : ""}>Move later</button><button class="danger" type="button" data-remove-checkpoint="${item.checkpointId}">Remove</button></div></form>`;
  }
  const placement = chapter.managedPlacements.find((item) => item.placementId === inspector.id);
  if (!placement) return "";
  const type = placement.kind === "personFeature" ? "Person feature" : placement.kind === "media" ? "Image / media" : "External embed";
  const feature = chapter.personFeatures.find((item) => item.personFeatureId === placement.contentId);
  return `<section class="inspector-form"><p class="eyebrow">${type}</p><h2>${escapeText(String(feature?.name ?? placement.contentId))}</h2><p>This is a typed placement. Its shared reader rendering remains visible on the chapter canvas.</p><label>Display preset<select data-placement-preset="${placement.placementId}"><option ${placement.displayPreset === "thinker-card" ? "selected" : ""}>thinker-card</option><option ${placement.displayPreset === "reading" ? "selected" : ""}>reading</option><option ${placement.displayPreset === "wide" ? "selected" : ""}>wide</option></select></label><p class="inspector-note">${placement.position} <strong>${placement.anchorPassageId}</strong></p><div class="inspector-actions"><button type="button" data-move-placement="before">Move before passage</button><button type="button" data-move-placement="after">Move after passage</button><button class="danger" type="button" data-remove-placement="${placement.placementId}">Remove</button></div></section>`;
}

function dialogHtml() {
  if (!activeDialog) return "";
  if (activeDialog === "checkpoint") return `<dialog open data-dialog><form data-checkpoint-form><header><h2>Add checkpoint</h2><button type="button" data-close aria-label="Close">×</button></header><p>Anchored after <strong>${selectedPassage || "the selected passage"}</strong>. It will not be created until required fields are complete.</p><label>Title<input name="title" required autofocus></label><label>Prompt<textarea name="prompt" rows="5" required></textarea></label><label>Guidance<textarea name="guidance" rows="3"></textarea></label><label>Stage or label<input name="stage" list="new-checkpoint-stages" maxlength="120" value="Commit"><datalist id="new-checkpoint-stages"><option value="Commit"><option value="Work"><option value="Reconcile"></datalist></label><footer><button type="button" data-close>Cancel</button><button type="button" data-add-checkpoint>Add checkpoint</button></footer></form></dialog>`;
  if (activeDialog === "person") return `<dialog open data-dialog><form data-person-form><header><h2>Add person feature</h2><button type="button" data-close aria-label="Close">×</button></header><p>Choose a frozen curated person feature; biography, portrait, and rights remain centralized.</p><label>Person<select name="personIndex" autofocus>${(personItems.length ? personItems : chapter.personFeatures).map((feature, index) => `<option value="${index}">${escapeText(String(feature.name))}</option>`).join("")}</select></label><p class="dialog-note">The thinker-card preset will appear after <strong>${selectedPassage || "the selected passage"}</strong>.</p><footer><button type="button" data-close>Cancel</button><button type="submit" ${(personItems.length || chapter.personFeatures.length) ? "" : "disabled"}>Add person feature</button></footer></form></dialog>`;
  if (activeDialog === "media") {
    const firstPreview = mediaItems.length ? managedMediaPreviewUrl(mediaItems[0]) : "";
    return `<dialog open data-dialog><form data-media-form><header><h2>Insert media</h2><button type="button" data-close aria-label="Close">×</button></header><div class="dialog-split-action"><p>Choose a rights-cleared item from the shared library. The preview is the authenticated derivative that will appear on the editing canvas.</p><button type="button" data-upload-media ${dataSource ? "" : "disabled"}>Upload new media</button></div>${mediaItems.length ? `<label>Media item<select name="mediaIndex" autofocus>${mediaItems.map((item, index) => `<option value="${index}">${escapeText(String(item.title ?? item.id ?? `Media ${index + 1}`))}</option>`).join("")}</select></label><figure class="media-picker-preview" data-media-picker-preview ${firstPreview ? "" : "hidden"}><img src="${escapeAttribute(firstPreview)}" alt="Selected managed media preview"><figcaption data-media-picker-caption>${escapeText(String(mediaItems[0].title ?? "Selected media"))}</figcaption></figure><p class="dialog-note" data-media-preview-unavailable ${firstPreview ? "hidden" : ""}>This cleared item has no browser-renderable derivative yet.</p>` : `<p class="dialog-note">${dataSource ? "No cleared media is in the library yet. Upload the first item." : "Connect the content API to browse cleared media."}</p>`}<label>Alt text<input name="alt" value="${escapeAttribute(mediaPlacementDefaults.alt)}" required></label><label>Caption<input name="caption" value="${escapeAttribute(mediaPlacementDefaults.caption)}" required></label><label>Teaching use<textarea name="teachingUse" rows="3" required>${escapeText(mediaPlacementDefaults.teachingUse)}</textarea></label><label>Display<select name="displayPreset"><option>narrow</option><option selected>reading</option><option>wide</option><option>bleed</option></select></label><p class="dialog-note">Placed after <strong>${selectedPassage || "the selected passage"}</strong>.</p><footer><button type="button" data-close>Cancel</button><button type="submit" ${mediaItems.length ? "" : "disabled"}>Insert media</button></footer></form></dialog>`;
  }
  if (activeDialog === "mediaUpload") return `<dialog open data-dialog class="media-upload-dialog"><form data-media-upload-form><header><h2>Upload new media</h2><button type="button" data-close aria-label="Close">×</button></header><p>Upload once, document rights and accessibility, then reuse the cleared item anywhere in the book. Originals remain private; the editor and reader use safe derivatives.</p><label>File<input name="file" type="file" accept="image/png,image/jpeg,image/gif,image/webp,audio/mpeg,audio/wav,audio/mp4,video/mp4,video/webm,application/pdf,text/plain" required autofocus></label><p class="dialog-note">PNG, JPEG, WebP up to 15 MB; GIF, audio, video, and PDF up to 25 MB; text up to 5 MB.</p><fieldset><legend>Rights and credit</legend><label>Rights basis<select name="rightsBasis"><option value="owned">I own this media</option><option value="licensed">Licensed for this use</option><option value="permission">Used with permission</option><option value="publicDomain">Public domain</option><option value="fairUse">Documented fair use</option></select></label><label>Creator<input name="creator" required></label><label>Source URL <span>(optional for owned media)</span><input name="sourceUrl" type="url" placeholder="https://"></label><label>License <span>(optional)</span><input name="license" placeholder="CC BY 4.0"></label><label>Attribution / credit line<input name="attribution" required></label></fieldset><fieldset><legend>Chapter presentation and accessibility</legend><label>Caption<input name="caption" required></label><label>Alt text<input name="alt" required></label><label>Teaching use<textarea name="teachingUse" rows="3" required></textarea></label><label>Placement intent<input name="placementIntent" value="Insert after the selected chapter passage." required></label><label>Transcript or equivalent <span>(required for audio/video)</span><textarea name="transcript" rows="5"></textarea></label><label>Transcript language<input name="language" value="en"></label><label>Video poster alt text <span>(required for video)</span><input name="posterAlt"></label></fieldset><div class="review-confirmations"><label><input name="rightsConfirmed" type="checkbox" required> I reviewed the source, license, permission, or fair-use basis and authorize this exact file for the textbook.</label><label><input name="accessibilityConfirmed" type="checkbox" required> I reviewed the alt text, caption, motion, and transcript requirements for this exact file.</label></div><p class="media-upload-status" data-media-upload-status role="status" aria-live="polite"></p><footer><button type="button" data-back-to-media>Back to library</button><button class="primary" type="submit">Review and upload</button></footer></form></dialog>`;
  if (activeDialog === "embed") return `<dialog open data-dialog><form data-embed-form><header><h2>Insert embed</h2><button type="button" data-close aria-label="Close">×</button></header><p>Paste a YouTube, Vimeo, X, Spotify, SoundCloud, Bluesky, or public HTTPS URL. The server resolves the provider; raw HTML is never accepted.</p><label>Canonical URL<input name="url" type="url" value="https://" required autofocus></label><label>Visible title<input name="title" required></label><label>Teaching use / fallback summary<textarea name="teachingUse" rows="3" required></textarea></label><p class="dialog-note">The published fallback and activation control will appear after <strong>${selectedPassage || "the selected passage"}</strong>.</p><footer><button type="button" data-close>Cancel</button><button type="submit">Insert embed</button></footer></form></dialog>`;
  if (activeDialog === "replace") return `<dialog open data-dialog><form data-replace-form><header><h2>Replace chapter</h2><button type="button" data-close aria-label="Close">×</button></header><p>Paste plain text for a safe local replacement preview. Saving remains the only live operation.</p><label>Chapter text<textarea name="body" rows="12" autofocus>${escapeText(chapter.body.map((block) => block.text ?? block.items?.join("\n") ?? "").join("\n\n"))}</textarea></label><footer><button type="button" data-close>Cancel</button><button type="button" data-apply-replacement>Apply local replacement</button></footer></form></dialog>`;
  if (activeDialog === "source") return `<dialog open data-dialog><form data-source-form><header><h2>Structured source</h2><button type="button" data-close aria-label="Close">×</button></header><p>Advanced contract-native editing for agents and precise repairs. Managed media, embeds, scholar cards, and checkpoint identities remain typed data rather than raw HTML.</p><label>Chapter JSON<textarea name="source" rows="18" spellcheck="false" autofocus>${escapeText(JSON.stringify(chapter, null, 2))}</textarea></label><footer><button type="button" data-close>Cancel</button><button type="button" data-apply-source>Apply to draft</button></footer></form></dialog>`;
  return `<dialog open data-dialog><form data-leave-form><header><h2>Unsaved changes</h2><button type="button" data-close aria-label="Close">×</button></header><p>Save and return publishes this chapter. Discard removes the local recovery draft.</p><footer><button type="button" data-close>Continue editing</button><button class="danger" type="button" data-discard>Discard</button><button class="primary" type="submit">Save and return</button></footer></form></dialog>`;
}

function render() {
  // Destroy while the old editor DOM is still attached. Destroying after
  // replacing app.innerHTML can let stale ProseMirror state overwrite a newly
  // imported server chapter.
  tiptapEditor?.destroy();
  tiptapEditor = null;
  app.innerHTML = `<header class="author-bar"><a class="author-bar__mark" href="${publicOrigin}/">AI Ethics Textbook</a><div class="author-bar__chapter"><span>Editing</span><strong>${escapeText(chapter.title)}</strong></div><div class="author-bar__actions"><button data-done>Done</button><span class="save-state save-state--${saveState}" aria-live="polite">${stateLabel()}</span><button class="primary" data-save ${saveState === "saving" ? "disabled" : ""}>Save</button><button data-history aria-expanded="${historyOpen}">History</button><button data-more aria-expanded="${moreOpen}">More</button></div>${moreOpen ? `<menu class="more-menu"><button data-replace>Replace chapter</button><button data-source>Structured source</button></menu>` : ""}</header><main class="editor-layout"><section class="editor-canvas"><div class="format-toolbar" role="toolbar" aria-label="Chapter formatting"><select data-format aria-label="Paragraph style"><option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option></select><button data-command="bold" aria-label="Bold"><strong>B</strong></button><button data-command="italic" aria-label="Italic"><em>I</em></button><button data-command="underline" aria-label="Underline"><u>U</u></button><button data-command="toggleBulletList">Bulleted list</button><button data-command="toggleOrderedList">Numbered list</button><button data-link>Link</button><span class="toolbar-divider"></span><button data-dialog="checkpoint">Checkpoint</button><button data-dialog="media">Media</button><button data-dialog="embed">Embed</button><button data-dialog="person">Person / Scholar</button><span class="toolbar-divider"></span><button data-command="undo" aria-label="Undo">Undo</button><button data-command="redo" aria-label="Redo">Redo</button></div><div id="editor-document" data-document></div></section><aside class="inspector" aria-label="Contextual inspector">${inspectorHtml()}</aside></main>${historyOpen ? `<aside class="history-drawer" aria-label="Revision history"><header><h2>Revision history</h2><button data-history>Close</button></header><p>${dataSource ? "Immutable revisions from the authoring API. Restore creates a new draft and never rewrites history." : "Local scaffold history; configure the content API to load immutable revisions."}</p><ol><li><strong>${chapter.revisionId}</strong><span>Current base revision</span></li>${historyItems.map((item) => `<li><strong>${escapeText(String(item.revisionId ?? item.id ?? "Revision"))}</strong><span>${escapeText(String(item.createdAt ?? item.created_at ?? "Immutable revision"))}</span>${item.current ? "" : `<button type="button" data-restore-revision="${escapeAttribute(String(item.revisionId ?? item.id ?? ""))}">Restore as draft</button>`}</li>`).join("")}${lastSavedAt ? `<li><strong>Saved</strong><span>${lastSavedAt}</span></li>` : ""}</ol></aside>` : ""}${dialogHtml()}`;
  bindEvents();
}

function bindEvents() {
  const documentNode = app.querySelector<HTMLElement>("[data-document]");
  if (documentNode) tiptapEditor = mountTiptap(documentNode, chapter, (body) => { chapter.body = body; selectedPassage = nearestPassage(chapter, selectedPassage); if (saveState !== "saving") { saveState = "dirty"; saveRecovery(); const label = app.querySelector<HTMLElement>(".save-state"); if (label) { label.textContent = stateLabel(); label.className = "save-state save-state--dirty"; } } }, (placementId) => { inspector = placementId.startsWith("checkpoint_") ? { kind: "checkpoint", id: placementId } : { kind: "managed", id: placementId }; render(); }, (passageId) => { selectedPassage = nearestPassage(chapter, passageId); inspector = { kind: "chapter" }; const anchor = app.querySelector<HTMLElement>(".inspector__empty dd:last-child"); if (anchor) anchor.textContent = selectedPassage; }, legacyCuratedArtifacts.filter((item) => item.chapterId === requestedDocument));
  app.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((button) => button.addEventListener("click", () => {
    const command = button.dataset.command ?? "";
    const commands = tiptapEditor?.chain().focus();
    if (!commands) return;
    if (command === "bold") commands.toggleBold().run();
    else if (command === "italic") commands.toggleItalic().run();
    else if (command === "underline") commands.toggleUnderline().run();
    else if (command === "toggleBulletList") commands.toggleBulletList().run();
    else if (command === "toggleOrderedList") commands.toggleOrderedList().run();
    else if (command === "undo") commands.undo().run();
    else if (command === "redo") commands.redo().run();
    setState("dirty");
  }));
  app.querySelector<HTMLSelectElement>("[data-format]")?.addEventListener("change", (event) => {
    const value = (event.currentTarget as HTMLSelectElement).value;
    const commands = tiptapEditor?.chain().focus();
    if (value === "h2") commands?.toggleHeading({ level: 2 }).run(); else if (value === "h3") commands?.toggleHeading({ level: 3 }).run(); else if (value === "blockquote") commands?.toggleBlockquote().run(); else commands?.setParagraph().run();
    setState("dirty");
  });
  app.querySelector<HTMLButtonElement>("[data-link]")?.addEventListener("click", () => {
    const href = window.prompt("Link URL (HTTPS, /internal-path, or #anchor)");
    if (!href) return;
    if (!/^https:\/\//.test(href) && !/^\/(?!\/)/.test(href) && !/^#[A-Za-z][A-Za-z0-9:_-]*$/.test(href)) { setState("attention"); return; }
    tiptapEditor?.chain().focus().extendMarkRange("link").setLink({ href }).run(); setState("dirty");
  });
  app.querySelectorAll<HTMLElement>("[data-managed-node]").forEach((node) => node.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); node.click(); }
  }));
  app.querySelectorAll<HTMLButtonElement>("[data-insert-after]").forEach((button) => button.addEventListener("click", () => {
    selectedPassage = String(button.dataset.insertAfter); activeDialog = "checkpoint"; render();
  }));
  app.querySelector<HTMLButtonElement>("[data-save]")?.addEventListener("click", save);
  app.querySelector<HTMLButtonElement>("[data-done]")?.addEventListener("click", done);
  app.querySelector<HTMLButtonElement>("[data-history]")?.addEventListener("click", async () => { historyOpen = !historyOpen; render(); if (historyOpen && dataSource) { try { const result = await dataSource.getHistory(chapter.documentId); historyItems = Array.isArray(result.revisions) ? result.revisions as Array<Record<string, unknown>> : Array.isArray(result.items) ? result.items as Array<Record<string, unknown>> : []; render(); } catch { historyItems = []; render(); } } });
  app.querySelector<HTMLButtonElement>("[data-more]")?.addEventListener("click", () => { moreOpen = !moreOpen; render(); });
  app.querySelector<HTMLButtonElement>("[data-replace]")?.addEventListener("click", () => { activeDialog = "replace"; moreOpen = false; render(); });
  app.querySelector<HTMLButtonElement>("[data-source]")?.addEventListener("click", () => { activeDialog = "source"; moreOpen = false; render(); });
  app.querySelectorAll<HTMLButtonElement>("button[data-dialog]").forEach((button) => button.addEventListener("click", async () => {
    activeDialog = button.dataset.dialog as typeof activeDialog; render();
    if (activeDialog === "media" && dataSource) {
      try { await loadMediaLibrary(); }
      catch (error) { console.error("Unable to load cleared media.", error); mediaItems = []; setState("attention"); return; }
      render();
    }
    if (activeDialog === "person" && dataSource) {
      try { const result = await dataSource.searchPersons({ limit: 50 }); personItems = Array.isArray(result.persons) ? result.persons as Array<Record<string, unknown>> : []; }
      catch (error) { console.error("Unable to load curated people.", error); personItems = []; setState("attention"); return; }
      render();
    }
  }));
  app.querySelector<HTMLButtonElement>("[data-upload-media]")?.addEventListener("click", () => { activeDialog = "mediaUpload"; render(); });
  app.querySelector<HTMLButtonElement>("[data-back-to-media]")?.addEventListener("click", async () => {
    activeDialog = "media";
    try { await loadMediaLibrary(); } catch (error) { console.error("Unable to load cleared media.", error); }
    render();
  });
  app.querySelectorAll<HTMLButtonElement>("[data-restore-revision]").forEach((button) => button.addEventListener("click", async () => {
    if (!dataSource || !window.confirm("Restore this revision as a new draft? The live chapter will not change until you click Save.")) return;
    try {
      const result = await dataSource.restoreAsDraft(chapter.documentId, String(button.dataset.restoreRevision), { title: `Restore ${chapter.title}`, description: "Instructor history restore", idempotencyKey: crypto.randomUUID() });
      chapter = chapterFromAuthoringView({ ...result, chapter: result.chapter ?? result.document }, chapter); historyOpen = false; setState("dirty");
    } catch (error) { console.error(error); setState("attention"); }
  }));
  app.querySelectorAll<HTMLButtonElement>("[data-close]").forEach((button) => button.addEventListener("click", () => { activeDialog = null; render(); }));
  app.querySelector<HTMLSelectElement>("[data-media-form] select[name=mediaIndex]")?.addEventListener("change", (event) => {
    const item = mediaItems[Number((event.currentTarget as HTMLSelectElement).value)];
    const url = item ? managedMediaPreviewUrl(item) : "";
    const preview = app.querySelector<HTMLElement>("[data-media-picker-preview]");
    const image = preview?.querySelector<HTMLImageElement>("img");
    const caption = preview?.querySelector<HTMLElement>("[data-media-picker-caption]");
    const unavailable = app.querySelector<HTMLElement>("[data-media-preview-unavailable]");
    if (image) image.src = url;
    if (caption) caption.textContent = String(item?.title ?? "Selected media");
    if (preview) preview.hidden = !url;
    if (unavailable) unavailable.hidden = Boolean(url);
  });
  bindForms();
}

function bindForms() {
  const addCheckpointFromForm = async (form: HTMLFormElement) => {
    const values = new FormData(form); const title = String(values.get("title") ?? "").trim(); const prompt = String(values.get("prompt") ?? "").trim(); if (!title || !prompt) { setState("attention"); return; }
    const stage = String(values.get("stage") ?? "").trim() || undefined;
    const anchor = selectedBlock();
    if (dataSource && anchor) {
      const passageText = checkpointExcerpt(anchor);
      await applyDraftOperations([{ type: "checkpoint.upsert", checkpoint: { passageId: selectedPassage, passageExcerptHash: await sha256Text(passageText), displayOrder: chapter.checkpoints.filter((item) => item.passageId === selectedPassage).length, title, trigger: "Instructor inserted checkpoint", prompt, guidance: String(values.get("guidance") ?? "").trim() || "Pause and explain your reasoning.", stage, strategy: "self-explanation", responseStructure: "prose", minWords: 30, maxWords: 150, showInSidebar: true, rationale: "Instructor-authored checkpoint." } }]);
    } else addCheckpoint(chapter, { title, trigger: "Instructor inserted checkpoint", prompt, guidance: String(values.get("guidance") ?? "").trim() || "Pause and explain your reasoning.", stage, strategy: "self-explanation", responseStructure: "prose", minWords: 30, maxWords: 150, showInSidebar: true, rationale: "Instructor-authored checkpoint." }, selectedPassage);
    activeDialog = null; setState("dirty");
  };
  app.querySelector<HTMLButtonElement>("[data-add-checkpoint]")?.addEventListener("click", () => { const form = app.querySelector<HTMLFormElement>("[data-checkpoint-form]"); if (form) void addCheckpointFromForm(form); });
  app.querySelector<HTMLFormElement>("[data-checkpoint-form]")?.addEventListener("submit", (event) => {
    event.preventDefault(); void addCheckpointFromForm(event.currentTarget);
  });
  app.querySelector<HTMLFormElement>("[data-person-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault(); const selected = Number(new FormData(event.currentTarget).get("personIndex")); const curated = personItems[selected]; const source = curated ?? chapter.personFeatures[selected];
    try {
      if (!source) throw new Error("The selected curated person is unavailable.");
      let next;
      if (curated) {
        const placementId = newId("placement"); const personFeatureId = newId("personfeature");
        const feature = { ...structuredClone(curated), entityRevision: undefined, sourceDocumentId: undefined, personFeatureId, placementId } as ChapterDocument["personFeatures"][number];
        const placement = { placementId, kind: "personFeature" as const, contentId: personFeatureId, anchorPassageId: selectedPassage, position: "after" as const, orderAtAnchor: chapter.managedPlacements.filter((item) => item.anchorPassageId === selectedPassage && item.position === "after").length, displayPreset: "thinker-card" as const };
        next = { feature, placement };
      } else next = addPersonFeature(chapter, String(source.personFeatureId), selectedPassage);
      if (dataSource) {
        chapter.personFeatures = chapter.personFeatures.filter((item) => item.personFeatureId !== next.feature.personFeatureId);
        chapter.managedPlacements = chapter.managedPlacements.filter((item) => item.placementId !== next.placement.placementId);
        await applyDraftOperations([{ type: "personFeature.upsert", feature: next.feature, placement: next.placement }]);
      }
      activeDialog = null; setState("dirty");
    } catch (error) { console.error("Unable to add the person feature.", error); setState("attention"); }
  });
  app.querySelector<HTMLFormElement>("[data-media-upload-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const fileValue = values.get("file");
    const status = form.querySelector<HTMLElement>("[data-media-upload-status]");
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const update = (message: string, failed = false) => { if (status) { status.textContent = message; status.classList.toggle("danger", failed); } };
    if (!dataSource || !(fileValue instanceof File) || fileValue.size < 1) { update("Choose a file before uploading.", true); return; }
    const mimeType = normalizedMediaMime(fileValue);
    const limit = MEDIA_MIME_LIMITS.get(mimeType);
    if (!limit) { update("That file type is not supported.", true); return; }
    if (fileValue.size > limit) { update(`That file exceeds the ${Math.round(limit / 1024 / 1024)} MB limit for its type.`, true); return; }
    const transcript = String(values.get("transcript") ?? "").trim();
    const language = String(values.get("language") ?? "en").trim();
    const posterAlt = String(values.get("posterAlt") ?? "").trim();
    const isAudioVideo = mimeType.startsWith("audio/") || mimeType.startsWith("video/");
    if (isAudioVideo && (!transcript || !language)) { update("Audio and video require a substantive transcript or equivalent and a language.", true); return; }
    if (mimeType.startsWith("video/") && !posterAlt) { update("Video requires poster alt text.", true); return; }
    const sourceUrl = String(values.get("sourceUrl") ?? "").trim();
    if (sourceUrl && !/^https:\/\//.test(sourceUrl)) { update("The source URL must begin with https://.", true); return; }
    submit?.setAttribute("disabled", "");
    try {
      update("Hashing the exact file…");
      const sha256 = await sha256File(fileValue);
      const alt = String(values.get("alt") ?? "").trim();
      const caption = String(values.get("caption") ?? "").trim();
      const teachingUse = String(values.get("teachingUse") ?? "").trim();
      const transcriptEquivalent = isAudioVideo ? { language, text: transcript } : undefined;
      const reviewPackage = await dataSource.createMediaReviewPackage({
        rights: {
          basis: String(values.get("rightsBasis") ?? "owned"),
          creator: String(values.get("creator") ?? "").trim(),
          attribution: String(values.get("attribution") ?? "").trim(),
          ...(sourceUrl ? { sourceUrl } : {}),
          ...(String(values.get("license") ?? "").trim() ? { license: String(values.get("license")).trim() } : {}),
        },
        editorial: { teachingUse, placementIntent: String(values.get("placementIntent") ?? "").trim() },
        accessibility: {
          decorative: false,
          altText: alt,
          motionReview: mimeType === "image/gif" || mimeType.startsWith("video/") ? "passed" : "notApplicable",
          ...(transcriptEquivalent ? { transcriptEquivalent } : {}),
        },
        idempotencyKey: crypto.randomUUID(),
      });
      update("Recording your exact rights and accessibility approval…");
      await dataSource.decideMediaReviewPackage(String(reviewPackage.id), {
        declarationHash: String(reviewPackage.declarationHash),
        decision: "cleared",
        comment: "Instructor reviewed and approved the exact rights, editorial, accessibility, motion, and transcript declarations in the browser editor.",
        idempotencyKey: crypto.randomUUID(),
      });
      update("Requesting a bounded private upload…");
      const uploadRequest: Record<string, unknown> = {
        filename: sanitizedMediaFilename(fileValue, mimeType), mimeType, bytes: fileValue.size, sha256,
        reviewPackageId: String(reviewPackage.id), idempotencyKey: crypto.randomUUID(),
        ...(transcriptEquivalent ? { transcriptEquivalent: { provided: true, ...transcriptEquivalent } } : {}),
        ...(mimeType.startsWith("video/") ? { poster: { provided: true, alt: posterAlt } } : {}),
      };
      const ticket = await dataSource.requestMediaUpload(uploadRequest);
      const upload = ticket.upload as Record<string, unknown>;
      update("Uploading to private quarantine…");
      await dataSource.uploadMediaBytes(String(ticket.ticketId), await fileValue.arrayBuffer(), { mimeType, sha256, uploadToken: String(upload.token) });
      const ready = await waitForMediaJob(String(ticket.jobId), (message) => update(message));
      const mediaId = String(ready.media_id ?? "");
      const mediaVersionId = String(ready.media_version_id ?? "");
      const rightsCaseId = String(ready.rights_case_id ?? "");
      if (!mediaId || !mediaVersionId || !rightsCaseId || ready.rights_status !== "cleared") throw new Error("Processing finished without a cleared, placement-ready media version.");
      const asset = await dataSource.getMediaAsset(mediaId);
      const item = { id: mediaId, title: asset.title ?? fileValue.name, media_version_id: mediaVersionId, rights_case_id: rightsCaseId, rights_status: "cleared", detected_mime: mimeType };
      mediaItems = [item, ...mediaItems.filter((candidate) => candidate.id !== mediaId)];
      mediaPlacementDefaults = { alt, caption, teachingUse };
      activeDialog = "media";
      render();
    } catch (error) {
      console.error("Unable to upload media.", error);
      update(error instanceof Error ? error.message : "The media upload failed.", true);
      submit?.removeAttribute("disabled");
    }
  });
  app.querySelector<HTMLFormElement>("[data-media-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault(); const values = new FormData(event.currentTarget); const item = mediaItems[Number(values.get("mediaIndex"))]; const anchor = selectedBlock();
    if (!item || !anchor || !dataSource) { setState("attention"); return; }
    const placement = { mediaId: String(item.id), mediaVersionId: String(item.media_version_id), rightsCaseId: String(item.rights_case_id), anchorPassageId: selectedPassage, decorative: false, alt: String(values.get("alt") ?? "").trim(), caption: String(values.get("caption") ?? "").trim(), teachingUse: String(values.get("teachingUse") ?? "").trim(), displayPreset: String(values.get("displayPreset") ?? "reading"), align: "center", animationPolicy: "clickToPlay", printPolicy: "poster", downloadable: false };
    if (!placement.alt || !placement.caption || !placement.teachingUse) { setState("attention"); return; }
    await applyDraftOperations([{ type: "media.place", placement, position: { afterBlockId: anchor.blockId } }]); mediaPlacementDefaults = { alt: "", caption: "", teachingUse: "" }; activeDialog = null; setState("dirty");
  });
  app.querySelector<HTMLFormElement>("[data-embed-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault(); const values = new FormData(event.currentTarget); const url = String(values.get("url") ?? "").trim(); const title = String(values.get("title") ?? "").trim(); const teachingUse = String(values.get("teachingUse") ?? "").trim(); const anchor = selectedBlock();
    if (!dataSource || !anchor || !/^https:\/\//.test(url) || !title || !teachingUse) { setState("attention"); return; }
    try {
      const resolved = await dataSource.resolveEmbed({ url }); const proposal = resolved.proposal as Record<string, unknown>; const accessedAt = new Date().toISOString().slice(0, 10);
      const embed = proposal.kind === "externalEmbed" ? { kind: "externalEmbed", identity: proposal.identity, canonicalUrl: proposal.canonicalUrl, caption: title, teachingUse, displayPreset: "reading", theme: "auto", fallback: { title, summary: teachingUse, linkLabel: "Open source", accessedAt }, adapterVersion: proposal.adapterVersion } : { kind: "richLink", canonicalUrl: proposal.canonicalUrl ?? url, title, summary: teachingUse, teachingUse, linkLabel: "Open source", accessedAt };
      await applyDraftOperations([{ type: "embed.upsert", embed, position: { afterBlockId: anchor.blockId } }]); activeDialog = null; setState("dirty");
    } catch (error) { console.error(error); setState("attention"); }
  });
  const applyReplacement = async (form: HTMLFormElement) => {
    const paragraphs = String(new FormData(form).get("body") ?? "").split(/\n{2,}/).map((text) => text.trim()).filter(Boolean);
    if (!paragraphs.length) { setState("attention"); return; }
    if (dataSource) {
      try { await applyDraftOperations([{ type: "chapter.importPlainText", paragraphs }]); selectedPassage = nearestPassage(chapter); activeDialog = null; setState("dirty"); }
      catch (error) { console.error("Unable to import the chapter.", error); setState("attention"); }
      return;
    }
    const editable = chapter.body.filter((block) => ["paragraph", "heading", "blockquote", "list", "callout"].includes(block.type));
    chapter.body = paragraphs.map((text, index) => ({ type: "paragraph", blockId: editable[index]?.blockId ?? newId("block"), passageId: blockPassage(editable[index] ?? { type: "paragraph", blockId: "" }) || newId("passage"), text })); selectedPassage = blockPassage(chapter.body[0]); activeDialog = null; setState("dirty");
  };
  const applySource = async (form: HTMLFormElement) => {
    try {
      const parsed = JSON.parse(String(new FormData(form).get("source") ?? "")) as ChapterDocument;
      if (!parsed || !Array.isArray(parsed.body) || !Array.isArray(parsed.checkpoints) || !Array.isArray(parsed.managedPlacements) || !Array.isArray(parsed.personFeatures)) throw new Error("Structured source is missing required chapter collections.");
      parsed.documentId = chapter.documentId; parsed.chapterId = chapter.chapterId; parsed.slug = chapter.slug; parsed.changeSetId = chapter.changeSetId; parsed.revisionId = chapter.revisionId; parsed.baseRevisionId = chapter.baseRevisionId; parsed.expectedVersion = chapter.expectedVersion;
      if (dataSource) await applyDraftOperations([chapterReplaceOperation(parsed)]);
      else chapter = parsed;
      activeDialog = null; setState("dirty");
    } catch (error) { console.error("Unable to apply structured source.", error); setState("attention"); }
  };
  app.querySelector<HTMLButtonElement>("[data-apply-replacement]")?.addEventListener("click", () => { const form = app.querySelector<HTMLFormElement>("[data-replace-form]"); if (form) void applyReplacement(form); });
  app.querySelector<HTMLButtonElement>("[data-apply-source]")?.addEventListener("click", () => { const form = app.querySelector<HTMLFormElement>("[data-source-form]"); if (form) void applySource(form); });
  app.querySelector<HTMLFormElement>("[data-replace-form]")?.addEventListener("submit", (event) => { event.preventDefault(); void applyReplacement(event.currentTarget); });
  app.querySelector<HTMLFormElement>("[data-leave-form]")?.addEventListener("submit", async (event) => { event.preventDefault(); if (await save()) window.location.assign(`${returnUrl}#${publicAnchor(selectedPassage)}`); });
  app.querySelector<HTMLButtonElement>("[data-discard]")?.addEventListener("click", () => { sessionStorage.removeItem(recoveryKey()); window.location.assign(`${returnUrl}#${publicAnchor(selectedPassage)}`); });
  const applyCheckpointInspector = async (formElement: HTMLFormElement, shift = 0) => {
    if (!formElement.reportValidity() || !inspector || inspector.kind !== "checkpoint") return;
    const item = chapter.checkpoints.find((checkpoint) => checkpoint.checkpointId === inspector.id);
    if (!item) return;
    const form = new FormData(formElement);
    const requestedPassage = nearestPassage(chapter, String(form.get("passageId") ?? item.passageId));
    const passageText = checkpointExcerpt(checkpointAnchorBlock(chapter, requestedPassage));
    const excerptHash = requestedPassage === item.passageId ? undefined : await sha256Text(passageText);
    item.title = String(form.get("title") ?? ""); item.prompt = String(form.get("prompt") ?? ""); item.guidance = String(form.get("guidance") ?? "");
    const stage = String(form.get("stage") ?? "").trim(); if (stage) item.stage = stage; else delete item.stage;
    moveCheckpoint(chapter, item.checkpointId, requestedPassage, Number(form.get("displayOrder") ?? 0) + shift, excerptHash);
    selectedPassage = item.passageId; setState(item.title && item.prompt ? "dirty" : "attention");
  };
  app.querySelector<HTMLFormElement>("[data-inspector-form]")?.addEventListener("submit", (event) => { event.preventDefault(); void applyCheckpointInspector(event.currentTarget).catch((error) => { console.error("Unable to update checkpoint.", error); setState("attention"); }); });
  app.querySelectorAll<HTMLButtonElement>("[data-shift-checkpoint]").forEach((button) => button.addEventListener("click", () => { const form = app.querySelector<HTMLFormElement>("[data-inspector-form]"); if (form) void applyCheckpointInspector(form, Number(button.dataset.shiftCheckpoint ?? 0)).catch((error) => { console.error("Unable to reorder checkpoint.", error); setState("attention"); }); }));
  app.querySelectorAll<HTMLButtonElement>("[data-remove-checkpoint]").forEach((button) => button.addEventListener("click", () => { chapter.checkpoints = chapter.checkpoints.filter((item) => item.checkpointId !== button.dataset.removeCheckpoint); inspector = { kind: "chapter" }; setState("dirty"); }));
  app.querySelectorAll<HTMLButtonElement>("[data-remove-placement]").forEach((button) => button.addEventListener("click", () => { chapter.managedPlacements = chapter.managedPlacements.filter((item) => item.placementId !== button.dataset.removePlacement); inspector = { kind: "chapter" }; setState("dirty"); }));
  app.querySelector<HTMLSelectElement>("[data-placement-preset]")?.addEventListener("change", (event) => { const select = event.currentTarget; const placement = chapter.managedPlacements.find((item) => item.placementId === select.dataset.placementPreset); if (placement) { placement.displayPreset = select.value as typeof placement.displayPreset; setState("dirty"); } });
}

async function ensureOpenChangeset() {
  if (!dataSource || chapter.changeSetId) return;
  const session = await dataSource.createOrResumeChangeset(chapter.documentId, { title: `Edit ${chapter.title}`, description: "Continuous instructor authoring session", resume: true, idempotencyKey: changeSetRequestKey });
  chapter.changeSetId = session.id; chapter.baseRevisionId = session.baseRevisionId ?? chapter.revisionId; chapter.expectedVersion = session.version ?? 1;
  if (session.chapter) chapter = chapterFromAuthoringView({ chapter: session.chapter, documentId: chapter.documentId, changeSetId: session.id, revisionId: chapter.revisionId, baseRevisionId: chapter.baseRevisionId, expectedVersion: chapter.expectedVersion }, chapter);
}

async function applyDraftOperations(operations: Array<Record<string, unknown>>) {
  if (!dataSource) throw new Error("The content API is required for typed draft operations.");
  await ensureOpenChangeset();
  const result = await dataSource.applyOperationBatch(chapter.changeSetId, { documentId: chapter.documentId, baseRevisionId: chapter.baseRevisionId, expectedVersion: chapter.expectedVersion, idempotencyKey: crypto.randomUUID(), operations });
  chapter = hydrateManagedMediaPreviews(chapterFromAuthoringView({ chapter: result.chapter, documentId: chapter.documentId, changeSetId: chapter.changeSetId, revisionId: chapter.revisionId, baseRevisionId: chapter.baseRevisionId, expectedVersion: result.version }, chapter));
  selectedPassage = nearestPassage(chapter, selectedPassage);
  render();
}

async function waitForDelivery(result: CommitLiveResult) {
  if (result.live || result.deliveryStatus === "verified") return true;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    if (!dataSource) return true;
    const status = await dataSource.getLiveCommitStatus(result.commitReceiptId) as Partial<CommitLiveResult>;
    if (status.live || status.deliveryStatus === "verified") return true;
  }
  return false;
}

async function save(): Promise<boolean> {
  if (saveState === "saving") return false;
  const invalid = chapter.checkpoints.some((item) => !item.title.trim() || !item.prompt.trim());
  if (invalid) { setState("attention"); return false; }
  setState("saving");
  try {
    let result: CommitLiveResult;
    if (dataSource) {
      await ensureOpenChangeset();
      pendingCommitKey ??= crypto.randomUUID();
      saveRecovery();
      result = await dataSource.commitLive({ changeSetId: chapter.changeSetId, documentId: chapter.documentId, baseRevisionId: chapter.baseRevisionId, expectedVersion: chapter.expectedVersion, idempotencyKey: pendingCommitKey, operations: [chapterReplaceOperation(chapter)] });
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      result = { commitReceiptId: `commit_local_${Date.now()}`, changeSetId: chapter.changeSetId, documentId: chapter.documentId, revisionId: `revision_local_${Date.now()}`, contentHash: "local", projectionId: "projection_local", projectionHash: "local", publicUrl: `${publicOrigin}/chapter/${chapter.slug}/`, deliveryStatus: "verified", statusUrl: "", statusExpiresAt: "", committed: true, live: true, noOp: false };
    }
    chapter.revisionId = result.revisionId; chapter.baseRevisionId = result.revisionId; chapter.expectedVersion += 1;
    lastSavedAt = new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date()); sessionStorage.removeItem(recoveryKey()); pendingCommitKey = null; changeSetRequestKey = crypto.randomUUID(); chapter.changeSetId = ""; chapter.expectedVersion = 1; setState("saved");
    // Public delivery verification is an integrity check, not another author
    // workflow step. Save is complete once the atomic live commit succeeds.
    void waitForDelivery(result).then((verified) => {
      if (!verified) console.warn("The chapter was saved, but public delivery confirmation did not arrive before the status window ended.");
    });
    return true;
  } catch (error) {
    console.error(error);
    if (error instanceof AuthoringApiError && error.status === 401) {
      saveRecovery(); const start = new URL("/auth/start", authOrigin); start.searchParams.set("chapter", requestedSlug); start.searchParams.set("mode", "edit"); if (selectedPassage) start.searchParams.set("anchor", selectedPassage); window.location.assign(start.toString());
    } else setState("attention");
    return false;
  }
}

function done() {
  if (saveState === "dirty" || saveState === "attention" || saveState === "pending" || saveState === "saving") { activeDialog = "leave"; render(); return; }
  window.location.assign(`${returnUrl}#${publicAnchor(selectedPassage)}`);
}

function escapeText(value: string) { return value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] ?? character); }
function escapeAttribute(value: string) { return escapeText(value).replaceAll('"', "&quot;"); }

if (agentAccessRequestId) void loadAgentAccess(agentAccessRequestId);
else {
  render();
  if (reviewChangeSetId) void loadCutoverReview(reviewChangeSetId);
  else void loadChapter();
}
