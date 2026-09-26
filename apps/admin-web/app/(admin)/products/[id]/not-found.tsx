import Link from 'next/link';
export default function ProductNotFound() { return <div className="empty-state"><span className="empty-symbol">404</span><h1>页面不存在</h1><p>该商品不存在，或你没有权限查看。</p><Link className="primary-action" href="/products">返回商品列表</Link></div>; }
