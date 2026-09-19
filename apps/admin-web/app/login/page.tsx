import Link from 'next/link';
import { LoginForm } from '@/components/login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string; service?: string }> }) {
  const query = await searchParams;
  return (
    <main className="login-page">
      <section className="login-story" aria-label="门店工作台介绍">
        <Link className="brand" href="/login"><span className="brand-mark" aria-hidden="true">家</span>智能家居</Link>
        <div className="story-copy">
          <span className="eyebrow">家具 · 家电 · 空间</span>
          <h1>让每一次接待，<br />更有条理。</h1>
          <p>从客户需求到设计项目，为门店搭建清晰、专注的日常工作空间。</p>
          <div className="story-tags"><span>客户管理</span><span>商品目录</span><span>设计项目</span></div>
        </div>
        <p className="story-footer">为门店而设计，为日常工作减负。</p>
      </section>
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <span className="pill">门店管理后台</span>
          <h2 id="login-title">欢迎回到门店工作台</h2>
          <p className="muted">集中管理客户、商品与设计项目。</p>
          {query.expired === '1' && <p className="form-error" role="alert">登录信息已失效，请重新登录</p>}
          {query.service === '1' && <p className="form-error" role="alert">服务暂时不可用，请稍后重试</p>}
          <LoginForm />
        </div>
        <footer className="login-footer">智能家居 · 门店工作台</footer>
      </section>
    </main>
  );
}
