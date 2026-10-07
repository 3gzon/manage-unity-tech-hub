import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const ACCESS_TOKEN_COOKIE = 'uth_access_token';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/students',
  '/instructors',
  '/courses',
  '/groups',
  '/enrollments',
  '/attendance',
  '/payments',
  '/invoices',
  '/expenses',
  '/compensation',
  '/reports',
  '/certificates',
  '/users',
  '/settings',
  '/my-groups',
  '/my-schedule',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!token || !secret) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    '/dashboard',
    '/students',
    '/students/:path*',
    '/instructors',
    '/courses',
    '/groups',
    '/enrollments',
    '/attendance',
    '/attendance/:path*',
    '/payments',
    '/invoices',
    '/expenses',
    '/compensation',
    '/reports',
    '/certificates',
    '/users',
    '/settings',
    '/my-groups',
    '/my-schedule',
  ],
};
