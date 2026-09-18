import Link from 'next/link';
import { PageHeading } from '@/components/page-heading';

export default function DashboardPage() {
  return (
    <>
      <PageHeading title="仪表盘" description="从这里开始，轻松掌握门店的日常工作。" />
      <section className="welcome-card">
        <div><span className="pill">工作台已就绪</span><h2>把客户需求，连接到理想的家。</h2><p>客户、商品与设计项目，在一个清晰的空间里各就其位。</p></div>
        <div className="welcome-art" aria-hidden="true">家<span>FAMILY WORKSPACE</span></div>
      </section>
      <h2 className="section-title">快捷入口</h2>
      <div className="quick-grid">
        <Link className="quick-card" href="/customers"><span className="quick-symbol" aria-hidden="true">◎</span><h3>客户管理</h3><p>梳理客户需求，建立接待档案。</p><span className="quick-action">查看客户<span aria-hidden="true"> →</span></span></Link>
        <Link className="quick-card" href="/products"><span className="quick-symbol" aria-hidden="true">▦</span><h3>商品管理</h3><p>整理家具与家电，构建门店目录。</p><span className="quick-action">查看商品<span aria-hidden="true"> →</span></span></Link>
        <Link className="quick-card" href="/projects"><span className="quick-symbol" aria-hidden="true">◇</span><h3>设计项目</h3><p>围绕客户空间，组织设计工作。</p><span className="quick-action">查看项目<span aria-hidden="true"> →</span></span></Link>
      </div>
      <aside className="scope-notice"><strong>当前为后台骨架预览</strong><p>尚未连接登录认证或业务 API。列表为空，仪表盘不展示模拟统计。</p></aside>
    </>
  );
}
