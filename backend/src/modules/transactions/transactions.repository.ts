import { PoolClient } from 'pg';
import { query } from '@/db/pool';

export interface TransactionRecord {
  transaction_id: string;
  account_id: string;
  related_account_id: string | null;
  transaction_type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  amount: string;
  balance_after: string;
  description: string | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  transfer_group_id: string | null;
  created_at: string;
}

interface InsertTransactionParams {
  accountId: string;
  relatedAccountId?: string;
  transactionType: TransactionRecord['transaction_type'];
  amount: string;
  balanceAfter: string;
  description?: string;
  transferGroupId?: string;
}

export const transactionsRepository = {
  /** Inserts a single ledger row. Always called inside withTransaction(). */
  async insert(params: InsertTransactionParams, client: PoolClient): Promise<TransactionRecord> {
    const result = await client.query<TransactionRecord>(
      `INSERT INTO transactions
         (account_id, related_account_id, transaction_type, amount, balance_after, description, transfer_group_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        params.accountId,
        params.relatedAccountId ?? null,
        params.transactionType,
        params.amount,
        params.balanceAfter,
        params.description ?? null,
        params.transferGroupId ?? null,
      ],
    );
    return result.rows[0];
  },

  async findByAccount(accountId: string, page: number, pageSize: number): Promise<{ rows: TransactionRecord[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const [rowsResult, countResult] = await Promise.all([
      query<TransactionRecord>(
        `SELECT * FROM transactions WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [accountId, pageSize, offset],
      ),
      query<{ count: string }>(`SELECT COUNT(*) FROM transactions WHERE account_id = $1`, [accountId]),
    ]);
    return { rows: rowsResult.rows, total: Number(countResult.rows[0].count) };
  },

  async findRecent(limit: number): Promise<TransactionRecord[]> {
    const result = await query<TransactionRecord>(
      `SELECT * FROM transactions ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows;
  },
};
