import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME ?? 'cais_meeting_ai_auth';

const protectedPrefixes = ['/dashboard', '/projects', '/team', '/ai-search'];

const isProtectedRoute = (pathname: string): boolean => {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAuthCookie = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (isProtectedRoute(pathname) && !hasAuthCookie) {
    const loginUrl = new URL('/login', request.url);

    if (pathname !== '/dashboard') {
      loginUrl.searchParams.set('next', pathname);
    }

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/projects/:path*', '/team/:path*', '/ai-search/:path*', '/login', '/register']
};
