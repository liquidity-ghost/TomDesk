import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { getSafeRedirectPath } from '@/lib/utils';

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Always allow auth API endpoints
  if (
    pathname === '/api/auth/verify-pin' ||
    pathname === '/api/auth/logout'
  ) {
    return NextResponse.next();
  }

  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const sessionSecret = process.env.SESSION_SECRET;
  const isAuthenticated = await verifySessionToken(sessionToken, sessionSecret);

  if (pathname === '/pin') {
    if (isAuthenticated) {
      const target = getSafeRedirectPath(req.nextUrl.searchParams.get('next'));
      return NextResponse.redirect(new URL(target, req.url));
    }
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const nextTarget = `${pathname}${search}`;
    const pinUrl = new URL('/pin', req.url);
    if (nextTarget && nextTarget !== '/') {
      pinUrl.searchParams.set('next', nextTarget);
    }
    return NextResponse.redirect(pinUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|pdf\\.worker\\.min\\.mjs|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs)$).*)',
  ],
};
