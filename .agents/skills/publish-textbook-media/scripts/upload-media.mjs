#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const value = (name) => { const index = args.indexOf(name); return index === -1 ? undefined : args[index + 1]; };
const required = (name) => value(name) ?? (() => { throw new Error(`${name} is required`); })();
const filePath = required('--file');
const reviewPackageId = required('--review-package-id');
const mimeType = required('--mime-type');
const idempotencyKey = required('--idempotency-key');
const origin = (process.env.TEXTBOOK_MCP_ORIGIN || 'https://mcp.ethicsandai.your-digital-life.org').replace(/\/$/, '');
const bearer = process.env.TEXTBOOK_MCP_ACCESS_TOKEN;
if (!bearer || bearer.length < 16) throw new Error('TEXTBOOK_MCP_ACCESS_TOKEN is required');
if (!/^https:\/\//.test(origin) && !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(origin)) throw new Error('TEXTBOOK_MCP_ORIGIN must be HTTPS or local development');

const bytes = await readFile(filePath);
if (bytes.length < 1 || bytes.length > 25 * 1024 * 1024) throw new Error('Media must contain 1 byte to 25 MiB');
const filename = basename(filePath);
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(filename)) throw new Error('Filename must use only letters, numbers, dot, underscore, and hyphen');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const transcriptFile = value('--transcript-file');
const transcriptEquivalent = transcriptFile ? { provided: true, language: value('--language') || 'en', text: (await readFile(transcriptFile, 'utf8')).trim() } : undefined;
if (transcriptFile && !transcriptEquivalent.text) throw new Error('Transcript equivalent cannot be empty');
const posterAlt = value('--poster-alt');
const requestBody = {
  reviewPackageId, filename, mimeType, bytes: bytes.length, sha256, idempotencyKey,
  ...(transcriptEquivalent ? { transcriptEquivalent } : {}),
  ...(posterAlt ? { poster: { provided: true, alt: posterAlt } } : {})
};
const headers = { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' };
const requested = await fetch(`${origin}/media-upload/request`, { method: 'POST', headers, body: JSON.stringify(requestBody) });
const ticket = await requested.json().catch(() => ({}));
if (!requested.ok) throw new Error(`Upload request failed (${requested.status}): ${ticket.error?.code || 'unknown'}`);
const uploaded = await fetch(`${origin}/media-upload/${encodeURIComponent(ticket.ticketId)}`, {
  method: 'PUT',
  headers: {
    authorization: `Bearer ${bearer}`,
    'content-type': mimeType,
    'content-length': String(bytes.length),
    'x-content-sha256': sha256,
    'x-upload-token': ticket.upload?.token
  },
  body: bytes
});
const result = await uploaded.json().catch(() => ({}));
if (!uploaded.ok) throw new Error(`Media upload failed (${uploaded.status}): ${result.error?.code || 'unknown'}`);
process.stdout.write(`${JSON.stringify({ ticketId: result.ticketId, jobId: result.jobId, state: result.state, sha256: result.sha256 })}\n`);
