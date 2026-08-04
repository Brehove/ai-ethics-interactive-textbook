#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { waitForCapability } from './device-flow.mjs';

const EDIT_OPERATIONS = ['get_authoring_view', 'get_passage', 'create_or_resume_changeset', 'replace_passage_text', 'replace_chapter_document', 'upsert_checkpoint', 'remove_checkpoint', 'reorder_checkpoint', 'place_media', 'upsert_embed', 'upsert_person_feature', 'move_managed_placement', 'remove_managed_placement', 'upload_media', 'preview_changes', 'get_live_commit_status', 'get_version_history', 'restore_revision_as_draft', 'search_persons', 'get_person'];
const args = process.argv.slice(2);
const separator = args.indexOf('--');
const optionArgs = separator === -1 ? args : args.slice(0, separator);
const commandArgs = separator === -1 ? [] : args.slice(separator + 1);
const values = new Map(); const flags = new Set();
for (let index = 0; index < optionArgs.length; index += 1) {
  const flag = optionArgs[index];
  if (!flag.startsWith('--')) throw new Error(`Unexpected argument ${flag}`);
  if (flag === '--allow-live-save') { flags.add(flag); continue; }
  const value = optionArgs[++index]; if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  const key = flag.slice(2); values.set(key, [...(values.get(key) || []), value]);
}
const documents = values.get('document') || [];
const requestedOperations = values.get('operation') || [];
const liveSave = flags.has('--allow-live-save');
if (!documents.length) throw new Error('An exact --document <chapter-id> allowlist is required.');
if (liveSave && !requestedOperations.includes('commit_live')) throw new Error('--allow-live-save requires --operation commit_live.');
const operations = [...new Set(requestedOperations.length ? requestedOperations : EDIT_OPERATIONS)];
if (!liveSave && operations.includes('commit_live')) throw new Error('commit_live requires --allow-live-save.');
if (liveSave && !operations.includes('commit_live')) throw new Error('--allow-live-save requires --operation commit_live.');
const authOrigin = process.env.TEXTBOOK_AUTH_ORIGIN || 'https://auth.ethicsandai.your-digital-life.org';
const command = commandArgs.shift() || 'codex';
const runId = `run_codex_${randomUUID().replaceAll('-', '_')}`;
const scopes = ['content:read', 'content:write', 'media:read', 'media:upload', ...(liveSave ? ['content:live-save'] : [])];
const lifetimeSeconds = liveSave ? 600 : 900;
const issued = await waitForCapability({
  authOrigin,
  request: { clientId: 'codex-textbook-skill', runId, scopes, allowedDocumentIds: documents, allowedOperations: operations, lifetimeSeconds },
  onRequested: ({ verificationUrl, userCode, expiresAt }) => {
    console.error(`Instructor approval required: ${verificationUrl}`);
    console.error(`Code: ${userCode} (expires ${expiresAt})`);
  }
});
const childEnv = { ...process.env, TEXTBOOK_MCP_ACCESS_TOKEN: issued.bearerToken };
delete childEnv.MCP_CAPABILITY_SECRET;
const child = spawn(command, commandArgs, { stdio: 'inherit', env: childEnv });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1); });
