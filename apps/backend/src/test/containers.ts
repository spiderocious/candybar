import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';

export interface TestStack {
  pg: StartedPostgreSqlContainer;
  redis: StartedTestContainer;
}

/**
 * Spins up a throwaway Postgres + Redis for integration/E2E tests, points env at
 * them, and runs migrations. Call once per test file in beforeAll.
 */
export async function startStack(): Promise<TestStack> {
  const [pg, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('communique')
      .withUsername('communique')
      .withPassword('communique')
      .start(),
    new GenericContainer('redis:7-alpine').withExposedPorts(6379).start(),
  ]);

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = pg.getConnectionUri();
  process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;
  process.env.PROVIDER_ENCRYPTION_KEY = randomBytes(32).toString('base64');

  // Run migrations programmatically against the fresh container.
  const migrationRunner = (await import('node-pg-migrate')).default;
  const run =
    (migrationRunner as unknown as { default?: typeof migrationRunner }).default ?? migrationRunner;
  await run({
    databaseUrl: process.env.DATABASE_URL,
    dir: fileURLToPath(new URL('../../migrations', import.meta.url)),
    direction: 'up',
    count: Infinity,
    migrationsTable: 'pgmigrations',
    checkOrder: false,
  });

  return { pg, redis };
}

export async function stopStack(stack: TestStack): Promise<void> {
  await Promise.all([stack.pg.stop(), stack.redis.stop()]);
}

/** Truncate every table between tests (keeps the migration record). */
export async function truncateAll(): Promise<void> {
  const { pool } = await import('../lib/db.js');
  await pool.query(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public'
                AND tablename <> 'pgmigrations') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
}
