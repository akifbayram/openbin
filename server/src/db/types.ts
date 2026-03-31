export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export type TxQueryFn = <T = Record<string, any>>(
  sql: string,
  params?: unknown[],
) => Promise<QueryResult<T>>;

export interface DatabaseEngine {
  query<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  querySync<T = Record<string, any>>(sql: string, params?: unknown[]): QueryResult<T>;
  withTransaction<T>(fn: (query: TxQueryFn) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  readonly dialect: 'sqlite' | 'postgres';
}
