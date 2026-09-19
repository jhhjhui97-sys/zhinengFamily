import 'server-only';
import { cookies } from 'next/headers';
import { AUTH_COOKIE } from './config';
import { serverRequest } from './server';
import type { CurrentUser, LoginInput, LoginToken } from './types';

export const loginToApi = (input: LoginInput) => serverRequest<LoginToken>('/auth/login', { method: 'POST', body: input });
export const userForToken = (token: string) => serverRequest<CurrentUser>('/auth/me', { token });
export async function currentUser() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  return token ? userForToken(token) : null;
}
