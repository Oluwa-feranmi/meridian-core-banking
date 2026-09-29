import { api } from '@/api/client';
import type { Account, AuthUser, Customer, Paginated, Transaction } from '@/types';

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ data: { token: string; expiresIn: string; user: AuthUser } }>('/api/auth/login', {
      username,
      password,
    }),
  me: () => api.get<{ data: AuthUser }>('/api/auth/me'),
};

export const customersApi = {
  search: (params: { q?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<Paginated<Customer>>('/api/customers', params),
  getById: (customerId: string) => api.get<{ data: Customer }>(`/api/customers/${customerId}`),
  create: (input: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    dateOfBirth: string;
    addressLine1?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    country?: string;
  }) => api.post<{ data: Customer }>('/api/customers', input),
  update: (customerId: string, input: Partial<{ status: string }>) =>
    api.patch<{ data: Customer }>(`/api/customers/${customerId}`, input),
  listAccounts: (customerId: string) => api.get<{ data: Account[] }>(`/api/customers/${customerId}/accounts`),
};

export const accountsApi = {
  search: (params: { q?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<Paginated<Account>>('/api/accounts', params),
  getById: (accountId: string) => api.get<{ data: Account }>(`/api/accounts/${accountId}`),
  open: (input: { customerId: string; accountType: 'CHECKING' | 'SAVINGS'; currencyCode?: string; openingDeposit?: string }) =>
    api.post<{ data: Account }>('/api/accounts', input),
  deposit: (accountId: string, amount: string, description?: string) =>
    api.post<{ data: { account: Account; transaction: Transaction } }>(`/api/accounts/${accountId}/deposit`, {
      amount,
      description,
    }),
  withdraw: (accountId: string, amount: string, description?: string) =>
    api.post<{ data: { account: Account; transaction: Transaction } }>(`/api/accounts/${accountId}/withdraw`, {
      amount,
      description,
    }),
  transfer: (accountId: string, toAccountId: string, amount: string, description?: string) =>
    api.post<{
      data: { fromAccount: Account; toAccount: Account; outTransaction: Transaction; inTransaction: Transaction };
    }>(`/api/accounts/${accountId}/transfer`, { toAccountId, amount, description }),
  history: (accountId: string, page = 1, pageSize = 20) =>
    api.get<Paginated<Transaction>>(`/api/accounts/${accountId}/transactions`, { page, pageSize }),
};

export const transactionsApi = {
  recent: (limit = 20) => api.get<{ data: Transaction[] }>('/api/transactions/recent', { limit }),
};
