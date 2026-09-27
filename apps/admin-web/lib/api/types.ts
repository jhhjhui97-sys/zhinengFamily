export type LoginInput = { merchant_id: string; email: string; password: string };
export type LoginToken = { access_token: string; token_type: string; expires_in: number };
export type CurrentUser = { id: string; merchant_id: string; email: string; role: string; is_active: boolean; created_at: string };
export type CustomerStatus = 'new' | 'following' | 'won' | 'lost';
export type Customer = {
  id: string; merchant_id: string; owner_user_id: string; name: string;
  phone: string | null; wechat: string | null; source: string | null;
  address: string | null; budget: string | null; status: CustomerStatus;
  notes: string | null; last_follow_up_at: string | null;
  created_at: string; updated_at: string;
};
export type CustomerInput = Pick<Customer, 'name' | 'phone' | 'wechat' | 'source' | 'address' | 'budget' | 'status' | 'notes'>;
export type PageResult<T> = { items: T[]; total: number; limit: number; offset: number };
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type Product = {
  id: string; merchant_id: string; category: string; brand: string; name: string; sku: string;
  price: string; width_mm: number; depth_mm: number; height_mm: number;
  thumbnail: string | null; model_url: string | null; metadata: Record<string, JsonValue>;
  created_at: string; updated_at: string;
};
export type ProductInput = Pick<Product, 'category' | 'brand' | 'name' | 'sku' | 'price' | 'width_mm' | 'depth_mm' | 'height_mm' | 'thumbnail' | 'model_url' | 'metadata'>;
export type ProjectStatus = 'draft' | 'active' | 'archived';
export type DesignProject = {
  id: string; merchant_id: string; customer_id: string; sales_user_id: string;
  name: string; address: string | null; status: ProjectStatus;
  created_at: string; updated_at: string;
};
export type ProjectInput = Pick<DesignProject, 'customer_id' | 'name' | 'address' | 'status'> & { sales_user_id?: string };
