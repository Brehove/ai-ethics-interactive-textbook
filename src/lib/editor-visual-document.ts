export type VisualDocumentBlock = {
  type: string;
  blockId?: string;
  preserve?: boolean;
  text?: string;
  code?: string;
  items?: string[];
  rows?: string[][];
};

const normalizedText = (block: VisualDocumentBlock) => (block.text
  ?? block.code
  ?? block.items?.join(" ")
  ?? block.rows?.flat().join(" ")
  ?? "").replace(/\s+/g, " ").trim().toLowerCase();

const similarity = (candidate: VisualDocumentBlock, original: VisualDocumentBlock) => {
  const next = normalizedText(candidate);
  const before = normalizedText(original);
  if (next === before) return Number.MAX_SAFE_INTEGER;
  const beforeWords = new Set(before.split(/\s+/).filter(Boolean));
  const sharedWords = next.split(/\s+/).filter((word) => beforeWords.has(word)).length;
  const containsWholeOriginal = before.length > 0 && next.includes(before);
  const isOriginalFragment = next.length > 0 && before.includes(next);
  return sharedWords * 10_000
    + (containsWholeOriginal ? 1_000_000 : 0)
    + (isOriginalFragment ? next.length : 0)
    - Math.abs(before.length - next.length);
};

/**
 * Chromium can clone data attributes when Enter splits a contenteditable block.
 * Keep the stable identity on the fragment most like the canonical block and
 * turn the other editable fragments into ordinary new blocks.
 */
export const reconcileDuplicateStableBlockIds = <T extends VisualDocumentBlock>(blocks: T[], originals: VisualDocumentBlock[]): T[] => {
  const originalsById = new Map(originals.filter((block) => block.blockId).map((block) => [block.blockId!, block]));
  const indexesById = new Map<string, number[]>();
  blocks.forEach((block, index) => {
    if (!block.blockId) return;
    const indexes = indexesById.get(block.blockId) ?? [];
    indexes.push(index);
    indexesById.set(block.blockId, indexes);
  });

  const winnerById = new Map<string, number>();
  for (const [blockId, indexes] of indexesById) {
    if (indexes.length < 2) continue;
    const original = originalsById.get(blockId);
    if (!original || original.preserve || indexes.some((index) => blocks[index].preserve)) {
      winnerById.set(blockId, indexes[0]);
      continue;
    }
    winnerById.set(blockId, indexes.reduce((winner, index) => similarity(blocks[index], original) > similarity(blocks[winner], original) ? index : winner));
  }

  return blocks.flatMap((block, index) => {
    if (!block.blockId || !winnerById.has(block.blockId) || winnerById.get(block.blockId) === index) return [block];
    if (block.preserve) return [];
    const { blockId: _duplicateStableId, ...newBlock } = block;
    return [newBlock as T];
  });
};
