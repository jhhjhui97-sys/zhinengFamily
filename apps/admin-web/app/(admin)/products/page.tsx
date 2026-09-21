import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/page-heading';
import { listProducts } from '@/lib/api/products';
import { ApiError } from '@/lib/api/errors';
import { dimensions, display, money } from '@/lib/products';

const pageSize = 20;
const categories = [['', '全部分类'], ['sofa', '沙发'], ['table', '桌类'], ['appliance', '家电']];
export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ search?: string; category?: string; offset?: string }> }) {
  const query = await searchParams; const search = query.search?.trim().slice(0, 100) ?? ''; const category = query.category?.trim().slice(0, 100) ?? ''; const offset = Math.max(0, Number.parseInt(query.offset ?? '0', 10) || 0);
  let result;
  try { result = await listProducts({ limit: pageSize, offset, search: search || undefined, category: category || undefined }); }
  catch (error) { if (error instanceof ApiError && error.status === 401) redirect('/api/auth/expired'); return <><PageHeading title="商品管理" description="集中整理门店的家具与家电，查找商品更轻松。" /><p className="form-error">{error instanceof ApiError ? error.message : '服务暂时不可用，请稍后重试'}</p></>; }
  const start = result.total ? result.offset + 1 : 0; const end = Math.min(result.offset + result.items.length, result.total);
  const link = (next: number) => `/products?${new URLSearchParams({ ...(search ? { search } : {}), ...(category ? { category } : {}), offset: String(next) })}`;
  return <><div className="heading-actions"><PageHeading title="商品管理" description="集中整理门店的家具与家电，查找商品更轻松。" /><Link className="primary-action" href="/products/new">新建商品</Link></div>
    <form className="search-form product-filters"><label htmlFor="product-search">搜索商品</label><input id="product-search" name="search" defaultValue={search} maxLength={100} placeholder="名称、SKU 或品牌" /><label className="visible-label" htmlFor="product-category">商品分类</label><select id="product-category" name="category" defaultValue={category}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="submit">筛选</button></form>
    <div className="resource-panel"><div className="panel-header"><h2>商品列表</h2><span className="pill">共 {result.total} 件</span></div>
      {result.items.length ? <div className="table-scroll"><table className="customer-table product-table"><thead><tr><th>商品名称</th><th>品牌</th><th>分类</th><th>SKU</th><th>价格</th><th>尺寸</th><th>缩略图</th><th>3D 模型</th></tr></thead><tbody>{result.items.map(product => <tr key={product.id}><td><Link href={`/products/${product.id}`}>{product.name}</Link></td><td>{display(product.brand)}</td><td>{display(product.category)}</td><td>{product.sku}</td><td>{money(product.price)}</td><td>{dimensions(product.width_mm, product.depth_mm, product.height_mm)}</td><td>{product.thumbnail ? '已配置' : '未配置'}</td><td>{product.model_url ? '已有模型' : '暂无模型'}</td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="empty-symbol">▦</span><h2>{search || category ? '没有匹配的商品' : '暂无商品'}</h2><p>{search || category ? '请调整搜索或分类条件。' : '新建第一件商品，开始维护门店目录。'}</p>{!search && !category && <Link className="primary-action" href="/products/new">新建商品</Link>}</div>}
      <div className="pagination"><span>显示 {start}–{end} / 共 {result.total} 件商品</span><div>{offset > 0 ? <Link href={link(Math.max(0, offset - pageSize))}>上一页</Link> : <span>上一页</span>}{offset + result.items.length < result.total ? <Link href={link(offset + pageSize)}>下一页</Link> : <span>下一页</span>}</div></div>
    </div></>;
}
