const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function getCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is required");
  }
  return globalThis.crypto;
}

export function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function base64ToBytes(value) {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function base64UrlToBytes(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url value");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return base64ToBytes(padded);
}

export function encodeBase64Utf8(value) {
  return bytesToBase64(encoder.encode(value));
}

export function decodeBase64Utf8(value) {
  return decoder.decode(base64ToBytes(value));
}

async function importHmacSecret(secret) {
  if (typeof secret !== "string" || encoder.encode(secret).byteLength < 32) {
    throw new Error("EDITOR_SESSION_SECRET must contain at least 32 UTF-8 bytes");
  }
  return getCrypto().subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signToken(payload, secret) {
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importHmacSecret(secret);
  const signature = await getCrypto().subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyToken(token, secret, { kind, now }) {
  if (typeof token !== "string" || token.length > 4096) return null;
  const pieces = token.split(".");
  if (pieces.length !== 2) return null;

  try {
    const [body, encodedSignature] = pieces;
    const key = await importHmacSecret(secret);
    const valid = await getCrypto().subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(encodedSignature),
      encoder.encode(body),
    );
    if (!valid) return null;

    const payload = JSON.parse(decoder.decode(base64UrlToBytes(body)));
    if (!payload || payload.v !== 1 || payload.kind !== kind) return null;
    if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) return null;
    if (payload.iat > now + 60 || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function randomBase64Url(byteLength = 24, randomBytes) {
  const bytes = randomBytes ? randomBytes(byteLength) : getCrypto().getRandomValues(new Uint8Array(byteLength));
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== byteLength) {
    throw new Error("Random byte provider returned an invalid value");
  }
  return bytesToBase64Url(bytes);
}

export function randomHex(byteLength = 8, randomBytes) {
  const bytes = randomBytes ? randomBytes(byteLength) : getCrypto().getRandomValues(new Uint8Array(byteLength));
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== byteLength) {
    throw new Error("Random byte provider returned an invalid value");
  }
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function concatBytes(...arrays) {
  const length = arrays.reduce((total, array) => total + array.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const array of arrays) {
    output.set(array, offset);
    offset += array.length;
  }
  return output;
}

function derLength(length) {
  if (length < 0x80) return Uint8Array.of(length);
  const bytes = [];
  for (let value = length; value > 0; value >>= 8) bytes.unshift(value & 0xff);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function der(tag, body) {
  return concatBytes(Uint8Array.of(tag), derLength(body.length), body);
}

function wrapPkcs1AsPkcs8(pkcs1) {
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const rsaAlgorithmIdentifier = Uint8Array.of(
    0x30, 0x0d,
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00,
  );
  return der(0x30, concatBytes(version, rsaAlgorithmIdentifier, der(0x04, pkcs1)));
}

function privateKeyDerFromPem(pem) {
  if (typeof pem !== "string") throw new Error("GITHUB_APP_PRIVATE_KEY is missing");
  const pkcs8Label = "PRIVATE " + "KEY";
  const pkcs8Match = pem.match(new RegExp(`-----BEGIN ${pkcs8Label}-----([\\s\\S]+?)-----END ${pkcs8Label}-----`));
  if (pkcs8Match) return base64ToBytes(pkcs8Match[1]);

  const pkcs1Label = "RSA PRIVATE " + "KEY";
  const pkcs1Match = pem.match(new RegExp(`-----BEGIN ${pkcs1Label}-----([\\s\\S]+?)-----END ${pkcs1Label}-----`));
  if (pkcs1Match) return wrapPkcs1AsPkcs8(base64ToBytes(pkcs1Match[1]));

  throw new Error("GITHUB_APP_PRIVATE_KEY must be an RSA PKCS#8 or PKCS#1 PEM key");
}

export async function createGitHubAppJwt({ appId, privateKey, now }) {
  if (!/^\d+$/.test(String(appId ?? ""))) throw new Error("GITHUB_APP_ID must be numeric");
  const key = await getCrypto().subtle.importKey(
    "pkcs8",
    privateKeyDerFromPem(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({
    iat: now - 60,
    exp: now + 540,
    iss: String(appId),
  })));
  const unsigned = `${header}.${payload}`;
  const signature = await getCrypto().subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned));
  return `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
}
