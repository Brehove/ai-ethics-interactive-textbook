import { createHash } from 'node:crypto'; import { readdir, readFile, writeFile } from 'node:fs/promises'; import path from 'node:path';
const root = path.resolve('.agents/skills'); const out = path.resolve('.agents/skills/bundle-manifest.json');
async function files(dir) { const entries = await readdir(dir, { withFileTypes: true }); return (await Promise.all(entries.filter(x => x.name !== 'bundle-manifest.json').map(async x => x.isDirectory() ? files(path.join(dir, x.name)) : [path.join(dir, x.name)]))).flat(); }
const entries = (await files(root)).sort().map(async file => ({ path: path.relative(root, file), sha256: createHash('sha256').update(await readFile(file)).digest('hex') }));
const manifest = { schemaVersion: 1, bundleVersion: '1.0.0', files: await Promise.all(entries) };
if (process.argv.includes('--write')) await writeFile(out, `${JSON.stringify(manifest, null, 2)}\n`); else { const existing = JSON.parse(await readFile(out, 'utf8')); if (JSON.stringify(existing) !== JSON.stringify(manifest)) throw new Error('Skill bundle manifest drift detected; run node scripts/skills/check-bundle.mjs --write.'); }
