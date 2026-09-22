import type { JsonValue } from './api/types';

export const metadataJsonError = 'Metadata 必须是合法 JSON 对象';
export const metadataNumberError = 'Metadata 不能包含无穷大或非数字数值';

function containsNonFiniteNumber(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isFinite(value);
  if (Array.isArray(value)) return value.some(containsNonFiniteNumber);
  if (value && typeof value === 'object') return Object.values(value).some(containsNonFiniteNumber);
  return false;
}

export function validateMetadata(value: unknown): string | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return metadataJsonError;
  return containsNonFiniteNumber(value) ? metadataNumberError : null;
}

export function parseMetadata(text: string): { value?: Record<string, JsonValue>; error?: string } {
  try {
    const parsed: unknown = JSON.parse(text.trim() || '{}');
    const error = validateMetadata(parsed);
    return error ? { error } : { value: parsed as Record<string, JsonValue> };
  } catch {
    return { error: metadataJsonError };
  }
}
