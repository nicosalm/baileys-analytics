import { Pool, QueryResultRow } from 'pg';
import { dbConfig } from '../config/env';

const pool = new Pool({
  connectionString: dbConfig.connectionString || 'postgresql://postgres:localdev123@127.0.0.1:5432/baileys_analytics',
  max: dbConfig.max,
  idleTimeoutMillis: dbConfig.idleTimeoutMillis,
  connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
});

export type DbResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export const query = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<DbResult<T[]>> => {
  try {
    const result = await pool.query<T>(text, params);
    return { success: true, data: result.rows };
  } catch (error) {
    console.error('Database query error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
};

export const transaction = async <T>(
  callback: (client: any) => Promise<T>
): Promise<DbResult<T>> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return { success: true, data: result };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transaction failed'
    };
  } finally {
    client.release();
  }
};

export const withConnection = async <T>(
  callback: (client: any) => Promise<DbResult<T>>
): Promise<DbResult<T>> => {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
};
