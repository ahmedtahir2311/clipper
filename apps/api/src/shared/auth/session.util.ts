import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'clipper_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface SessionPayload {
  username: string;
  issuedAt: number;
}

function Sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/** Signed, stateless session token: base64(payload).hex(hmac) - no server-side session store needed for MVP1's single-user auth. */
export function CreateSessionToken(username: string, secret: string): string {
  const payload: SessionPayload = { username, issuedAt: Date.now() };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = Sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function VerifySessionToken(token: string | undefined, secret: string): SessionPayload | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = Sign(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionPayload;
    if (Date.now() - payload.issuedAt > SESSION_TTL_MS) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
