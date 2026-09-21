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
