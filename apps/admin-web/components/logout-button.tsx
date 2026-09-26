'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('退出失败，请重试');
      router.replace('/login');
      router.refresh();
    } catch { setError('退出失败，请重试'); setBusy(false); }
  }
  return <div><button className="logout-button" onClick={logout} disabled={busy}>{busy ? '退出中…' : '退出登录'}</button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
