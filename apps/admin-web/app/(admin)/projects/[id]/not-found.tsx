import Link from 'next/link';
export default function ProjectNotFound() { return <div className="empty-state"><span className="empty-symbol">404</span><h1>项目不存在</h1><p>该设计项目不存在，或你没有权限查看。</p><Link className="primary-action" href="/projects">返回项目列表</Link></div>; }
