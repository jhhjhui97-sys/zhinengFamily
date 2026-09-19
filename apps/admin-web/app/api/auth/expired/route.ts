import { NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/api/config';

export function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/login?expired=1', request.url));
  response.cookies.delete(AUTH_COOKIE);
  return response;
}
