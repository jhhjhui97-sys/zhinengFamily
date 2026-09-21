import { notFound, redirect } from 'next/navigation';
import { ProductForm } from '@/components/product-form';
import { PageHeading } from '@/components/page-heading';
import { getProduct } from '@/lib/api/products';
import { ApiError } from '@/lib/api/errors';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  let product;
  try { product = await getProduct((await params).id); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); if (error instanceof ApiError && error.status === 401) redirect('/api/auth/expired'); throw error; }
  return <><PageHeading title="编辑商品" description={`更新 ${product.name} 的商品信息。`} /><section className="form-panel"><ProductForm product={product} /></section></>;
}
