import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { finalizeOfflineDownloads } from "../finalize-offline-downloads.mjs";

test("offline finalization rewrites root-relative website links to the canonical origin", async (t) => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "ai-ethics-offline-download-"));
  t.after(() => rm(projectRoot, { recursive: true, force: true }));

  const downloadsRoot = path.join(projectRoot, "dist", "downloads");
  const mediaBytes = Buffer.from("offline media");
  const mediaHash = createHash("sha256").update(mediaBytes).digest("hex");
  await mkdir(path.join(projectRoot, "dist", "release-assets"), { recursive: true });
  await writeFile(path.join(projectRoot, "dist", "release-assets", `${mediaHash}.webm`), mediaBytes);
  for (let index = 1; index <= 18; index += 1) {
    const directory = path.join(downloadsRoot, `chapter-${String(index).padStart(2, "0")}.html`);
    await mkdir(directory, { recursive: true });
    const html = index === 1
      ? [
        '<a href="/chapter/next/">Next chapter</a>',
        "<a href='/people/aristotle/?source=offline#bio'>Aristotle</a>",
        '<a href="https://example.org/source">External source</a>',
        '<a href="//cdn.example.org/asset.css">Protocol-relative asset</a>',
        '<a href="#notes">Footnote</a>',
        '<img src="/media/wikimedia/aristotle.webp" alt="Aristotle">',
        `<img src="/release-assets/${mediaHash}.webm" srcset="/release-assets/${mediaHash}.webm 640w" alt="fixture">`,
        `<video src="/release-assets/${mediaHash}.webm" poster="/release-assets/${mediaHash}.webm"></video>`,
        `<a href="/release-assets/${mediaHash}.webm" download>Download video</a>`,
        '<span data-href="/not-a-link">Metadata</span>',
      ].join("\n")
      : "<p>Offline chapter</p>";
    await writeFile(path.join(directory, "index.html"), html);
  }

  const finalized = await finalizeOfflineDownloads({
    projectRoot,
    siteUrl: "https://reader.example.edu/",
  });

  assert.equal(finalized, 18);
  const output = await readFile(path.join(downloadsRoot, "chapter-01.html"), "utf8");
  assert.match(output, /href="https:\/\/reader\.example\.edu\/chapter\/next\/"/);
  assert.match(output, /href='https:\/\/reader\.example\.edu\/people\/aristotle\/\?source=offline#bio'/);
  assert.match(output, /href="https:\/\/example\.org\/source"/);
  assert.match(output, /href="\/\/cdn\.example\.org\/asset\.css"/);
  assert.match(output, /href="#notes"/);
  assert.match(output, /src="\/media\/wikimedia\/aristotle\.webp"/);
  const embedded = `data:video/webm;base64,${mediaBytes.toString("base64")}`;
  assert.equal(output.match(new RegExp(embedded, "g"))?.length, 4);
  assert.doesNotMatch(output, /srcset=/);
  assert.match(output, /data-href="\/not-a-link"/);
  await assert.rejects(access(path.join(downloadsRoot, "chapter-01.html", "index.html")));
});
