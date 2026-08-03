import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("editor shell exposes the structured authoring workflow", async () => {
  const [page, shell, css, externalEmbed, placements, richLink, nativeMedia] = await Promise.all([
    readFile(new URL("../../src/pages/admin/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/editor/EditorShell.astro", import.meta.url), "utf8"),
    readFile(new URL("../../src/styles/editor.css", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/media/ExternalEmbed.astro", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/media/InlineReleasePlacements.astro", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/media/RichLinkCard.astro", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/media/NativeMedia.astro", import.meta.url), "utf8"),
  ]);
  assert.match(page, /noindex/);
  for (const label of ["Preview", "Review changes", "Validate", "Submit review", "Human release review", "Approve release snapshot", "Reject this snapshot", "Checkpoints", "Add checkpoint", "Save checkpoint", "Remove checkpoint", "Save text change", "Image or GIF", "YouTube", "Vimeo", "X post", "Spotify", "SoundCloud", "Bluesky", "Audio/Video", "PDF", "Link card", "Semantic review", "Authored fallback"]) assert.match(shell, new RegExp(label.replace("/", "\\/")));
  assert.match(shell, /Browse all 18 chapters here\. Chapter 7 is the writable canary/);
  assert.doesNotMatch(shell, /disabled=\{chapter\.order !== 7\}/);
  assert.match(shell, /chapter\.order === 7 \? "editable canary" : "read-only until cutover"/);
  assert.match(shell, /aria-controls="editor-navigation-items"/);
  assert.match(shell, /aria-controls="media-insert-choices"/);
  assert.match(shell, /PUBLIC_CONTENT_API_ORIGIN|contentApiOrigin/);
  assert.match(shell, /Read-only\/offline/);
  assert.match(shell, /\/v1\/documents\/\$\{encodeURIComponent\(selectedChapterId\)\}/);
  assert.match(shell, /\/v1\/schema/);
  assert.match(shell, /\/v1\/chapters\/\$\{encodeURIComponent\(selectedChapterId\)\}\/changesets/);
  assert.match(shell, /\/v1\/changesets\/\$\{encodeURIComponent\(changeSetId\)\}:apply/);
  assert.match(shell, /checkpoint\.upsert/);
  assert.match(shell, /checkpoint\.remove[\s\S]*slot[\s\S]*checkpointId/);
  assert.match(shell, /text\.replace[\s\S]*blockId[\s\S]*text/);
  assert.match(shell, /media\.place[\s\S]*placement[\s\S]*mediaId[\s\S]*mediaVersionId[\s\S]*rightsCaseId/);
  assert.match(shell, /type="file"[\s\S]*data-media-file/);
  assert.match(shell, /Use existing reviewed asset IDs[\s\S]*Advanced option for agent-prepared media/);
  assert.match(shell, /Rights declaration[\s\S]*Editorial declaration[\s\S]*Accessibility declaration/);
  for (const field of ["basis", "creator", "sourceUrl", "license", "attribution", "teachingUse", "placementIntent", "decorative", "altText", "motionReview", "transcriptEquivalent"]) assert.match(shell, new RegExp(field));
  assert.match(shell, /Create pending review package[\s\S]*Pending is not clearance[\s\S]*Clear exact package[\s\S]*Block exact package/);
  assert.match(shell, /\/v1\/media-review-packages[\s\S]*state !== "pending"[\s\S]*declarationHash/);
  assert.match(shell, /\/v1\/media-review-packages\/\$\{encodeURIComponent\(activeReviewPackageId\)\}:decide[\s\S]*declarationHash:[\s\S]*decision,[\s\S]*comment,[\s\S]*idempotencyKey: key\(\)/);
  assert.match(shell, /Required decision comment/);
  assert.doesNotMatch(shell, /<textarea[^>]+data-review-package(?:\s|>)/);
  assert.doesNotMatch(shell, /JSON\.parse\(reviewPackage|rightsReviewId|editorialReviewId|accessibilityReviewId/);
  assert.match(shell, /\/v1\/media:requestUpload/);
  for (const field of ["filename", "mimeType", "bytes", "sha256", "transcriptEquivalent", "poster", "reviewPackageId"]) assert.match(shell, new RegExp(field));
  assert.match(shell, /Search reusable media[\s\S]*Kind[\s\S]*Rights[\s\S]*Search library/);
  assert.match(shell, /fetch\(`\$\{gatewayOrigin\}\/v1\/media\?\$\{query\}`[\s\S]*item\.title[\s\S]*item\.rights_status[\s\S]*item\.media_version_id/);
  assert.match(shell, /Enter exact IDs manually[\s\S]*Advanced recovery/);
  assert.match(shell, /crypto\.subtle\.digest\("SHA-256", await file\.arrayBuffer\(\)\)/);
  assert.match(shell, /ticket\.upload\.path[\s\S]*method: "PUT"[\s\S]*ticket\.upload\.requiredHeaders[\s\S]*"X-Editor-CSRF": csrfToken[\s\S]*body: file/);
  assert.match(shell, /\/v1\/media\/jobs\/\$\{encodeURIComponent\(ticket\.jobId\)\}/);
  assert.match(shell, /const delays = \[500, 750, 1000, 1500, 2000, 3000, 4000, 4000, 4000\]/);
  assert.match(shell, /job\.state === "ready"[\s\S]*mediaId\.value[\s\S]*mediaVersionId\.value[\s\S]*rightsCaseId\.value/);
  assert.match(shell, /pending[\s\S]*reviewRequired[\s\S]*do not clear or approve/);
  assert.match(shell, /image\/gif/);
  assert.match(shell, /GIF remains animated media[\s\S]*click-to-play/);
  assert.match(shell, /embed\.upsert[\s\S]*externalEmbed[\s\S]*identity/);
  assert.match(shell, /providerDefinition[\s\S]*resourceType[\s\S]*resourceId/);
  for (const provider of ["spotify", "soundcloud", "bluesky"]) assert.match(shell, new RegExp(`provider: "${provider}"`));
  assert.match(shell, /safePublicUrl[\s\S]*url\.protocol !== "https:"[\s\S]*url\.username[\s\S]*url\.password[\s\S]*url\.port/);
  assert.match(shell, /Spotify[\s\S]*fallback first[\s\S]*explicitly choose whether to contact Spotify/);
  assert.match(shell, /SoundCloud[\s\S]*safe link-first card[\s\S]*never loads a SoundCloud widget/);
  assert.match(shell, /Bluesky[\s\S]*safe link-first card[\s\S]*never loads a Bluesky widget/);
  assert.match(shell, /Link card[\s\S]*never fetches arbitrary page metadata or active HTML/);
  assert.match(shell, /embed\.upsert[\s\S]*richLink/);
  assert.match(shell, /position[\s\S]*afterBlockId/);
  assert.match(shell, /fallback[\s\S]*linkLabel[\s\S]*accessedAt[\s\S]*adapterVersion/);
  assert.match(shell, /:validate/);
  assert.match(shell, /:submitReview[\s\S]*snapshotHash/);
  assert.match(shell, /data-human-review hidden[\s\S]*data-snapshot-hash[\s\S]*data-snapshot-revision/);
  assert.match(shell, /Approval does not publish[\s\S]*Final promotion remains GitHub-gated/);
  assert.match(shell, /recordReleaseDecision\(decision: "approve" \| "reject"\)[\s\S]*:\$\{decision\}`[\s\S]*snapshotHash: submittedSnapshotHash[\s\S]*snapshotRevision: submittedSnapshotRevision[\s\S]*decisionKind: "release"[\s\S]*comment[\s\S]*idempotencyKey: key\(\)/);
  assert.match(shell, /approveRelease\.addEventListener[\s\S]*recordReleaseDecision\("approve"\)[\s\S]*rejectRelease\.addEventListener[\s\S]*recordReleaseDecision\("reject"\)/);
  assert.match(shell, /X-Editor-CSRF/);
  for (const field of ["baseRevisionId", "expectedVersion", "idempotencyKey", "passageId", "passageExcerptHash", "slot", "stage", "strategy", "title", "trigger", "prompt", "guidance", "responseStructure", "minWords", "maxWords", "rationale", "showInSidebar"]) assert.match(shell, new RegExp(field));
  assert.match(shell, /data\.version/);
  assert.match(shell, /data\.chapter/);
  assert.match(shell, /canonicalChapter = structuredClone\(documentData\.chapter\)/);
  assert.match(shell, /function renderSemanticReview\(\)/);
  assert.match(shell, /No semantic differences from canonical \$\{chapter\.title \?\? selectedChapterId\}/);
  for (const blockType of ["list", "table", "codeBlock", "callout", "mediaFigure", "externalEmbed", "richLink", "diagram", "legacyMarkup"]) assert.match(shell, new RegExp(`block\\.type === \\\"${blockType}\\\"|\\[\\\"mediaFigure\\\", \\\"externalEmbed\\\", \\\"richLink\\\", \\\"diagram\\\"\\]`));
  assert.doesNotMatch(shell, /slice\(headingIndex, headingIndex \+ 8\)/);
  assert.match(shell, /Semantic changes[\s\S]*Working version/);
  assert.doesNotMatch(shell, /No agent proposals|data-agent-tab|Auto-apply agent changes/);
  assert.match(shell, /Nothing entered here will be persisted/);
  assert.doesNotMatch(shell, /saved only in this browser|stored in this browser|media\.insert|media\.add|responseFormat|pending typed-embed|X-CSRF-Token|rightsReviewId:\s*["'][^"']+["']/);
  assert.doesNotMatch(shell, /:publish/);
  assert.doesNotMatch(shell, /innerHTML/);
  assert.match(page, /localhost/);
  assert.match(page, /Cache-Control", "no-store/);
  assert.match(css, /@media \(max-width:1100px\)/);
  assert.match(css, /max-height:calc\(100dvh - 16px\)/);
  assert.match(css, /top-actions button\{flex:0 0 auto;min-width:44px;min-height:44px/);
  assert.doesNotMatch(css, /top-actions button span\{display:none\}/);
  assert.match(css, /mobile-nav-toggle\{display:block;min-height:44px/);
  assert.match(css, /media-inspector \[hidden\]\{display:none!important\}/);
  assert.match(css, /--editor-canvas:#fff/);

  assert.match(externalEmbed, /provider: "youtube" \| "vimeo" \| "x" \| "spotify"/);
  assert.match(externalEmbed, /frame-src https:\/\/open\.spotify\.com/);
  assert.match(externalEmbed, /Load Spotify player/);
  assert.match(externalEmbed, /https:\/\/open\.spotify\.com\/embed\/\$\{definition\.identity\.resourceType\}\/\$\{definition\.identity\.resourceId\}/);
  assert.match(externalEmbed, /button\.addEventListener\("click"[\s\S]*player\.append\(iframeFor\(definition\)\)/);
  assert.doesNotMatch(externalEmbed, /<iframe|open\.spotify\.com\/embed[^`]*src=/);
  assert.match(placements, /\["youtube", "vimeo", "x", "spotify"\]/);
  assert.match(placements, /\["soundcloud", "bluesky"\][\s\S]*RichLinkCard/);
  assert.match(placements, /Opening this link contacts \$\{providerName\}[\s\S]*does not load a \$\{providerName\} widget automatically/);
  assert.match(placements, /item\.type === "richLink"[\s\S]*linkLabel: item\.linkLabel[\s\S]*teachingUse: item\.teachingUse/);
  assert.match(richLink, /data-rich-link-card[\s\S]*data-provider/);
  assert.match(richLink, /target="_blank" rel="noopener noreferrer"/);
  assert.match(richLink, /card\.linkLabel \?\? "Open source"/);
  assert.match(nativeMedia, /Video media requires a dedicated poster frame/);
  assert.match(nativeMedia, /native-media__print-poster/);
  assert.match(nativeMedia, /native-media__transcript > :not\(summary\)[\s\S]*display: block !important/);
  assert.match(`${nativeMedia}\n${externalEmbed}\n${richLink}`, /Canonical URL/);
  assert.doesNotMatch(`${placements}\n${richLink}`, /fetch\(|oembed|innerHTML|<iframe|<script[^>]+src=/i);
});
