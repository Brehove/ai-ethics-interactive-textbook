const jsonHeaders = { accept: 'application/json', 'content-type': 'application/json' };

function error(message) { throw new Error(`Capability device flow: ${message}`); }

export function parseCapabilityRequest(value) {
  if (!value || typeof value !== 'object') error('request response is invalid');
  const required = ['requestId', 'deviceSecret', 'userCode', 'verificationUrl', 'expiresAt', 'pollingIntervalSeconds'];
  for (const key of required) if (!(key in value)) error(`request response is missing ${key}`);
  if (typeof value.requestId !== 'string' || typeof value.deviceSecret !== 'string' || typeof value.userCode !== 'string' || typeof value.verificationUrl !== 'string' || typeof value.expiresAt !== 'string' || !Number.isInteger(value.pollingIntervalSeconds) || value.pollingIntervalSeconds < 1) error('request response has invalid fields');
  const verification = new URL(value.verificationUrl); if (verification.protocol !== 'https:') error('verification URL must use HTTPS');
  return value;
}

export async function requestCapability(fetcher, authOrigin, request) {
  const response = await fetcher(new URL('/auth/agent-capability-requests', authOrigin), { method: 'POST', headers: jsonHeaders, body: JSON.stringify(request) });
  const body = await response.json().catch(() => null);
  if (!response.ok) error(body?.error?.message || `request failed with ${response.status}`);
  return parseCapabilityRequest(body);
}

export async function exchangeCapability(fetcher, authOrigin, requestId, deviceSecret) {
  const response = await fetcher(new URL(`/auth/agent-capability-requests/${encodeURIComponent(requestId)}:exchange`, authOrigin), { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ deviceSecret }) });
  const body = await response.json().catch(() => null);
  if (response.status === 202 || response.status === 428 || body?.pending === true) return { state: 'pending', retryAfterSeconds: Number(response.headers.get('retry-after')) || Number(body?.retryAfter) || undefined };
  if (!response.ok) error(body?.error?.message || `exchange failed with ${response.status}`);
  if (!body || typeof body.accessToken !== 'string' || body.accessToken.length < 16 || body.tokenType !== 'Bearer') error('exchange response did not return a bearer token');
  return { state: 'issued', bearerToken: body.accessToken, expiresAt: body.expiresAt };
}

export async function waitForCapability({ fetcher = fetch, authOrigin, request, onRequested, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const device = await requestCapability(fetcher, authOrigin, request);
  onRequested?.(device);
  const expiresAt = Date.parse(device.expiresAt);
  while (Number.isFinite(expiresAt) && Date.now() < expiresAt) {
    const exchange = await exchangeCapability(fetcher, authOrigin, device.requestId, device.deviceSecret);
    if (exchange.state === 'issued') return exchange;
    await sleep((exchange.retryAfterSeconds ?? device.pollingIntervalSeconds) * 1000);
  }
  error('approval request expired before exchange');
}
