import { z } from 'zod';

export const recentTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type RecentTransactionsQuery = z.infer<typeof recentTransactionsQuerySchema>;
