import { ProductForm } from '@/components/product-form';
import { PageHeading } from '@/components/page-heading';
export default function NewProductPage() { return <><PageHeading title="新建商品" description="录入商品价格、尺寸和资源地址。" /><section className="form-panel"><ProductForm /></section></>; }
