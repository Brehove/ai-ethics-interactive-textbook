import { Editor, Extension, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Plugin } from "@tiptap/pm/state";
import { renderOrderedNode } from "@ai-ethics/chapter-renderer";
import { blockPassage, newId, type ChapterBlock, type ChapterDocument, type ProseBlock } from "./editor-model";

type ManagedAttrs = { placementId: string; kind: string; html: string; sourceBlockId?: string };

const ManagedNode = Node.create({
  name: "managedNode", group: "block", atom: true, selectable: true, draggable: false,
  addAttributes() { return { placementId: { default: "" }, kind: { default: "managed" }, html: { default: "" }, sourceBlockId: { default: null } }; },
  parseHTML() { return [{ tag: "section[data-tiptap-managed]" }]; },
  renderHTML({ HTMLAttributes }) { return ["section", { ...HTMLAttributes, "data-tiptap-managed": "true", class: "managed-node" }]; },
  addNodeView() { return ({ node, getPos, editor }) => {
    const attrs = node.attrs as ManagedAttrs; const dom = document.createElement("section");
    dom.className = "managed-node"; dom.tabIndex = 0; dom.dataset.managedNode = ""; dom.dataset.managedId = attrs.placementId; dom.dataset.managedKind = attrs.kind;
    dom.setAttribute("aria-label", `${attrs.kind} managed content. Select to inspect.`); dom.innerHTML = `<span class="managed-node__label">${attrs.kind}</span>${attrs.html}`;
    dom.addEventListener("click", (event) => { event.preventDefault(); editor.commands.setNodeSelection(getPos()); dom.dispatchEvent(new CustomEvent("instructor-managed-select", { bubbles: true, detail: { placementId: attrs.placementId, kind: attrs.kind } })); });
    return { dom };
  }; },
});

const ProtectedManagedNodes = Extension.create({
  name: "protectedManagedNodes",
  addProseMirrorPlugins() {
    const managedIds = (doc: { descendants: (callback: (node: { type: { name: string }; attrs: Record<string, unknown> }) => void) => void }) => {
      const ids: string[] = [];
      doc.descendants((node) => { if (node.type.name === "managedNode") ids.push(String(node.attrs.placementId)); });
      return ids.sort().join("\u0000");
    };
    return [new Plugin({ filterTransaction(transaction, state) {
      if (!transaction.docChanged || transaction.getMeta("allowManagedMutation") === true) return true;
      return managedIds(state.doc) === managedIds(transaction.doc);
    } })];
  },
});

const StableIds = Extension.create({
  name: "stableIds",
  addGlobalAttributes() { return [{ types: ["paragraph", "heading", "blockquote"], attributes: { blockId: { default: null, parseHTML: (element: HTMLElement) => element.getAttribute("data-block-id"), renderHTML: (attributes: Record<string, string | null>) => attributes.blockId ? { "data-block-id": attributes.blockId } : {} }, passageId: { default: null, parseHTML: (element: HTMLElement) => element.getAttribute("data-passage-id"), renderHTML: (attributes: Record<string, string | null>) => attributes.passageId ? { "data-passage-id": attributes.passageId } : {} } } }]; },
});

function textContent(text = "") { return text ? [{ type: "text", text }] : []; }
const isProse = (block: ChapterBlock): block is ProseBlock => ["paragraph", "heading", "blockquote", "list", "callout"].includes(block.type);
function proseNode(block: ProseBlock) {
  const attrs = { blockId: block.blockId, passageId: blockPassage(block) || null };
  if (block.type === "heading") return { type: "heading", attrs: { ...attrs, level: Number(block.level ?? 2) }, content: textContent(block.text) };
  if (block.type === "blockquote") return { type: "blockquote", attrs, content: [{ type: "paragraph", attrs, content: textContent(block.text) }] };
  if (block.type === "list") return { type: block.ordered ? "orderedList" : "bulletList", content: (block.items ?? []).map((item) => ({ type: "listItem", content: [{ type: "paragraph", attrs, content: textContent(item) }] })) };
  return { type: "paragraph", attrs, content: textContent(block.text) };
}

