declare module 'pg' {
  export interface PoolConfig {
    user?: string;
    password?: string;
    host?: string;
    port?: number;
    database?: string;
    ssl?: boolean | any;
    max?: number;
    connectionTimeoutMillis?: number;
    idleTimeoutMillis?: number;
    [key: string]: any;
  }

  export interface QueryResult<T = any> {
    rows: T[];
    rowCount: number;
    command: string;
    oid: number;
    fields: FieldDef[];
  }

  interface FieldDef {
    name: string;
    tableID: number;
    columnID: number;
    dataTypeID: number;
    dataTypeSize: number;
    dataTypeModifier: number;
    format: string;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
    query<T = any>(queryText: string, values?: any[]): Promise<QueryResult<T>>;
    on(event: string, listener: (...args: any[]) => void): this;
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }

  export class PoolClient {
    release(err?: Error): void;
    query<T = any>(queryText: string, values?: any[]): Promise<QueryResult<T>>;
  }
}