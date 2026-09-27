import Link from 'next/link';
export default function CustomerNotFound() { return <section className="not-found-card"><span className="empty-symbol">?</span><h1>客户不存在</h1><p>该客户可能已删除，或不属于当前商家。</p><Link className="primary-action" href="/customers">返回客户列表</Link></section>; }
