import { NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/api/config';
import { currentUser } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';

export async function GET(request: Request) {
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (request.headers.get('sec-fetch-site') === 'cross-site') return go('/login');
  try {
    return go(await currentUser() ? '/dashboard' : '/login');
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) return go('/login?service=1');
    const response = go('/login?expired=1');
    response.cookies.delete(AUTH_COOKIE);
    return response;
  }
}
