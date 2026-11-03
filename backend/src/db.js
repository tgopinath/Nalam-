import knex from 'knex';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from './config.js';

// NUMERIC -> number, DATE -> 'YYYY-MM-DD' string (avoid timezone shifts)
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1082, (v) => v);

const here = path.dirname(fileURLToPath(import.meta.url));

export const knexConfig = {
  client: 'pg',
  connection: config.databaseUrl,
  pool: { min: 0, max: 10 },
  migrations: { directory: path.join(here, 'migrations'), loadExtensions: ['.js'] },
};

export const db = knex(knexConfig);
