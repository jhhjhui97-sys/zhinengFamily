import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';

export default function ProjectsPage() {
  return <><PageHeading title="设计项目" description="围绕客户与空间，清晰管理每一个设计项目。" /><div className="resource-panel"><div className="panel-header"><h2>项目列表</h2><span className="pill">暂未接入数据</span></div><EmptyState title="暂无设计项目" description="设计项目将关联客户，展示地址与项目进度。" symbol="◇" /></div></>;
}