function managedNodes(chapter: ChapterDocument, passageId: string, position: "before" | "after" = "after") {
  const placements = chapter.managedPlacements.filter((placement) => placement.anchorPassageId === passageId && placement.position === position).sort((a, b) => a.orderAtAnchor - b.orderAtAnchor).map((placement) => {
    const feature = placement.kind === "personFeature" ? chapter.personFeatures.find((item) => item.personFeatureId === placement.contentId) : undefined;
    const block = (chapter.managedContent as Record<string, Record<string, unknown>> | undefined)?.[placement.contentId];
    const node = feature ? { kind: "personFeature" as const, value: { ...feature, ...placement } } : { kind: "block" as const, value: block ?? { type: placement.kind === "media" ? "mediaFigure" : "externalEmbed", blockId: placement.placementId, title: "Managed content preview", caption: "Typed placement preview" } };
    return { type: "managedNode", attrs: { placementId: placement.placementId, kind: placement.kind === "personFeature" ? "Person feature" : placement.kind === "media" ? "Media" : "Embed", html: renderOrderedNode(node, { context: "editor", publicOrigin: location.origin }) } };
  });
  const checkpoints = position === "after" ? chapter.checkpoints.filter((checkpoint) => checkpoint.passageId === passageId).sort((a, b) => a.displayOrder - b.displayOrder).map((checkpoint) => ({ type: "managedNode", attrs: { placementId: checkpoint.checkpointId, kind: "Checkpoint", html: renderOrderedNode({ kind: "checkpoint", value: checkpoint }, { context: "editor" }) } })) : [];
  return [...placements, ...checkpoints];
}

export function mountTiptap(element: HTMLElement, chapter: ChapterDocument, onChange: (body: ChapterBlock[]) => void, onManagedSelect: (placementId: string) => void, onPassageSelect: (passageId: string) => void) {
  const content: Record<string, unknown>[] = [];
  for (const block of chapter.body) {
    if (!isProse(block)) {
      content.push({ type: "managedNode", attrs: { placementId: block.blockId, sourceBlockId: block.blockId, kind: block.type === "mediaFigure" ? "Media" : block.type === "legacyMarkup" ? "Locked legacy content" : "Embed", html: renderOrderedNode({ kind: "block", value: block }, { context: "editor", publicOrigin: location.origin }) } });
      continue;
    }
    content.push(...managedNodes(chapter, blockPassage(block), "before")); content.push(proseNode(block)); content.push(...managedNodes(chapter, blockPassage(block), "after"));
  }
  const reportPassage = (active: Editor) => {
    const { $from } = active.state.selection;
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      const passageId = String($from.node(depth).attrs?.passageId ?? "");
      if (passageId) { onPassageSelect(passageId); return; }
    }
  };
  const editor = new Editor({ element, extensions: [StarterKit.configure({ heading: { levels: [2, 3, 4] } }), StableIds, ManagedNode, ProtectedManagedNodes], content: { type: "doc", content }, editorProps: { attributes: { class: "chapter-document ProseMirror", "aria-label": "Continuous chapter document" } }, onUpdate: ({ editor: active }) => { onChange(serializeBody(active.getJSON(), chapter.body)); reportPassage(active); }, onSelectionUpdate: ({ editor: active }) => reportPassage(active) });
  element.addEventListener("instructor-managed-select", ((event: CustomEvent<{ placementId: string }>) => onManagedSelect(event.detail.placementId)) as EventListener);
  return editor;
}

export function serializeBody(json: Record<string, unknown>, previous: ChapterBlock[]): ChapterBlock[] {
  const previousById = new Map(previous.map((block) => [block.blockId, block])); const result: ChapterBlock[] = [];
  const visit = (node: Record<string, unknown>) => {
    const content = Array.isArray(node.content) ? node.content as Record<string, unknown>[] : [];
    if (node.type === "managedNode") { const sourceBlockId = String(((node.attrs ?? {}) as Record<string, unknown>).sourceBlockId ?? ""); const preserved = previousById.get(sourceBlockId); if (preserved) result.push(structuredClone(preserved)); return; }
    if (node.type === "paragraph" || node.type === "heading" || node.type === "blockquote") {
      const attrs = (node.attrs ?? {}) as Record<string, unknown>; const blockId = String(attrs.blockId ?? newId("block")); const passageId = String(attrs.passageId ?? previousById.get(blockId)?.passageId ?? newId("passage")); const text = content.map((item) => String(item.text ?? "")).join("");
      result.push(node.type === "heading" ? { type: "heading", blockId, sectionId: previousById.get(blockId)?.sectionId ?? newId("section"), anchorPassageId: passageId, level: Number(attrs.level ?? 2), text } : { type: node.type as "paragraph" | "blockquote", blockId, passageId, text }); return;
    }
    if (node.type === "bulletList" || node.type === "orderedList") { const firstParagraph = content[0]?.content as Record<string, unknown>[] | undefined; const attrs = (firstParagraph?.[0]?.attrs ?? {}) as Record<string, unknown>; const blockId = String(attrs.blockId ?? newId("block")); const passageId = String(attrs.passageId ?? newId("passage")); result.push({ type: "list", blockId, passageId, ordered: node.type === "orderedList", items: content.map((item) => ((item.content as Record<string, unknown>[] | undefined)?.[0]?.content as Record<string, unknown>[] | undefined)?.map((part) => String(part.text ?? "")).join("") ?? "") }); return;
    }
    content.forEach(visit);
  };
  (Array.isArray(json.content) ? json.content as Record<string, unknown>[] : []).forEach(visit); return result;
}
