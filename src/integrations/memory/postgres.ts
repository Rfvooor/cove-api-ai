import { PoolConfig, QueryResult } from 'pg';
import Pool from 'pg';
import { BaseMemoryStore, MemoryStoreConfig, VectorSearchResult, MemoryQueryOptions, MemoryEntry } from './base.js';

export interface PostgresMemoryConfig extends MemoryStoreConfig {
  host?: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  schema?: string;
  tableName?: string;
  maxConnections?: number;
  connectionTimeout?: number;
  poolConfig?: Partial<PoolConfig>;
}

type MemoryEntryType = MemoryEntry['type'];
type MemoryEntryRole = MemoryEntry['role'];

interface PostgresMemoryRow {
  id: string;
  content: string;
  type: MemoryEntryType;
  role?: MemoryEntryRole;
  timestamp: number;
  token_count: number;
  metadata?: Record<string, any>;
  embedding?: number[];
  tags?: string[];
  importance?: number;
  last_accessed?: number;
  access_count?: number;
  related_memories?: string[];
  is_consolidated: boolean;
  consolidated_from?: string[];
  consolidation_score: number;
  is_archived: boolean;
  archive_reason?: string;
  score?: number;
  created_at: Date;
  updated_at: Date;
}
export class PostgresMemoryStore extends BaseMemoryStore {
  private pool: Pool;
  private readonly schema: string;
  private readonly tableName: string;
  private isInitialized: boolean = false;

  constructor(config: PostgresMemoryConfig) {
    super(config);
    this.schema = config.schema || 'public';
    this.tableName = config.tableName || 'memory_entries';
    
    this.pool = new Pool({
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      max: config.maxConnections,
      connectionTimeoutMillis: config.connectionTimeout,
      ...config.poolConfig
    });
  }

