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

type InlineMark = { type: "bold" | "italic" | "underline" | "link"; attrs?: { href: string } };
type InlineNode = { type: "text"; text: string; marks?: InlineMark[] };

const inlineToken = /\[([^\]]+)\]\(((?:https:\/\/|\/(?!\/)|#)[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|\+\+([^+]+)\+\+/g;

/** Convert the contract's safe inline-Markdown subset into visible Tiptap marks. */
export function inlineContent(text = "", inherited: InlineMark[] = []): InlineNode[] {
  if (!text) return [];
  const nodes: InlineNode[] = [];
  let cursor = 0;
  // Recursion handles combined marks inside link labels. Each level therefore
  // needs its own regex cursor rather than sharing the module-level instance.
  const tokenizer = new RegExp(inlineToken.source, "g");
  for (let match = tokenizer.exec(text); match; match = tokenizer.exec(text)) {
    if (match.index > cursor) nodes.push({ type: "text", text: text.slice(cursor, match.index), ...(inherited.length ? { marks: inherited } : {}) });
    if (match[1] !== undefined && match[2] !== undefined) nodes.push(...inlineContent(match[1], [...inherited, { type: "link", attrs: { href: match[2] } }]));
    else if (match[3] !== undefined) nodes.push(...inlineContent(match[3], [...inherited, { type: "bold" }]));
    else if (match[4] !== undefined) nodes.push(...inlineContent(match[4], [...inherited, { type: "italic" }]));
    else if (match[5] !== undefined) nodes.push(...inlineContent(match[5], [...inherited, { type: "underline" }]));
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push({ type: "text", text: text.slice(cursor), ...(inherited.length ? { marks: inherited } : {}) });
  return nodes;
}

const inlineChildren = (node: Record<string, unknown>) => Array.isArray(node.content) ? node.content as Record<string, unknown>[] : [];

/** Serialize visual Tiptap marks back to the same safe contract syntax. */
export function inlineMarkdown(content: Record<string, unknown>[] = []): string {
  const marksOf = (node: Record<string, unknown>) => Array.isArray(node.marks) ? node.marks as Array<Record<string, unknown>> : [];
  const sameMark = (left: Record<string, unknown> | undefined, right: Record<string, unknown> | undefined) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  const wrap = (mark: Record<string, unknown>, value: string) => {
    if (mark.type === "underline") return `++${value}++`;
    if (mark.type === "bold") return `**${value}**`;
    if (mark.type === "italic") return `*${value}*`;
    if (mark.type === "link") {
      const href = String((mark.attrs as Record<string, unknown> | undefined)?.href ?? "");
      return /^https:\/\//.test(href) || /^\/(?!\/)/.test(href) || /^#[A-Za-z][A-Za-z0-9:_-]*$/.test(href) ? `[${value}](${href})` : value;
    }
    return value;
  };
  const serializeRange = (nodes: Record<string, unknown>[], depth: number): string => {
    let rendered = "";
    for (let index = 0; index < nodes.length;) {
      const node = nodes[index];
      const mark = marksOf(node)[depth];
      if (!mark) {
        rendered += node.type === "hardBreak" ? "\n" : node.type === "text" ? String(node.text ?? "") : inlineMarkdown(inlineChildren(node));
        index += 1;
        continue;
      }
      let end = index + 1;
      while (end < nodes.length && sameMark(marksOf(nodes[end])[depth], mark)) end += 1;
      rendered += wrap(mark, serializeRange(nodes.slice(index, end), depth + 1));
      index = end;
    }
    return rendered;
  };
  return serializeRange(content, 0);
}

const isProse = (block: ChapterBlock): block is ProseBlock => ["paragraph", "heading", "blockquote", "list", "callout"].includes(block.type);
function proseNode(block: ProseBlock) {
  const attrs = { blockId: block.blockId, passageId: blockPassage(block) || null };
  if (block.type === "heading") return { type: "heading", attrs: { ...attrs, level: Number(block.level ?? 2) }, content: inlineContent(block.text) };
  if (block.type === "blockquote") return { type: "blockquote", attrs, content: [{ type: "paragraph", attrs, content: inlineContent(block.text) }] };
  if (block.type === "list") return { type: block.ordered ? "orderedList" : "bulletList", content: (block.items ?? []).map((item) => ({ type: "listItem", content: [{ type: "paragraph", attrs, content: inlineContent(item) }] })) };
  return { type: "paragraph", attrs, content: inlineContent(block.text) };
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
      const attrs = (node.attrs ?? {}) as Record<string, unknown>; const blockId = String(attrs.blockId ?? newId("block")); const previousBlock = previousById.get(blockId); const passageId = String(attrs.passageId ?? previousBlock?.passageId ?? newId("passage")); const text = node.type === "blockquote" ? inlineMarkdown(inlineChildren(content[0] ?? {})) : inlineMarkdown(content);
      if (node.type === "heading") result.push({ type: "heading", blockId, sectionId: previousBlock?.sectionId ?? newId("section"), anchorPassageId: passageId, level: Number(attrs.level ?? 2), text });
      else if (node.type === "paragraph" && previousBlock?.type === "callout") result.push({ ...previousBlock, passageId, text });
      else result.push({ type: node.type as "paragraph" | "blockquote", blockId, passageId, text });
      return;
    }
    if (node.type === "bulletList" || node.type === "orderedList") { const firstParagraph = content[0]?.content as Record<string, unknown>[] | undefined; const attrs = (firstParagraph?.[0]?.attrs ?? {}) as Record<string, unknown>; const blockId = String(attrs.blockId ?? newId("block")); const passageId = String(attrs.passageId ?? newId("passage")); result.push({ type: "list", blockId, passageId, ordered: node.type === "orderedList", items: content.map((item) => inlineMarkdown(inlineChildren(((item.content as Record<string, unknown>[] | undefined)?.[0] ?? {})))) }); return;
    }
    content.forEach(visit);
  };
  (Array.isArray(json.content) ? json.content as Record<string, unknown>[] : []).forEach(visit); return result;
}
