'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigation } from '@/lib/navigation';

export function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="主导航" className="navigation">
      {navigation.map(item => (
        <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={pathname === item.href ? 'page' : undefined}>
          <span className="nav-symbol" aria-hidden="true">{item.symbol}</span>{item.label}
        </Link>
      ))}
    </nav>
  );
}
