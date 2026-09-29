import { PoolClient } from 'pg';
import { pool, query } from '@/db/pool';
import { SearchAccountsQuery } from '@/modules/accounts/accounts.schemas';

export interface AccountRecord {
  account_id: string;
  account_number: string;
  customer_id: string;
  account_type: 'CHECKING' | 'SAVINGS';
  currency_code: string;
  balance: string; // NUMERIC comes back from `pg` as a string to avoid precision loss
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  created_at: string;
  updated_at: string;
}

export const accountsRepository = {
  async create(
    params: { accountNumber: string; customerId: string; accountType: string; currencyCode: string; openingBalance: string },
    client: PoolClient = pool as unknown as PoolClient,
  ): Promise<AccountRecord> {
    const result = await client.query<AccountRecord>(
      `INSERT INTO accounts (account_number, customer_id, account_type, currency_code, balance)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [params.accountNumber, params.customerId, params.accountType, params.currencyCode, params.openingBalance],
    );
    return result.rows[0];
  },

  async findById(accountId: string): Promise<AccountRecord | null> {
    const result = await query<AccountRecord>(`SELECT * FROM accounts WHERE account_id = $1`, [accountId]);
    return result.rows[0] ?? null;
  },

  /**
   * Locks the account row (SELECT ... FOR UPDATE) within the caller's
   * transaction. Every money-movement operation (deposit, withdrawal,
   * transfer) starts by locking the row(s) it will update, so two
   * concurrent requests against the same account can never both read the
   * same starting balance and produce a lost update. This is the core
   * concurrency-safety mechanism for the whole ledger.
   */
  async findByIdForUpdate(accountId: string, client: PoolClient): Promise<AccountRecord | null> {
    const result = await client.query<AccountRecord>(
      `SELECT * FROM accounts WHERE account_id = $1 FOR UPDATE`,
      [accountId],
    );
    return result.rows[0] ?? null;
  },

  async updateBalance(accountId: string, newBalance: string, client: PoolClient): Promise<AccountRecord> {
    const result = await client.query<AccountRecord>(
      `UPDATE accounts SET balance = $1 WHERE account_id = $2 RETURNING *`,
      [newBalance, accountId],
    );
    return result.rows[0];
  },

  async search(params: SearchAccountsQuery): Promise<{ rows: AccountRecord[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (params.q) {
      conditions.push(`account_number ILIKE $${i}`);
      values.push(`%${params.q}%`);
      i += 1;
    }
    if (params.customerId) {
      conditions.push(`customer_id = $${i}`);
      values.push(params.customerId);
      i += 1;
    }
    if (params.status) {
      conditions.push(`status = $${i}`);
      values.push(params.status);
      i += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (params.page - 1) * params.pageSize;

    const [rowsResult, countResult] = await Promise.all([
      query<AccountRecord>(
        `SELECT * FROM accounts ${whereClause} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
        [...values, params.pageSize, offset],
      ),
      query<{ count: string }>(`SELECT COUNT(*) FROM accounts ${whereClause}`, values),
    ]);

    return { rows: rowsResult.rows, total: Number(countResult.rows[0].count) };
  },

  async listByCustomer(customerId: string): Promise<AccountRecord[]> {
    const result = await query<AccountRecord>(
      `SELECT * FROM accounts WHERE customer_id = $1 ORDER BY created_at`,
      [customerId],
    );
    return result.rows;
  },
};
