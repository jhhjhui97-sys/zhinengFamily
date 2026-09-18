import Link from 'next/link';

export default function LoginPage() {
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
          <div className="preview-notice">
            <strong>后台骨架预览</strong>
            <p>当前为界面预览，尚未接入登录认证。</p>
            <p>无需输入账号或密码。后台页面暂不连接业务数据。</p>
          </div>
          <Link className="primary-button" href="/dashboard">进入后台预览<span aria-hidden="true">→</span></Link>
          <p className="login-hint">此入口仅用于查看页面布局，不代表已登录。</p>
        </div>
        <footer className="login-footer">智能家居 · 门店工作台</footer>
      </section>
    </main>
  );
}
