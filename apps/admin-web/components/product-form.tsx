'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Product, ProductInput } from '@/lib/api/types';
import { parseMetadata } from '@/lib/product-metadata';

type Errors = Partial<Record<'name' | 'required' | 'price' | 'dimensions' | 'metadata', string>>;
const moneyPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [errors, setErrors] = useState<Errors>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? '').trim();
    const category = value('category'); const brand = value('brand'); const name = value('name'); const sku = value('sku'); const price = value('price');
    const width = value('width_mm'); const depth = value('depth_mm'); const height = value('height_mm'); const next: Errors = {};
    if (!name) next.name = '请填写商品名称';
    if (!category || !brand || !sku) next.required = '请填写分类、品牌和 SKU';
    if (!moneyPattern.test(price)) next.price = '请输入有效价格，最多保留两位小数';
    if ([width, depth, height].some(item => !item || !Number.isFinite(Number(item)) || Number(item) <= 0)) next.dimensions = '尺寸必须大于 0';
    const parsedMetadata = parseMetadata(value('metadata'));
    if (parsedMetadata.error) next.metadata = parsedMetadata.error;
    setErrors(next); if (Object.keys(next).length) return;
    const nullable = (key: string) => value(key) || null;
    const input: ProductInput = { category, brand, name, sku, price, width_mm: Number(width), depth_mm: Number(depth), height_mm: Number(height), thumbnail: nullable('thumbnail'), model_url: nullable('model_url'), metadata: parsedMetadata.value ?? {} };
    setBusy(true);
    try {
      const response = await fetch(product ? `/api/products/${product.id}` : '/api/products', { method: product ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }); const body = await response.json();
      if (response.status === 401) { router.replace('/login?expired=1'); router.refresh(); return; }
      if (response.status === 409) throw new Error('SKU 已存在，请使用其他 SKU');
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : '服务暂时不可用，请稍后重试');
      router.replace(`/products/${body.id}`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '服务暂时不可用，请稍后重试'); setBusy(false); }
  }
  return <form className="customer-form" noValidate onSubmit={submit}>
    <div><label htmlFor="category">分类 *</label><input id="category" name="category" maxLength={100} defaultValue={product?.category ?? ''} /></div><div><label htmlFor="brand">品牌 *</label><input id="brand" name="brand" maxLength={100} defaultValue={product?.brand ?? ''} /></div>
    <div><label htmlFor="name">商品名称 *</label><input id="name" name="name" maxLength={200} defaultValue={product?.name ?? ''} />{errors.name && <small className="field-error">{errors.name}</small>}</div><div><label htmlFor="sku">SKU *</label><input id="sku" name="sku" maxLength={100} defaultValue={product?.sku ?? ''} />{errors.required && <small className="field-error">{errors.required}</small>}</div>
    <div><label htmlFor="price">价格 *</label><input id="price" name="price" inputMode="decimal" defaultValue={product?.price ?? ''} placeholder="例如 3999.90" />{errors.price && <small className="field-error">{errors.price}</small>}</div>
    <div><label htmlFor="width_mm">宽度 * <span className="unit">mm</span></label><input id="width_mm" name="width_mm" inputMode="decimal" defaultValue={product?.width_mm ?? ''} /></div><div><label htmlFor="depth_mm">深度 * <span className="unit">mm</span></label><input id="depth_mm" name="depth_mm" inputMode="decimal" defaultValue={product?.depth_mm ?? ''} /></div><div><label htmlFor="height_mm">高度 * <span className="unit">mm</span></label><input id="height_mm" name="height_mm" inputMode="decimal" defaultValue={product?.height_mm ?? ''} />{errors.dimensions && <small className="field-error">{errors.dimensions}</small>}</div>
    <div className="wide"><label htmlFor="thumbnail">缩略图地址</label><input id="thumbnail" name="thumbnail" maxLength={2048} defaultValue={product?.thumbnail ?? ''} /></div><div className="wide"><label htmlFor="model_url">3D 模型地址</label><input id="model_url" name="model_url" maxLength={2048} defaultValue={product?.model_url ?? ''} /></div>
    <div className="wide"><label htmlFor="metadata">Metadata JSON</label><textarea id="metadata" name="metadata" rows={7} defaultValue={JSON.stringify(product?.metadata ?? {}, null, 2)} />{errors.metadata && <small className="field-error">{errors.metadata}</small>}</div>{error && <p className="form-error wide" role="alert">{error}</p>}
    <div className="form-actions wide"><button className="primary-action" type="submit" disabled={busy}>{busy ? '保存中…' : product ? '保存修改' : '保存商品'}</button><button className="secondary-action" type="button" onClick={() => router.back()} disabled={busy}>取消</button></div>
  </form>;
}
