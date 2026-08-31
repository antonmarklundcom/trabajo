import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { dbPool?: mysql.Pool };

function getPool(): mysql.Pool {
  if (!globalForDb.dbPool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    globalForDb.dbPool = mysql.createPool({
      uri: url,
      connectionLimit: 8,
      timezone: 'Z',
      // A request that can't get a connection must fail in seconds so its
      // process is released, rather than hang and eat into the account's
      // shared process limit on Hostinger.
      waitForConnections: true,
      queueLimit: 24,
      connectTimeout: 8_000,
    });
  }
  return globalForDb.dbPool;
}

export const db = drizzle(getPool(), { schema, mode: 'default' });
