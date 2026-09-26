'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { navigation } from '@/lib/navigation';
import type { CurrentUser } from '@/lib/api/types';
import { Navigation } from './navigation';
import { LogoutButton } from './logout-button';

export function AdminShell({ children, user }: { children: ReactNode; user: CurrentUser }) {
  const pathname = usePathname();
  const title = navigation.find(item => item.href === pathname)?.label ?? '门店工作台';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  function openMenu() {
    dialogRef.current?.showModal();
    setMenuOpen(true);
    dialogRef.current?.querySelector<HTMLAnchorElement>('nav a')?.focus();
  }

  function closeMenu() { dialogRef.current?.close(); }

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <aside className="sidebar" aria-label="工作台侧栏">
        <Link className="brand" href="/dashboard"><span className="brand-mark" aria-hidden="true">家</span>智能家居</Link>
        <p className="sidebar-caption">门店工作台</p>
        <Navigation />
        <div className="sidebar-note"><span className="status-dot" aria-hidden="true" />门店工作台<p>专注客户与空间，<br />让门店工作井然有序。</p></div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button ref={menuRef} className="menu-button" aria-label="打开导航菜单" aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={openMenu}>☰</button>
            <span className="breadcrumb-parent">工作台<span aria-hidden="true"> / </span></span><span>{title}</span>
          </div>
          <div className="user-area"><span className="avatar" aria-hidden="true">店</span><div><strong>{user.email}</strong><small>{user.role}</small></div><LogoutButton /></div>
        </header>
        <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>
        <footer className="workspace-footer"><span>智能家居 · 门店工作台</span></footer>
      </div>
      <dialog ref={dialogRef} id="mobile-menu" className="mobile-menu" aria-label="导航菜单" onClose={() => { setMenuOpen(false); menuRef.current?.focus(); }}>
        <div className="mobile-menu-heading"><strong>智能家居</strong><button className="close-menu" aria-label="关闭导航菜单" onClick={closeMenu}>×</button></div>
        <Navigation onNavigate={closeMenu} />
      </dialog>
    </div>
  );
}
