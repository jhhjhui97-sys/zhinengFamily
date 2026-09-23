import { sceneRequest } from '@/lib/api/scenes';
import { publicError } from '@/lib/api/errors';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const query = new URL(request.url).searchParams;
  const safe = new URLSearchParams({ limit: query.get('limit') ?? '20', offset: query.get('offset') ?? '0' });
  try { return Response.json(await sceneRequest((await params).id, `/versions?${safe}`)); } catch (error) { return publicError(error); }
}
