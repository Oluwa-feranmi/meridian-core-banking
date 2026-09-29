export type CustomerStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type AccountType = 'CHECKING' | 'SAVINGS';
export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT';
export type ApiRole = 'ADMIN' | 'TELLER' | 'VIEWER';

export interface Customer {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  date_of_birth: string;
  address_line1: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  status: CustomerStatus;
  created_at: string;
  updated_at: string;
}

export interface Account {
  account_id: string;
  account_number: string;
  customer_id: string;
  account_type: AccountType;
  currency_code: string;
  balance: string;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  transaction_id: string;
  account_id: string;
  related_account_id: string | null;
  transaction_type: TransactionType;
  amount: string;
  balance_after: string;
  description: string | null;
  status: string;
  transfer_group_id: string | null;
  created_at: string;
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number };
}

export interface AuthUser {
  userId: string;
  username: string;
  role: ApiRole;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}
