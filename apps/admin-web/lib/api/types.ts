export type LoginInput = { merchant_id: string; email: string; password: string };
export type LoginToken = { access_token: string; token_type: string; expires_in: number };
export type CurrentUser = { id: string; merchant_id: string; email: string; role: string; is_active: boolean; created_at: string };
