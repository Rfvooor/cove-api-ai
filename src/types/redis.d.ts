declare module 'redis' {
  export interface RedisClientOptions {
    url?: string;
    socket?: {
      host?: string;
      port?: number;
    };
    password?: string;
    database?: number;
    [key: string]: any;
  }

  export interface RedisMulti {
    hSet(key: string, field: string | Record<string, string>, value?: string): this;
    expire(key: string, seconds: number): this;
    zAdd(key: string, options: { score: number; value: string }): this;
    exec(): Promise<any[]>;
  }

  export interface RedisClientType {
    connect(): Promise<void>;
    quit(): Promise<void>;
    isReady: boolean;
    on(event: string, listener: (...args: any[]) => void): void;
    ping(): Promise<string>;
    info(): Promise<string>;
    dbSize(): Promise<number>;
    scan(cursor: number, options?: { MATCH?: string; COUNT?: number }): Promise<{ cursor: number; keys: string[] }>;
    hSet(key: string, field: string | Record<string, string>, value?: string): Promise<number>;
    hGet(key: string, field: string): Promise<string | null>;
    hGetAll(key: string): Promise<Record<string, string>>;
    del(key: string | string[]): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    zAdd(key: string, { score, value }: { score: number; value: string }): Promise<number>;
    multi(): RedisMulti;
  }

  export function createClient(options?: RedisClientOptions): RedisClientType;
}