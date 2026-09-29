/**
 * Shared helper for integration and API tests, which run against a REAL
 * PostgreSQL database — never mocked — because the whole point of this
 * schema (constraints, triggers, row locking) is that the database
 * enforces invariants the application code can't fake. See
 * docs/04-testing-guide.md for how to stand up the test database.
 *
 * IMPORTANT: this connects to whatever DB_* env vars are set at test run
 * time. The npm scripts in package.json set DB_NAME=meridian_test by
 * default so these tests can never accidentally run against your local
 * dev database (or, far worse, a real deployed one) and truncate it.
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { pool as appPool } from '@/db/pool';

dotenv.config({ path: '.env.test' });

export const testPool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'meridian_test',
  user: process.env.DB_USER ?? 'meridian_app',
  password: process.env.DB_PASSWORD ?? 'change_me_locally',
});

// Safety valve: refuse to run against anything that isn't obviously a
// test database, so a misconfigured .env can't cause these tests to wipe
// real data.
if (!/test/i.test(testPool.options.database ?? '')) {
  throw new Error(
    `Refusing to run tests against database "${testPool.options.database}" — ` +
      `its name must contain "test". Check DB_NAME in your test environment.`,
  );
}

const TABLES_IN_DEPENDENCY_ORDER = ['audit_logs', 'transactions', 'accounts', 'customers', 'api_users'];

/** Empties every table between tests so each test starts from a known-clean state. */
export async function truncateAllTables(): Promise<void> {
  await testPool.query(`TRUNCATE TABLE ${TABLES_IN_DEPENDENCY_ORDER.join(', ')} RESTART IDENTITY CASCADE`);
}

export async function closeTestPool(): Promise<void> {
  // Two separate pools are open during a test run: `testPool` (used
  // directly by test helpers, e.g. seedApiUser) and the application's own
  // `pool` singleton (used by every repository under test, imported
  // transitively the moment any src/ module loads). Both must be closed
  // or Jest hangs waiting for open TCP handles after the last test.
  await Promise.all([testPool.end(), appPool.end()]);
}
