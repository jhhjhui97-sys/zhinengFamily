import type { ReactNode } from 'react';

export function EmptyState({ title, description, symbol }: { title: string; description: string; symbol: ReactNode }) {
  return (
    <section className="empty-state" aria-label={title}>
      <div className="empty-symbol" aria-hidden="true">{symbol}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <span className="empty-caption">数据接入后，将在这里展示门店记录。</span>
    </section>
  );
}
