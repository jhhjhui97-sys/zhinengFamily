import { ApiError, errorMessage } from '@/lib/api/errors';

export function ResourceError({ error, href }: { error: unknown; href: string }) {
  const status = error instanceof ApiError ? error.status : 503;
  return <section className="form-panel"><h1>暂时无法加载资料</h1><p className="form-error" role="alert">{errorMessage(status)}</p><a className="secondary-action" href={href}>重试</a></section>;
}
