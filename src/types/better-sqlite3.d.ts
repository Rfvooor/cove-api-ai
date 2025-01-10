declare module 'better-sqlite3' {
  namespace BetterSqlite3 {
    interface Database {
      prepare<T = any>(sql: string): Statement<T>;
      exec(sql: string): void;
      close(): void;
      transaction<T>(fn: () => T): T;
    }

    interface Statement<T = any> {
      run(...params: any[]): RunResult;
      get(...params: any[]): T;
      all(...params: any[]): T[];
      iterate(...params: any[]): IterableIterator<T>;
    }

    interface RunResult {
      changes: number;
      lastInsertRowid: number | bigint;
    }

    interface DatabaseOptions {
      readonly?: boolean;
      fileMustExist?: boolean;
      timeout?: number;
      verbose?: (message?: any, ...additionalArgs: any[]) => void;
    }
  }

  interface DatabaseConstructor {
    new (filename: string, options?: BetterSqlite3.DatabaseOptions): BetterSqlite3.Database;
    (filename: string, options?: BetterSqlite3.DatabaseOptions): BetterSqlite3.Database;
  }

  const Database: DatabaseConstructor;
  export = Database;
}