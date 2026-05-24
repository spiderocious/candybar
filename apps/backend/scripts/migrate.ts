import { fileURLToPath } from 'node:url';

import migrationRunner from 'node-pg-migrate';

import { env } from '../src/env.js';

/**
 * Programmatic migration runner. We avoid the node-pg-migrate CLI because its
 * yargs dependency clashes with this workspace's ESM ("type":"module") scope
 * under Node 25. `up`/`down` is selected by the first CLI arg (default `up`).
 */
const direction = process.argv[2] === 'down' ? 'down' : 'up';
const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

// node-pg-migrate ships as CJS; default export is the runner.
const run = (migrationRunner as unknown as { default?: typeof migrationRunner }).default ??
  migrationRunner;

await run({
  databaseUrl: env.DATABASE_URL,
  dir: migrationsDir,
  direction,
  count: direction === 'down' ? 1 : Infinity,
  migrationsTable: 'pgmigrations',
  checkOrder: false,
});

// eslint-disable-next-line no-console
console.log(`migrations ${direction} complete`);
process.exit(0);
