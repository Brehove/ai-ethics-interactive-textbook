import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker, { projectChapter } from '../../workers/site/src/index.mjs';

const chapter = {
  title: 'A live chapter',
  revisionId: 'revision_live',
  chapterVersion: 'revision_live',
  body: [
    { type: 'paragraph', blockId: 'block_1', passageId: 'passage_ch07-p0001', text: 'A **live** edit by [Aristotle](/people/aristotle/) with an [external source](https://example.com/source).' },
    { type: 'paragraph', blockId: 'block_unsafe', passageId: 'passage_ch07-p0001b', text: 'Do not link [scripts](javascript:alert(1)), [insecure pages](http://example.com), or [protocol-relative pages](//example.com).' },
    { type: 'legacyMarkup', blockId: 'block_legacy', anchorPassageId: 'passage_ch07-p0002', sanitizedHtml: '<pre data-content-source="git-markdown-v1">&lt;aside class="textbox" role="note"&gt;&lt;h3&gt;Key point&lt;/h3&gt;&lt;p&gt;Rendered visually.&lt;/p&gt;&lt;/aside&gt;</pre>' },
  ],
  checkpoints: [{ checkpointId: 'checkpoint_first', legacyId: 'ch07-commit', passageId: 'passage_ch07-p0001', stage: 'Commit', title: 'Updated checkpoint', trigger: 'Pause here.', prompt: 'What do you think?', guidance: 'Use the text.', showInSidebar: true }],
};

test('live chapter projection renders chapter HTML and checkpoint data', () => {
  const result = projectChapter(chapter);
  assert.match(result.html, /<p id="ch07-p0001">A <strong>live<\/strong> edit by <a href="\/people\/aristotle\/">Aristotle<\/a> with an <a href="https:\/\/example\.com\/source">external source<\/a>\.<\/p>/);
  assert.match(result.html, /\[scripts\]\(javascript:alert\(1\)\)/);
  assert.match(result.html, /\[insecure pages\]\(http:\/\/example\.com\)/);
  assert.match(result.html, /\[protocol-relative pages\]\(\/\/example\.com\)/);
  assert.match(result.html, /<aside class="textbox" role="note"><h3>Key point<\/h3><p>Rendered visually\.<\/p><\/aside>/);
  assert.doesNotMatch(result.html, /&lt;aside/);
  assert.equal(result.prompts[0].title, 'Updated checkpoint');
  assert.equal(result.prompts[0].passageId, 'ch07-p0001');
});

test('site worker serves only the fixed live chapter endpoint and delegates assets', async () => {
  const env = {
    CONTENT_DB: { prepare() { return { bind() { return { first: async () => ({ revision_id: 'revision_live', content_text: JSON.stringify(chapter) }) }; } }; } },
    ASSETS: { fetch: async () => new Response('static asset', { status: 200 }) },
  };
  const response = await worker.fetch(new Request('https://example.test/api/live/chapters/chapter_ch07'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).revisionId, 'revision_live');
  const asset = await worker.fetch(new Request('https://example.test/chapter/anything/'), env);
  assert.equal(await asset.text(), 'static asset');
});

test('production routes every request through the site Worker before exact asset delivery', async () => {
  const config = JSON.parse(await readFile(new URL('../../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.assets.binding, 'ASSETS');
  assert.equal(config.assets.run_worker_first, true);
});
