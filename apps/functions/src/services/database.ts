import { Pool, QueryResultRow } from 'pg';

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  database: 'baileys_analytics',
  user: 'postgres',
  password: 'localdev123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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
