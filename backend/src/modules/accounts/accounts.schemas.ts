import { z } from 'zod';

// Amounts arrive as strings from the client to avoid IEEE-754 floating
// point precision loss in transit (e.g. JSON numbers), then get parsed
// and validated here before being handed to the database as a decimal
// string bound to a NUMERIC(19,4) column.
const moneyAmount = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'must be a positive decimal amount with up to 4 decimal places')
  .refine((v) => Number(v) > 0, 'must be greater than zero');

export const openAccountSchema = z.object({
  customerId: z.string().uuid('must be a valid customer id'),
  accountType: z.enum(['CHECKING', 'SAVINGS']),
  currencyCode: z.string().length(3).default('USD'),
  openingDeposit: moneyAmount.optional(),
});
export type OpenAccountInput = z.infer<typeof openAccountSchema>;

export const accountIdParamSchema = z.object({
  accountId: z.string().uuid('must be a valid account id'),
});

export const searchAccountsQuerySchema = z.object({
  q: z.string().trim().max(50).optional(),
  customerId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'FROZEN', 'CLOSED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type SearchAccountsQuery = z.infer<typeof searchAccountsQuerySchema>;

export const depositSchema = z.object({
  amount: moneyAmount,
  description: z.string().trim().max(255).optional(),
});
export type DepositInput = z.infer<typeof depositSchema>;

export const withdrawSchema = z.object({
  amount: moneyAmount,
  description: z.string().trim().max(255).optional(),
});
export type WithdrawInput = z.infer<typeof withdrawSchema>;

// Note: the "source and destination account can't be the same" check
// requires the :accountId route param, which isn't available inside this
// schema — that check is enforced in accounts.service.ts instead.
export const transferSchema = z.object({
  toAccountId: z.string().uuid('must be a valid destination account id'),
  amount: moneyAmount,
  description: z.string().trim().max(255).optional(),
});
export type TransferInput = z.infer<typeof transferSchema>;

export const transactionHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type TransactionHistoryQuery = z.infer<typeof transactionHistoryQuerySchema>;
