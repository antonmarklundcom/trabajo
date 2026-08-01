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
    });
  }
  return globalForDb.dbPool;
}

export const db = drizzle(getPool(), { schema, mode: 'default' });
