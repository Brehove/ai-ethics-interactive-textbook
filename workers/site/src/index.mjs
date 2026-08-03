const DOCUMENT_ID = 'chapter_ch07';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const safeHttps = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch { return null; }
};

const inline = (value = '') => {
  let rendered = escapeHtml(value);
  rendered = rendered.replace(/\[([^\]]+)\]\(((?:https:\/\/|\/(?!\/))[^\s)]+)\)/g, (_match, label, href) => `<a href="${escapeHtml(href)}">${label}</a>`);
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  rendered = rendered.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return rendered;
};

const idFor = (value, prefix) => value ? String(value).replace(new RegExp(`^${prefix}_`), '') : null;

const decodeLegacy = (block) => {
  if (/_metadata$/.test(block.blockId ?? '')) return '';
  const match = String(block.sanitizedHtml ?? '').match(/^<pre data-content-source="git-markdown-v1">([\s\S]*)<\/pre>$/);
  if (!match) return '';
  return match[1]
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'").replaceAll('&amp;', '&')
    .replace(/<(script|style|form|iframe|object|embed|link|meta|base)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|form|iframe|object|embed|link|meta|base)\b[^>]*\/?\s*>/gi, '')
    .replace(/\s(?:on[a-z]+|style|srcdoc)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|src)\s*=\s*(?:"(?!https:\/\/|\/|#)[^"]*"|'(?!https:\/\/|\/|#)[^']*')/gi, '');
};

const placement = (block) => {
  const url = safeHttps(block.canonicalUrl);
  const title = block.caption ?? block.title ?? block.fallback?.title ?? (block.type === 'mediaFigure' ? 'Media' : 'Embedded media');
  const summary = block.fallback?.summary ?? block.summary ?? block.teachingUse ?? block.alt ?? '';
  return `<figure class="live-media live-media--${escapeHtml(block.type)}" data-live-block-id="${escapeHtml(block.blockId ?? '')}">
    <div class="live-media__preview"><strong>${escapeHtml(title)}</strong>${summary ? `<p>${inline(summary)}</p>` : ''}${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">View original media</a>` : ''}</div>
    ${block.caption && block.caption !== title ? `<figcaption>${inline(block.caption)}</figcaption>` : ''}
  </figure>`;
};

const renderBlock = (block) => {
  const passageId = idFor(block.passageId ?? block.anchorPassageId, 'passage');
  const id = passageId ? ` id="${escapeHtml(passageId)}"` : '';
  if (block.type === 'heading') return `<h${block.level ?? 2} id="${escapeHtml(idFor(block.sectionId, 'section') ?? passageId ?? '')}">${inline(block.text)}</h${block.level ?? 2}>`;
  if (block.type === 'paragraph') return `<p${id}>${inline(block.text)}</p>`;
  if (block.type === 'blockquote') return `<blockquote${id}>${inline(block.text).replaceAll('\n', '<br>')}</blockquote>`;
  if (block.type === 'list') return `<${block.ordered ? 'ol' : 'ul'}${id}>${(block.items ?? []).map((item) => `<li>${inline(item)}</li>`).join('')}</${block.ordered ? 'ol' : 'ul'}>`;
  if (block.type === 'codeBlock') return `<pre${id}><code>${escapeHtml(block.code ?? block.text ?? '')}</code></pre>`;
  if (block.type === 'table') return `<table${id}><thead><tr>${(block.columns ?? []).map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${(block.rows ?? []).map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  if (block.type === 'callout') return `<aside${id} class="textbook shaded textbox--${escapeHtml(block.tone ?? 'note')}" role="note"><p>${inline(block.text)}</p></aside>`;
  if (block.type === 'legacyMarkup') return `<div${id} data-live-block-id="${escapeHtml(block.blockId ?? '')}">${decodeLegacy(block)}</div>`;
  if (['mediaFigure', 'externalEmbed', 'richLink', 'diagram'].includes(block.type)) return placement(block);
  return '';
};

export const projectChapter = (chapter) => ({
  revisionId: chapter.revisionId ?? chapter.chapterVersion,
  chapterVersion: chapter.chapterVersion ?? chapter.revisionId,
  title: chapter.title,
  html: (chapter.body ?? []).map(renderBlock).join('\n'),
  prompts: (chapter.checkpoints ?? []).filter((item) => item.showInSidebar !== false).map((item) => ({
    id: item.legacyId || String(item.checkpointId ?? '').replace(/^checkpoint_/, ''),
    passageId: String(item.passageId ?? '').replace(/^passage_/, ''),
    stage: item.stage, strategy: item.strategy, title: item.title, trigger: item.trigger,
    prompt: item.prompt, guidance: item.guidance,
    responseStructure: item.responseStructure || item.responseFormat,
    minWords: item.minWords, maxWords: item.maxWords, showInSidebar: item.showInSidebar,
  })),
});

async function liveChapter(env) {
  const row = await env.CONTENT_DB.prepare(`SELECT d.current_revision_id AS revision_id, r.content_text
    FROM documents d JOIN document_revisions r ON r.id = d.current_revision_id
    WHERE d.id = ?`).bind(DOCUMENT_ID).first();
  if (!row?.content_text) return new Response(JSON.stringify({ error: 'Live chapter unavailable' }), { status: 503, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  const payload = projectChapter(JSON.parse(row.content_text));
  payload.revisionId = row.revision_id;
  return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === `/api/live/chapters/${DOCUMENT_ID}`) return liveChapter(env);
    return env.ASSETS.fetch(request);
  },
};
