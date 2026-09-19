import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { currentUser } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let user;
  try { user = await currentUser(); }
  catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/api/auth/expired');
    redirect('/login?service=1');
  }
  if (!user) redirect('/login');
  return <AdminShell user={user}>{children}</AdminShell>;
}
