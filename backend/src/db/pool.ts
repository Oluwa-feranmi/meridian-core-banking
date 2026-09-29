import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '@/config';
import { childLogger } from '@/utils/logger';

const log = childLogger('db');

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  ssl: false,
  max: config.db.poolMax,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Fired for errors on idle clients in the pool (e.g. the DB restarted).
  // This must not crash the process — the pool recovers connections on
  // the next query — but it must be visible in CloudWatch Logs.
  log.error({ err }, 'Unexpected error on idle database client');
});

/**
 * Runs a single query against the pool. Prefer this for reads and
 * single-statement writes. Always uses parameterized queries ($1, $2, ...)
 * — string-concatenated SQL is not used anywhere in this codebase, which
 * is the primary SQL-injection defense (see README.md's Security notes).
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    log.debug({ durationMs: Date.now() - start, rowCount: result.rowCount }, 'query executed');
    return result;
  } catch (err) {
    log.error({ err, durationMs: Date.now() - start }, 'query failed');
    throw err;
  }
}

/**
 * Runs `work` inside a single database transaction on a dedicated client.
 * Used for every operation that must be atomic across multiple statements
 * — most importantly deposits, withdrawals, and transfers, where the
 * balance update and the transaction-history insert must succeed or fail
 * together.
 *
 * `performedBy`, if provided, is set as a session-local value that the
 * `log_audit_event()` database trigger reads to attribute the resulting
 * audit_logs rows to the authenticated caller (see db/migrations/002).
 */
export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
  performedBy?: string,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (performedBy) {
      // set_config with is_local=true behaves like `SET LOCAL` but accepts
      // a bind parameter, avoiding string interpolation into SQL text.
      await client.query('SELECT set_config($1, $2, true)', ['meridian.performed_by', performedBy]);
    }
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    log.error({ err }, 'database health check failed');
    return false;
  }
}
