'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant_id: values.get('merchant_id'), email: values.get('email'), password: values.get('password') }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(typeof body.error === 'string' ? body.error : '服务暂时不可用，请稍后重试');
      }
      const me = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!me.ok) {
        const body = await me.json();
        throw new Error(typeof body.error === 'string' ? body.error : '服务暂时不可用，请稍后重试');
      }
      form.reset();
      router.replace('/dashboard');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error && cause.message !== 'Failed to fetch' ? cause.message : '服务暂时不可用，请稍后重试');
    } finally { setBusy(false); }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="merchant_id">商家 ID</label><input id="merchant_id" name="merchant_id" required autoComplete="off" placeholder="商家 UUID" />
      <label htmlFor="email">邮箱</label><input id="email" name="email" type="email" required autoComplete="username" />
      <label htmlFor="password">密码</label><input id="password" name="password" type="password" required autoComplete="current-password" />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? '登录中…' : '登录'}<span aria-hidden="true">→</span></button>
    </form>
  );
}
