import test from 'node:test';
import assert from 'node:assert/strict';
import { exchangeCapability, requestCapability, waitForCapability } from '../../scripts/mcp/device-flow.mjs';

const origin = 'https://auth.example';
const request = { clientId: 'codex-textbook-skill', runId: 'run_test', scopes: ['content:read', 'content:write'], allowedDocumentIds: ['chapter_ch07'], allowedOperations: ['get_authoring_view'], lifetimeSeconds: 900 };
const device = { requestId: 'request_7', deviceSecret: 'device-secret-which-never-reaches-browser', userCode: 'ABCD-EFGH', verificationUrl: 'https://auth.example/approve/request_7', expiresAt: '2026-08-03T20:00:00.000Z', pollingIntervalSeconds: 2 };

test('device flow requests exact claim allowlists and does not mint locally', async () => {
  let sent;
  const fetcher = async (url, init) => { sent = { url: String(url), body: JSON.parse(init.body) }; return new Response(JSON.stringify(device), { headers: { 'content-type': 'application/json' } }); };
  const result = await requestCapability(fetcher, origin, request);
  assert.equal(sent.url, 'https://auth.example/auth/agent-capability-requests');
  assert.deepEqual(sent.body.allowedDocumentIds, ['chapter_ch07']);
  assert.equal(result.userCode, 'ABCD-EFGH');
});

test('device flow treats approval as pending and exchanges the bearer only once', async () => {
  const pending = await exchangeCapability(async () => new Response(JSON.stringify({ pending: true, retryAfter: 3 }), { headers: { 'content-type': 'application/json' } }), origin, device.requestId, device.deviceSecret);
  assert.deepEqual(pending, { state: 'pending', retryAfterSeconds: 3 });
  const issued = await exchangeCapability(async () => new Response(JSON.stringify({ accessToken: 'issued-device-flow-bearer', tokenType: 'Bearer', expiresAt: '2026-08-03T19:10:00.000Z' }), { headers: { 'content-type': 'application/json' } }), origin, device.requestId, device.deviceSecret);
  assert.equal(issued.bearerToken, 'issued-device-flow-bearer');
});

test('device flow prints approval material then polls before returning a bearer', async () => {
  let exchanges = 0; let announced;
  const unexpiredDevice = { ...device, expiresAt: new Date(Date.now() + 60_000).toISOString() };
  const fetcher = async (url) => {
    if (String(url).endsWith('requests')) return new Response(JSON.stringify(unexpiredDevice), { headers: { 'content-type': 'application/json' } });
    exchanges += 1;
    return exchanges === 1 ? new Response(JSON.stringify({ pending: true }), { headers: { 'content-type': 'application/json' } }) : new Response(JSON.stringify({ accessToken: 'issued-device-flow-bearer', tokenType: 'Bearer' }), { headers: { 'content-type': 'application/json' } });
  };
  const issued = await waitForCapability({ fetcher, authOrigin: origin, request, onRequested: (value) => { announced = value; }, sleep: async () => {} });
  assert.equal(announced.verificationUrl, device.verificationUrl); assert.equal(exchanges, 2); assert.equal(issued.bearerToken, 'issued-device-flow-bearer');
});