  async connect(): Promise<void> {
    try {
      // Test connection
      await this.pool.query('SELECT NOW()');
      
      // Initialize schema and table if they don't exist
      await this.initializeDatabase();
      
      this.isInitialized = true;
      this.emit('connected');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    this.isInitialized = false;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.isInitialized;
  }

  private async initializeDatabase(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create schema if it doesn't exist
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${this.schema}`);

      // Create the main table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.schema}.${this.tableName} (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('message', 'task', 'result', 'error', 'system', 'tool', 'conversation')),
          role TEXT CHECK (role IN ('system', 'user', 'assistant')),
          timestamp BIGINT NOT NULL,
          token_count INTEGER NOT NULL,
          metadata JSONB,
          embedding REAL[],
          tags TEXT[],
          importance REAL DEFAULT 0.5,
          last_accessed BIGINT,
          access_count INTEGER DEFAULT 0,
          related_memories TEXT[],
          is_consolidated BOOLEAN DEFAULT FALSE,
          consolidated_from TEXT[],
          consolidation_score REAL DEFAULT 0.0,
          is_archived BOOLEAN DEFAULT FALSE,
          archive_reason TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_type 
        ON ${this.schema}.${this.tableName}(type)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_timestamp 
        ON ${this.schema}.${this.tableName}(timestamp)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_tags 
        ON ${this.schema}.${this.tableName} USING GIN(tags)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_metadata
        ON ${this.schema}.${this.tableName} USING GIN(metadata)
      `);

      // Add indexes for new memory features
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_importance
        ON ${this.schema}.${this.tableName}(importance)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_consolidation
        ON ${this.schema}.${this.tableName}(is_consolidated, consolidation_score)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_archive
        ON ${this.schema}.${this.tableName}(is_archived)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_consolidated_from
        ON ${this.schema}.${this.tableName} USING GIN(consolidated_from)
      `);

      // Create update trigger for updated_at
      await client.query(`
        CREATE OR REPLACE FUNCTION ${this.schema}.update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

      await client.query(`
        DROP TRIGGER IF EXISTS update_${this.tableName}_updated_at 
        ON ${this.schema}.${this.tableName}
      `);

      await client.query(`
        CREATE TRIGGER update_${this.tableName}_updated_at
        BEFORE UPDATE ON ${this.schema}.${this.tableName}
        FOR EACH ROW
        EXECUTE FUNCTION ${this.schema}.update_updated_at_column()
      `);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async add(entry: MemoryEntry): Promise<string> {
    this.validateEntry(entry);
    
    const query = `
      INSERT INTO ${this.schema}.${this.tableName}
      (id, content, type, role, timestamp, token_count, metadata, embedding, tags, importance, last_accessed, access_count, related_memories)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;

    const values = [
      entry.id,
      entry.content,
      entry.type,
      entry.role,
      entry.timestamp,
      entry.tokenCount,
      entry.metadata || {},
      entry.embedding,
      entry.tags || [],
      entry.importance || 0.0,
      entry.lastAccessed || entry.timestamp,
      entry.accessCount || 0,
      entry.relatedMemories || []
    ];

    const result = await this.retry<QueryResult<{ id: string }>>(() => 
      this.pool.query(query, values)
    );

    return result.rows[0].id;
  }

  async addMany(entries: MemoryEntry[]): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const ids = await Promise.all(
        entries.map(entry => this.add(entry))
      );

      await client.query('COMMIT');
      return ids;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async get(id: string): Promise<MemoryEntry | null> {
    const query = `
      SELECT * FROM ${this.schema}.${this.tableName}
      WHERE id = $1
    `;

    const result = await this.retry<QueryResult<PostgresMemoryRow>>(() => 
      this.pool.query(query, [id])
    );

    return result.rows[0] ? this.mapRowToEntry(result.rows[0]) : null;
  }

  async update(id: string, entry: Partial<MemoryEntry>): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [id];
    let paramCount = 1;

    Object.entries(entry).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${this.snakeCase(key)} = $${++paramCount}`);
        values.push(value);
      }
    });

    if (updates.length === 0) return;

    const query = `
      UPDATE ${this.schema}.${this.tableName}
      SET ${updates.join(', ')}
      WHERE id = $1
    `;

    await this.retry<QueryResult<any>>(() => 
      this.pool.query(query, values)
    );
  }

  async delete(id: string): Promise<void> {
    const query = `
      DELETE FROM ${this.schema}.${this.tableName}
      WHERE id = $1
    `;

    await this.retry<QueryResult<any>>(() => 
      this.pool.query(query, [id])
    );
  }

  async clear(): Promise<void> {
    const query = `
      TRUNCATE TABLE ${this.schema}.${this.tableName}
    `;

    await this.retry<QueryResult<any>>(() => 
      this.pool.query(query)
    );
  }

  async search(query: string, options: MemoryQueryOptions = {}): Promise<VectorSearchResult[]> {
    const {
      limit = 10,
      offset = 0,
      filter = {},
      includeMetadata = true,
      minScore = 0.0
    } = options;

    // Build WHERE clause from filter
    const whereConditions: string[] = [];
    const values: any[] = [query];
    let paramCount = 1;

    Object.entries(filter).forEach(([key, value]) => {
      whereConditions.push(`${this.snakeCase(key)} = $${++paramCount}`);
      values.push(value);
    });

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Use full text search with importance and consolidation boosting
    const searchQuery = `
      SELECT *,
        (
          ts_rank(
            to_tsvector('english', content),
            plainto_tsquery('english', $1)
          ) * (1 + importance) *
          CASE
            WHEN is_consolidated THEN (1 + consolidation_score)
            ELSE 1
          END *
          CASE
            WHEN is_archived THEN 0.5
            ELSE 1
          END
        ) as score
      FROM ${this.schema}.${this.tableName}
      ${whereClause}
      HAVING score > $${++paramCount}
      ORDER BY score DESC
      LIMIT $${++paramCount}
      OFFSET $${++paramCount}
    `;

    values.push(minScore, limit, offset);

    const result = await this.retry<QueryResult<PostgresMemoryRow>>(() => 
      this.pool.query(searchQuery, values)
    );

    return result.rows.map(row => ({
      entry: this.mapRowToEntry(row, includeMetadata),
      score: row.score || 0
    }));
  }

  async similaritySearch(embedding: number[], options: MemoryQueryOptions = {}): Promise<VectorSearchResult[]> {
    const {
      limit = 10,
      offset = 0,
      filter = {},
      includeMetadata = true,
      minScore = 0.0
    } = options;

    // Build WHERE clause from filter
    const whereConditions: string[] = [];
    const values: any[] = [embedding];
    let paramCount = 1;

    Object.entries(filter).forEach(([key, value]) => {
      whereConditions.push(`${this.snakeCase(key)} = $${++paramCount}`);
      values.push(value);
    });

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Use cosine similarity with importance and consolidation boosting
    const searchQuery = `
      SELECT *,
        (
          (1 - (embedding <=> $1)) * (1 + importance) *
          CASE
            WHEN is_consolidated THEN (1 + consolidation_score)
            ELSE 1
          END *
          CASE
            WHEN is_archived THEN 0.5
            ELSE 1
          END
        ) as score
      FROM ${this.schema}.${this.tableName}
      ${whereClause}
      HAVING score > $${++paramCount}
      ORDER BY score DESC
      LIMIT $${++paramCount}
      OFFSET $${++paramCount}
    `;

    values.push(minScore, limit, offset);

    const result = await this.retry<QueryResult<PostgresMemoryRow>>(() => 
      this.pool.query(searchQuery, values)
    );

    return result.rows.map(row => ({
      entry: this.mapRowToEntry(row, includeMetadata),
      score: row.score || 0
    }));
  }

  async count(): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM ${this.schema}.${this.tableName}
    `;

    const result = await this.retry<QueryResult<{ count: string }>>(() => 
      this.pool.query(query)
    );

    return parseInt(result.rows[0].count);
  }

  async getMetrics(): Promise<Record<string, any>> {
    interface MetricsRow {
      total_entries: string;
      oldest_entry: Date;
      newest_entry: Date;
      avg_tokens: number;
    }

    interface TypeDistributionRow {
      type: string;
      count: string;
    }

    interface TableSizeRow {
      table_size: string;
    }

    const metrics = await this.retry(async () => {
      const results = await Promise.all([
        this.pool.query<MetricsRow>(`
          SELECT 
            COUNT(*) as total_entries,
            MIN(created_at) as oldest_entry,
            MAX(created_at) as newest_entry,
            AVG(token_count) as avg_tokens
          FROM ${this.schema}.${this.tableName}
        `),
        this.pool.query<TypeDistributionRow>(`
          SELECT type, COUNT(*) as count
          FROM ${this.schema}.${this.tableName}
          GROUP BY type
        `),
        this.pool.query<TableSizeRow>(`
          SELECT pg_size_pretty(pg_total_relation_size($1)) as table_size
        `, [`${this.schema}.${this.tableName}`])
      ]);

      return {
        ...results[0].rows[0],
        typeDistribution: results[1].rows.reduce((acc, row) => {
          acc[row.type] = parseInt(row.count);
          return acc;
        }, {} as Record<string, number>),
        tableSize: results[2].rows[0].table_size
      };
    });

    return metrics;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private mapRowToEntry(row: PostgresMemoryRow, includeMetadata: boolean = true): MemoryEntry {
    const entry: MemoryEntry = {
      id: row.id,
      content: row.content,
      type: row.type,
      role: row.role,
      timestamp: row.timestamp,
      tokenCount: row.token_count,
      importance: row.importance || 0.5,
      lastAccessed: row.last_accessed,
      accessCount: row.access_count,
      relatedMemories: row.related_memories
    };

    if (includeMetadata) {
      entry.metadata = {
        ...row.metadata,
        isConsolidated: row.is_consolidated,
        consolidatedFrom: row.consolidated_from,
        consolidationScore: row.consolidation_score,
        isArchived: row.is_archived,
        archiveReason: row.archive_reason
      };
      entry.embedding = row.embedding;
      entry.tags = row.tags;
    }

    return entry;
  }

  protected validateEntry(entry: MemoryEntry): void {
    super.validateEntry(entry);
  }

  protected async retry<T>(operation: () => Promise<T>): Promise<T> {
    return super.retry(operation);
  }

  private snakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}