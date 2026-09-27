import type { NavigationItem } from '@/types/navigation';

export const navigation: readonly NavigationItem[] = [
  { href: '/dashboard', label: '仪表盘', symbol: '◫' },
  { href: '/customers', label: '客户管理', symbol: '◎' },
  { href: '/products', label: '商品管理', symbol: '▦' },
  { href: '/projects', label: '设计项目', symbol: '◇' },
];
