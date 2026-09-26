'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, errorMessage } from '@/lib/api/errors';
import type { PageResult } from '@/lib/api/types';
import { dateTime } from '@/lib/customers';
import { exampleScene, sceneInputError, type SceneVersion } from '@/lib/scenes';

export function ScenePanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState<SceneVersion | null>(null);
  const [history, setHistory] = useState<PageResult<SceneVersion>>({ items: [], total: 0, limit: 20, offset: 0 });
  const [viewed, setViewed] = useState<SceneVersion | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const dirty = useRef(false);
  const working = useRef(false);
  const root = `/api/projects/${encodeURIComponent(projectId)}/scene`;

  const request = useCallback(async <T,>(suffix = '', method = 'GET', body?: unknown): Promise<T> => {
    let response: Response;
    try { response = await fetch(root + suffix, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw new ApiError(503, errorMessage(503)); }
    if (response.status === 401) { router.replace('/login?expired=1'); router.refresh(); throw new ApiError(401, errorMessage(401)); }
    if (!response.ok) throw new ApiError(response.status, errorMessage(response.status));
    try { return await response.json() as T; } catch { throw new ApiError(503, errorMessage(503)); }
  }, [root, router]);

  const read = useCallback(async () => {
    try {
      const [value, versions] = await Promise.all([request<SceneVersion | null>(), request<PageResult<SceneVersion>>('/versions?limit=20&offset=0')]);
      setCurrent(value); setHistory(versions); setReady(true); setConflict(false);
      if (!dirty.current) setDraft(value ? JSON.stringify(value.scene_data, null, 2) : '');
    } catch (cause) { setError(cause instanceof Error ? cause.message : errorMessage(503)); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => {
    let active = true;
    Promise.all([request<SceneVersion | null>(), request<PageResult<SceneVersion>>('/versions?limit=20&offset=0')])
      .then(([value, versions]) => {
        if (!active) return;
        setCurrent(value); setHistory(versions); setReady(true);
        if (!dirty.current) setDraft(value ? JSON.stringify(value.scene_data, null, 2) : '');
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : errorMessage(503)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request]);

  async function write(restore?: number) {
    if (working.current || !ready || loading || conflict) return;
    setError('');
    let scene;
    if (restore === undefined) {
      try { scene = JSON.parse(draft); } catch { setError('场景必须是合法 JSON'); return; }
      const issue = sceneInputError(scene); if (issue) { setError(issue); return; }
    }
    working.current = true; setBusy(true);
    try {
      const value = await request<SceneVersion>(restore === undefined ? '' : `/versions/${restore}/restore`, restore === undefined ? 'PUT' : 'POST', { base_version: current?.version ?? 0, ...(restore === undefined ? { scene_data: scene } : {}) });
      setCurrent(value); setDraft(JSON.stringify(value.scene_data, null, 2)); dirty.current = false;
      setViewed(null);
      setHistory(await request<PageResult<SceneVersion>>('/versions?limit=20&offset=0'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : errorMessage(503));
      if (cause instanceof ApiError && cause.status === 409) setConflict(true);
    } finally { working.current = false; setBusy(false); }
  }
  async function showVersion(version: number) {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try { setViewed(await request<SceneVersion>(`/versions/${version}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : errorMessage(503)); }
    finally { working.current = false; setBusy(false); }
  }
  async function pageHistory(offset: number) {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try { setHistory(await request<PageResult<SceneVersion>>(`/versions?limit=20&offset=${offset}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : errorMessage(503)); }
    finally { working.current = false; setBusy(false); }
  }
  const count = (key: string) => { const value = current?.scene_data[key]; return Array.isArray(value) ? value.length : 0; };
  return <section className="scene-panel detail-card" aria-label="场景与版本管理">
    <h2>SceneModel</h2>
    {loading ? <p role="status">正在读取场景…</p> : ready && <p>{current ? `当前版本：v${current.version}` : 'SceneModel 尚未创建'}</p>}
    {current && <><p>房间 {count('rooms')} · 墙体 {count('walls')} · 门 {count('doors')} · 窗 {count('windows')} · 家具实例 {count('furniture_instances')}</p><p>保存时间：{dateTime(current.created_at)}</p><details><summary>当前版本只读 JSON</summary><pre aria-label="当前场景 JSON">{JSON.stringify(current.scene_data, null, 2)}</pre></details></>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {conflict && <p>草稿已保留。请先重新读取当前版本并核对差异，再决定是否保存；不会自动覆盖。</p>}
    <div className="form-actions"><button type="button" className="secondary-action" disabled={busy || loading} onClick={() => { dirty.current = true; setDraft(JSON.stringify(exampleScene(), null, 2)); }}>载入两室一厅示例</button><button type="button" className="secondary-action" disabled={busy || loading} onClick={() => { setLoading(true); setError(''); void read(); }}>重新读取当前版本（保留草稿）</button></div>
    <p>示例包含客厅、主卧和次卧，不含商品引用。完整场景校验由服务端执行。</p>
    <label htmlFor="scene-json">场景 JSON</label><textarea id="scene-json" rows={16} spellCheck={false} value={draft} disabled={busy} onChange={event => { dirty.current = true; setDraft(event.target.value); }} />
    <button type="button" className="primary-action" disabled={busy || loading || !ready || conflict} onClick={() => void write()}>{busy ? '处理中…' : '保存场景'}</button>
    <h2>版本历史</h2>
    <p>共 {history.total} 个版本，按版本号倒序。恢复会创建新版本，保留全部历史。</p>
    <ul className="scene-history">{history.items.map(item => <li key={item.id}><span>v{item.version} · {dateTime(item.created_at)}</span><button type="button" disabled={busy || loading} onClick={() => void showVersion(item.version)}>查看 v{item.version}</button><button type="button" disabled={busy || loading || conflict || !ready} onClick={() => void write(item.version)}>恢复 v{item.version} 为新版本</button></li>)}</ul>
    <div className="form-actions"><button type="button" disabled={busy || loading || history.offset === 0} onClick={() => void pageHistory(Math.max(0, history.offset - 20))}>上一页版本</button><button type="button" disabled={busy || loading || history.offset + history.limit >= history.total} onClick={() => void pageHistory(history.offset + 20)}>下一页版本</button></div>
    {viewed && <div><h3>历史版本 v{viewed.version}</h3><pre aria-label="历史场景 JSON">{JSON.stringify(viewed.scene_data, null, 2)}</pre></div>}
  </section>;
}
