import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  verifyPinConstantTime,
} from '@/lib/auth';

interface RateLimitEntry {
  attempts: number;
  windowStart: number;
}

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 10;
const rateLimitStore = new Map<string, RateLimitEntry>();

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'local-client';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry) return false;
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.delete(ip);
    return false;
  }
  return entry.attempts >= MAX_FAILED_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { attempts: 1, windowStart: now });
  } else {
    entry.attempts += 1;
  }
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: 'Too many incorrect attempts. Please wait a few minutes.' },
      { status: 429 }
    );
  }

  const expectedPin = process.env.HUB_PIN;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!expectedPin || !sessionSecret) {
    return NextResponse.json(
      {
        error:
          'Server authentication is not configured. Set HUB_PIN and SESSION_SECRET environment variables.',
      },
      { status: 500 }
    );
  }

  let submittedPin = '';
  try {
    const body = (await req.json()) as { pin?: unknown };
    if (typeof body.pin === 'string') {
      submittedPin = body.pin.trim();
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  if (!submittedPin) {
    return NextResponse.json({ error: 'Please enter the passcode.' }, { status: 400 });
  }

  const valid = await verifyPinConstantTime(submittedPin, expectedPin);
  if (!valid) {
    recordFailure(clientIp);
    return NextResponse.json(
      { error: "That passcode didn't match — please try again." },
      { status: 401 }
    );
  }

  rateLimitStore.delete(clientIp);
  const token = await createSessionToken(sessionSecret);

  const isHttps =
    req.nextUrl.protocol === 'https:' ||
    req.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
