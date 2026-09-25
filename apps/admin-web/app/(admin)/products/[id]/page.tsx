import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getProduct } from '@/lib/api/products';
import { ApiError } from '@/lib/api/errors';
import { dateTime, dimensions, display, money } from '@/lib/products';
import { ResourceError } from '@/components/resource-error';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let product;
  try { product = await getProduct(id); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); if (error instanceof ApiError && error.status === 401) redirect('/api/auth/expired'); return <ResourceError error={error} href={`/products/${id}`} />; }
  const fields = [['品牌', product.brand], ['分类', product.category], ['SKU', product.sku], ['价格', money(product.price)], ['尺寸', dimensions(product.width_mm, product.depth_mm, product.height_mm)], ['缩略图', display(product.thumbnail)], ['3D 模型', display(product.model_url)], ['创建时间', dateTime(product.created_at)], ['更新时间', dateTime(product.updated_at)]];
  return <><div className="detail-heading"><div><span className="eyebrow">商品详情</span><h1>{product.name}</h1><p>查看商品规格、价格与资源配置。</p></div><div className="detail-actions"><Link className="primary-action" href={`/products/${product.id}/edit`}>编辑商品</Link></div></div><section className="detail-card"><dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="metadata-block"><h2>Metadata</h2><pre>{JSON.stringify(product.metadata, null, 2)}</pre></div></section></>;
}
