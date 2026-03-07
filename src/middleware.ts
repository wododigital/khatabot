/**
 * Next.js Middleware - Auth guard for API routes and protected pages
 * Validates Supabase session before allowing access
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            cookiesToSet.forEach(({ name, value }) => {
              req.cookies.set(name, value);
            });
            res = NextResponse.next({ request: req });
            cookiesToSet.forEach(({ name, value, options }) => {
              res.cookies.set(name, value, options as any);
            });
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();

    // Protect API routes (except public ones)
    const publicApiPaths = ['/api/health', '/api/bot-status', '/api/qr'];
    if (req.nextUrl.pathname.startsWith('/api/') && !publicApiPaths.includes(req.nextUrl.pathname)) {
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Protect dashboard pages (redirect to login if not authenticated)
    const protectedPaths = ['/', '/transactions', '/contacts', '/groups', '/reports', '/settings'];
    const isProtected = protectedPaths.some(
      (path) => req.nextUrl.pathname === path || req.nextUrl.pathname.startsWith(path + '/')
    );

    if (isProtected && !session) {
      const loginUrl = new URL('/auth/login', req.url);
      return NextResponse.redirect(loginUrl);
    }

    return res;
  } catch {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Auth check failed' }, { status: 500 });
    }
    // On auth failure for protected pages, redirect to login instead of passing through
    const loginUrl = new URL('/auth/login', req.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    '/',
    '/transactions/:path*',
    '/contacts/:path*',
    '/groups/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/api/:path*',
  ],
};
