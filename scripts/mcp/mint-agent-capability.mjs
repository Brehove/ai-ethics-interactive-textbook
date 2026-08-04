#!/usr/bin/env node
// Compatibility CLI. It requests an instructor-approved bearer; it never signs one.
import { randomUUID } from 'node:crypto';
import { waitForCapability } from './device-flow.mjs';

const values = new Map(); const flags = new Set();
for (let index = 2; index < process.argv.length; index += 1) {
  const flag = process.argv[index]; if (!flag?.startsWith('--')) throw new Error(`Unexpected argument ${flag}`);
  if (flag === '--allow-live-save') { flags.add(flag); continue; }
  const value = process.argv[++index]; if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  const key = flag.slice(2); values.set(key, [...(values.get(key) || []), value]);
}
const documents = values.get('document') || []; const operations = [...new Set(values.get('operation') || [])]; const liveSave = flags.has('--allow-live-save');
if (!documents.length) throw new Error('Usage: --document chapter_ch07 --operation get_authoring_view [--operation commit_live --allow-live-save]');
if (liveSave && !operations.includes('commit_live')) throw new Error('--allow-live-save requires --operation commit_live.');
if (!liveSave && operations.includes('commit_live')) throw new Error('commit_live requires --allow-live-save.');
if (!operations.length) throw new Error('At least one exact --operation is required.');
const authOrigin = process.env.TEXTBOOK_AUTH_ORIGIN || 'https://auth.ethicsandai.your-digital-life.org';
const runId = values.get('run-id')?.[0] || `run_agent_${randomUUID().replaceAll('-', '_')}`;
const clientId = values.get('client-id')?.[0] || 'textbook-mcp-cli';
const issued = await waitForCapability({ authOrigin, request: { clientId, runId, scopes: ['content:read', 'content:write', ...(liveSave ? ['content:live-save'] : [])], allowedDocumentIds: documents, allowedOperations: operations, lifetimeSeconds: liveSave ? 600 : 900 }, onRequested: ({ verificationUrl, userCode, expiresAt }) => { console.error(`Instructor approval required: ${verificationUrl}`); console.error(`Code: ${userCode} (expires ${expiresAt})`); } });
process.stdout.write(`${issued.bearerToken}\n`);
