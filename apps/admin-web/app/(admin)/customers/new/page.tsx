import { CustomerForm } from '@/components/customer-form';
import { PageHeading } from '@/components/page-heading';
export default function NewCustomerPage() { return <><PageHeading title="新建客户" description="记录客户的联系方式、需求与当前跟进状态。" /><section className="form-panel"><CustomerForm /></section></>; }
