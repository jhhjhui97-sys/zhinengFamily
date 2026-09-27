import 'server-only';
import { apiBaseUrl } from './config';
import { ApiError, errorMessage } from './errors';

export async function serverRequest<T>(path: string, options: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    let data: unknown;
    try { data = await response.json(); } catch { throw new ApiError(503, errorMessage(503)); }
    if (!response.ok) {
      const payload = data && typeof data === 'object' && 'error' in data ? data.error : undefined;
      const details = payload && typeof payload === 'object' && 'details' in payload ? payload.details : undefined;
      throw new ApiError(response.status, errorMessage(response.status, details));
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, errorMessage(503));
  }
}
