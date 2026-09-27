export function PageHeading({ title, description }: { title: string; description: string }) {
  return <div className="page-heading"><span className="eyebrow">门店管理</span><h1>{title}</h1><p>{description}</p></div>;
}
