/**
 * Applies every .sql file in db/migrations, in filename order, exactly
 * once. Already-applied filenames are tracked in a schema_migrations
 * table so re-running this script is safe (a real "migration tool," not
 * just a raw psql pipe).
 *
 * Usage:
 *   npm run migrate            (uses DB_* vars from .env, same as the app)
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations');

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const appliedResult = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  const applied = new Set(appliedResult.rows.map((r) => r.filename));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip  (already applied): ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`apply: ${file}`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`FAILED: ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log('All migrations applied.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
