import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';

export default function ProductsPage() {
  return <><PageHeading title="商品管理" description="集中整理门店的家具与家电，查找商品更轻松。" /><div className="resource-panel"><div className="panel-header"><h2>商品列表</h2><span className="pill">暂未接入数据</span></div><EmptyState title="暂无商品" description="商品目录将展示品牌、分类、价格与尺寸信息。" symbol="▦" /></div></>;
}
