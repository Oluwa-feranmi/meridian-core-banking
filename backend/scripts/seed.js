/**
 * Applies every .sql file in db/seeds, in filename order. Unlike migrate.js,
 * this does NOT track what's already been applied — seed data is meant for
 * local/dev databases you're happy to reset, not a one-time-only operation
 * against a persistent environment.
 *
 * Usage:
 *   node scripts/seed.js
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// In development: ../../db/seeds (relative to backend/scripts/)
// In production/ECS: /app/db/seeds (copied into container at /app)
const SEEDS_DIR = process.env.NODE_ENV === 'production'
  ? '/app/db/seeds'
  : path.resolve(__dirname, '../../db/seeds');

async function main() {
  console.log(`Looking for seeds in: ${SEEDS_DIR}`);
  
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const files = fs
    .readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf-8');
    console.log(`seeding: ${file}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`FAILED: ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log('Seed data applied.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
