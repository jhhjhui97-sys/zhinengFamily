'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/api/errors';
import type { Customer, PageResult } from '@/lib/api/types';

export function CustomerPicker({ initial, onSelect }: { initial?: Customer; onSelect: (customer?: Customer) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState(initial?.name ?? '');
  const [selected, setSelected] = useState<Customer | undefined>(initial);
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const current = generation.current;
    const active = () => !controller.signal.aborted && current === generation.current;
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: '20', offset: '0', ...(query.trim() ? { search: query.trim().slice(0, 100) } : {}) });
        const response = await fetch(`/api/customers?${params}`, { signal: controller.signal });
        if (!active()) return;
        if (response.status === 401) {
          // The BFF clears the HttpOnly cookie; invalidate the rendered session too.
          router.replace('/login?expired=1');
          router.refresh();
          return;
        }
        if (!response.ok) { setError(errorMessage(response.status)); return; }
        const body = await response.json() as PageResult<Customer>;
        if (active()) setItems(body.items);
      } catch {
        if (active()) setError(errorMessage(503));
      } finally {
        if (active()) setLoading(false);
      }
    }, 150);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, retry, router]);

  function resetSearch() {
    // Invalidate immediately, including the debounce window before the next effect.
    generation.current += 1;
    setItems([]);
    setError('');
    setLoading(true);
  }
  function choose(customer: Customer) {
    resetSearch();
    setSelected(customer);
    setQuery(customer.name);
    onSelect(customer);
  }
  return <div className="customer-picker">
    <label htmlFor="customer-search">查找客户</label>
    <input id="customer-search" value={query} maxLength={100} placeholder="输入姓名、手机或微信" onChange={event => {
      resetSearch(); setQuery(event.target.value); setSelected(undefined); onSelect(undefined);
    }} />
    {selected && <p className="selection-note">已选择：{selected.name}</p>}
    {!selected && loading && <small role="status">正在查找…</small>}
    {error && <div><p className="form-error" role="alert">客户查询失败：{error}</p><button type="button" className="secondary-action" onClick={() => { resetSearch(); setRetry(value => value + 1); }}>重试查询</button></div>}
    {!selected && !loading && !error && items.length === 0 && <p role="status">无匹配客户</p>}
    {!selected && !loading && !error && items.length > 0 && <div className="picker-results" role="listbox" aria-label="客户搜索结果">{items.map(customer => <button key={customer.id} type="button" onClick={() => choose(customer)} aria-label={`选择 ${customer.name}`}><strong>{customer.name}</strong><span>{customer.phone ?? customer.wechat ?? '暂无联系方式'}</span></button>)}</div>}
  </div>;
}
