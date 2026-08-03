#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { signAgentCapability } from '../../workers/textbook-mcp/src/index.mjs';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const flag = process.argv[index]; const value = process.argv[index + 1];
  if (!flag?.startsWith('--') || value === undefined) throw new Error('Arguments must be --name value pairs');
  args.set(flag.slice(2), value);
}
const actorId = args.get('actor-id'); const clientId = args.get('client-id'); const runId = args.get('run-id');
const requestedScopes = (args.get('scopes') || '').split(/[ ,]+/).filter(Boolean);
const minutes = Number(args.get('minutes') || '30');
if (!actorId || !clientId || !runId || !requestedScopes.length || !Number.isInteger(minutes) || minutes < 1 || minutes > 60) throw new Error('Usage: --actor-id actor_agent_name --client-id client-name --run-id run_name --scopes content:read,content:write --minutes 30');
const secret = process.env.MCP_CAPABILITY_SECRET;
if (!secret) throw new Error('MCP_CAPABILITY_SECRET is required');
const now = Math.floor(Date.now() / 1000);
const token = await signAgentCapability({ iss: 'ai-ethics-editor', aud: 'ai-ethics-textbook-mcp', sub: actorId, actorType: 'agent', clientId, runId, scopes: requestedScopes, iat: now, exp: now + minutes * 60, jti: randomUUID() }, secret);
process.stdout.write(`${token}\n`);
