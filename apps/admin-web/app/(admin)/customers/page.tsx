import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';

export default function CustomersPage() {
  return <><PageHeading title="客户管理" description="了解每一位客户，让接待与跟进更从容。" /><div className="resource-panel"><div className="panel-header"><h2>客户列表</h2><span className="pill">暂未接入数据</span></div><EmptyState title="暂无客户" description="客户档案将集中展示联系方式、需求和跟进信息。" symbol="◎" /></div></>;
}
