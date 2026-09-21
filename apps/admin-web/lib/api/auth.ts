import 'server-only';
import { cookies } from 'next/headers';
import { AUTH_COOKIE } from './config';
import { serverRequest } from './server';
import type { CurrentUser, LoginInput, LoginToken } from './types';

export const loginToApi = (input: LoginInput) => serverRequest<LoginToken>('/auth/login', { method: 'POST', body: input });
export const userForToken = (token: string) => serverRequest<CurrentUser>('/auth/me', { token });
export async function currentUser() {
  const token = await authToken();
  return token ? userForToken(token) : null;
}
export async function authToken() { return (await cookies()).get(AUTH_COOKIE)?.value ?? null; }
