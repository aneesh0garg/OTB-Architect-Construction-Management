declare module 'pg' {
  export interface QueryResultRow {
    [column: string]: unknown;
  }

  export class Pool {
    constructor(options: { connectionString: string });
    query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ): Promise<{ rows: T[]; rowCount: number | null }>;
    connect(): Promise<{
      query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ): Promise<{ rows: T[]; rowCount: number | null }>;
      release(): void;
    }>;
    end(): Promise<void>;
  }
}
