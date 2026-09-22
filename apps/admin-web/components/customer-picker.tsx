'use client';
import { useEffect, useState } from 'react';
import type { Customer, PageResult } from '@/lib/api/types';

export function CustomerPicker({ initial, onSelect }: { initial?: Customer; onSelect: (customer?: Customer) => void }) {
  const [query, setQuery] = useState(initial?.name ?? ''); const [selected, setSelected] = useState<Customer | undefined>(initial); const [items, setItems] = useState<Customer[]>([]); const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); const timer = window.setTimeout(async () => {
      setLoading(true);
      try { const params = new URLSearchParams({ limit: '20', offset: '0', ...(query.trim() ? { search: query.trim().slice(0, 100) } : {}) }); const response = await fetch(`/api/customers?${params}`, { signal: controller.signal }); if (response.ok) setItems((await response.json() as PageResult<Customer>).items); }
      catch { /* A later query or form response handles errors. */ } finally { setLoading(false); }
    }, 150);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);
  function choose(customer: Customer) { setSelected(customer); setQuery(customer.name); setItems([]); onSelect(customer); }
  return <div className="customer-picker"><label htmlFor="customer-search">查找客户</label><input id="customer-search" value={query} maxLength={100} placeholder="输入姓名、手机或微信" onChange={event => { setQuery(event.target.value); setSelected(undefined); onSelect(undefined); }} />
    {selected && <p className="selection-note">已选择：{selected.name}</p>}{loading && <small>正在查找…</small>}
    {!selected && items.length > 0 && <div className="picker-results" role="listbox" aria-label="客户搜索结果">{items.map(customer => <button key={customer.id} type="button" onClick={() => choose(customer)} aria-label={`选择 ${customer.name}`}><strong>{customer.name}</strong><span>{customer.phone ?? customer.wechat ?? '暂无联系方式'}</span></button>)}</div>}
  </div>;
}
