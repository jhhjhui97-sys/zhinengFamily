export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  return Boolean(origin && host && new URL(origin).host === host && new URL(origin).protocol === new URL(request.url).protocol);
}
