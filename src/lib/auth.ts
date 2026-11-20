export const SESSION_COOKIE_NAME = 'tomdesk_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface SessionPayload {
  v: 1;
  iat: number;
  exp: number;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array | null {
  if (!str || !/^[A-Za-z0-9_-]+$/.test(str)) {
    return null;
  }
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLen);

  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function verifyPinConstantTime(
  inputPin: string,
  expectedPin: string
): Promise<boolean> {
  if (!inputPin || !expectedPin) {
    return false;
  }
  const [inputDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', textEncoder.encode(inputPin)),
    crypto.subtle.digest('SHA-256', textEncoder.encode(expectedPin)),
  ]);
  return timingSafeEqual(new Uint8Array(inputDigest), new Uint8Array(expectedDigest));
}

export async function createSessionToken(secret: string): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    v: 1,
    iat: nowSec,
    exp: nowSec + SESSION_MAX_AGE_SECONDS,
  };

  const payloadBytes = textEncoder.encode(JSON.stringify(payload));
  const payloadB64 = base64UrlEncode(payloadBytes);

  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    textEncoder.encode(payloadB64)
  );
  const sigB64 = base64UrlEncode(new Uint8Array(signature));
  return `${payloadB64}.${sigB64}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined
): Promise<boolean> {
  if (!token || !secret) {
    return false;
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [payloadB64, sigB64] = parts;
  const payloadBytes = base64UrlDecode(payloadB64);
  const sigBytes = base64UrlDecode(sigB64);
  if (!payloadBytes || !sigBytes) {
    return false;
  }

  try {
    const key = await importHmacKey(secret);
    const expectedSigBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      textEncoder.encode(payloadB64)
    );
    const expectedSigBytes = new Uint8Array(expectedSigBuffer);
    if (!timingSafeEqual(sigBytes, expectedSigBytes)) {
      return false;
    }

    const parsed = JSON.parse(textDecoder.decode(payloadBytes)) as Partial<SessionPayload>;
    if (parsed.v !== 1 || typeof parsed.exp !== 'number') {
      return false;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    return parsed.exp > nowSec;
  } catch {
    return false;
  }
}
