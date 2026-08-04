import assert from "node:assert/strict";
import test from "node:test";
import { inlineContent, inlineMarkdown, serializeBody } from "../src/tiptap-editor";

test("safe inline Markdown becomes visual Tiptap marks and round-trips", () => {
  const source = "Read [Aristotle](/people/aristotle/) and *Nicomachean Ethics*, then make a **judgment** and ++underline it++.";
  const content = inlineContent(source);
  assert.deepEqual(content.find((node) => node.text === "Aristotle")?.marks, [{ type: "link", attrs: { href: "/people/aristotle/" } }]);
  assert.deepEqual(content.find((node) => node.text === "Nicomachean Ethics")?.marks, [{ type: "italic" }]);
  assert.deepEqual(content.find((node) => node.text === "judgment")?.marks, [{ type: "bold" }]);
  assert.deepEqual(content.find((node) => node.text === "underline it")?.marks, [{ type: "underline" }]);
  assert.equal(inlineMarkdown(content), source);
});

test("serializer preserves visual formatting in paragraphs, quotations, and lists", () => {
  const previous = [
    { type: "paragraph" as const, blockId: "block_p", passageId: "passage_p", text: "Old" },
    { type: "blockquote" as const, blockId: "block_q", passageId: "passage_q", text: "Old quote" },
    { type: "list" as const, blockId: "block_l", passageId: "passage_l", ordered: false, items: ["Old item"] },
  ];
  const body = serializeBody({ type: "doc", content: [
    { type: "paragraph", attrs: { blockId: "block_p", passageId: "passage_p" }, content: [{ type: "text", text: "Visible link", marks: [{ type: "link", attrs: { href: "https://example.org/" } }] }] },
    { type: "blockquote", attrs: { blockId: "block_q", passageId: "passage_q" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Quoted", marks: [{ type: "italic" }] }, { type: "hardBreak" }, { type: "text", text: "line" }] }] },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", attrs: { blockId: "block_l", passageId: "passage_l" }, content: [{ type: "text", text: "Strong", marks: [{ type: "bold" }] }] }] }] },
  ] }, previous);
  assert.equal(body[0]?.text, "[Visible link](https://example.org/)");
  assert.equal(body[1]?.text, "*Quoted*\nline");
  assert.deepEqual(body[2]?.items, ["**Strong**"]);
});

test("callout identity and tone survive visual text editing", () => {
  const previous = [{ type: "callout" as const, blockId: "block_callout", passageId: "passage_callout", tone: "note", text: "Old" }];
  const [saved] = serializeBody({ type: "doc", content: [{ type: "paragraph", attrs: { blockId: "block_callout", passageId: "passage_callout" }, content: [{ type: "text", text: "New", marks: [{ type: "bold" }] }] }] }, previous);
  assert.equal(saved?.type, "callout");
  assert.equal(saved?.text, "**New**");
  assert.equal(saved?.tone, "note");
});
