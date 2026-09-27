import { ApiError, errorMessage } from './errors';

// Same-origin BFF only: no FastAPI address or token enters this client.
export async function browserRequest<T>(path: string, init: RequestInit): Promise<T> {
  try {
    const response = await fetch(path, init);
    if (!response.ok) throw new ApiError(response.status, errorMessage(response.status));
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, errorMessage(503));
  }
}
