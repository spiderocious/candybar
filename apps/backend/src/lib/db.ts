import pg from 'pg';

import { env } from '../env.js';

const { Pool } = pg;

/**
 * Postgres connection pool. BIGINT (int8) is parsed as a JS number by default,
 * which is fine here — Communiqué stores no money, only counts/ids that stay
 * well within Number.MAX_SAFE_INTEGER.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export type Sql = pg.Pool | pg.PoolClient;

/** Run a function inside a transaction, rolling back on any throw. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
