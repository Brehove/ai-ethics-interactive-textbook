#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const value = (name) => { const index = args.indexOf(name); return index === -1 ? undefined : args[index + 1]; };
const required = (name) => value(name) ?? (() => { throw new Error(`${name} is required`); })();
const filePath = required('--file');
const mimeType = required('--mime-type');

const bytes = await readFile(filePath);
if (bytes.length < 1 || bytes.length > 25 * 1024 * 1024) throw new Error('Media must contain 1 byte to 25 MiB');
const filename = basename(filePath);
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(filename)) throw new Error('Filename must use only letters, numbers, dot, underscore, and hyphen');
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (args.includes('--inspect')) {
  process.stdout.write(`${JSON.stringify({ filename, mimeType, bytes: bytes.length, sha256 })}\n`);
  process.exit(0);
}

const uploadUrl = new URL(required('--upload-url'));
const uploadToken = required('--upload-token');
if (uploadUrl.protocol !== 'https:' && !(uploadUrl.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(uploadUrl.hostname))) throw new Error('Upload URL must be HTTPS or local development');
if (!/^\/media-upload\/[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(uploadUrl.pathname) || uploadUrl.username || uploadUrl.password || uploadUrl.hash) throw new Error('Upload URL is not a bounded textbook upload endpoint');
if (uploadToken.length < 32 || uploadToken.length > 256) throw new Error('Upload token is invalid');
const uploaded = await fetch(uploadUrl, {
  method: 'PUT',
  headers: {
    'content-type': mimeType,
    'content-length': String(bytes.length),
    'x-content-sha256': sha256,
    'x-upload-token': uploadToken
  },
  body: bytes
});
const result = await uploaded.json().catch(() => ({}));
if (!uploaded.ok) throw new Error(`Media upload failed (${uploaded.status}): ${result.error?.code || 'unknown'}`);
process.stdout.write(`${JSON.stringify({ ticketId: result.ticketId, jobId: result.jobId, state: result.state, sha256: result.sha256, filename })}\n`);
