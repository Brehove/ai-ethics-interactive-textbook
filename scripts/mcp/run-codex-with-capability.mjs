#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { signAgentCapability } from '../../workers/textbook-mcp/src/index.mjs';

const KEYCHAIN_SERVICE = 'ai-ethics-textbook-mcp-capability';
const DEFAULT_SCOPES = ['content:read', 'content:write', 'content:submit', 'content:live-save', 'media:read', 'media:upload'];
const separator = process.argv.indexOf('--');
const commandArgs = separator === -1 ? process.argv.slice(2) : process.argv.slice(separator + 1);
const command = commandArgs.shift() || 'codex';

function capabilitySecret() {
  if (process.env.MCP_CAPABILITY_SECRET) return process.env.MCP_CAPABILITY_SECRET;
  if (process.platform !== 'darwin') throw new Error('Set MCP_CAPABILITY_SECRET or run this helper on macOS with the capability secret in Keychain');
  const result = spawnSync('/usr/bin/security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0 || !result.stdout.trim()) throw new Error(`Keychain item ${KEYCHAIN_SERVICE} was not found`);
  return result.stdout.trim();
}

const now = Math.floor(Date.now() / 1000);
const runId = `run_codex_${randomUUID().replaceAll('-', '_')}`;
const token = await signAgentCapability({
  iss: 'ai-ethics-editor',
  aud: 'ai-ethics-textbook-mcp',
  sub: 'actor_agent_codex',
  actorType: 'agent',
  clientId: 'codex-textbook-skill',
  runId,
  scopes: DEFAULT_SCOPES,
  iat: now,
  exp: now + 55 * 60,
  jti: randomUUID()
}, capabilitySecret());

const child = spawn(command, commandArgs, {
  stdio: 'inherit',
  env: { ...process.env, TEXTBOOK_MCP_ACCESS_TOKEN: token, MCP_CAPABILITY_SECRET: undefined }
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1); });
