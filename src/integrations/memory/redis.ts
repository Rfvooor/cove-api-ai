import { createClient, RedisClientType, RedisClientOptions } from 'redis';
import { BaseMemoryStore, MemoryStoreConfig, VectorSearchResult, MemoryQueryOptions, MemoryEntry } from './base.js';

interface RedisScanResult {
  cursor: number;
  keys: string[];
}

interface RedisInfoResult {
  used_memory: string;
  connected_clients: string;
  [key: string]: string;
}

export interface RedisMemoryConfig extends MemoryStoreConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttl?: number; // Time to live in seconds
  clientOptions?: Partial<RedisClientOptions>;
}

export class RedisMemoryStore extends BaseMemoryStore {
  private client: RedisClientType;
  private readonly keyPrefix: string;
  private readonly ttl: number;
  private isInitialized: boolean = false;
  protected readonly config: RedisMemoryConfig;

  constructor(config: RedisMemoryConfig) {
    super(config);
    this.config = config;
    this.keyPrefix = config.keyPrefix || 'memory:';
    this.ttl = config.ttl || 24 * 60 * 60; // Default 24 hours

    const url = config.url || `redis://${config.host || 'localhost'}:${config.port || 6379}`;
    this.client = createClient({
      url,
      password: config.password,
      database: config.db,
      ...config.clientOptions
    });

    this.client.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this.client.on('connect', () => {
      this.emit('connected');
    });

    this.client.on('end', () => {
      this.emit('disconnected');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isInitialized = true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    this.isInitialized = false;
  }

  isConnected(): boolean {
    return this.isInitialized && this.client.isReady;
  }

  private getKey(id: string): string {
    return `${this.keyPrefix}${id}`;
  }

  private getIndexKey(type: string): string {
    return `${this.keyPrefix}index:${type}`;
  }

  async add(entry: MemoryEntry): Promise<string> {
    this.validateEntry(entry);

    const key = this.getKey(entry.id);
    const indexKey = this.getIndexKey(entry.type);

    await this.retry(async () => {
      const multi = this.client.multi();

      // Store the entry with new fields
      multi.hSet(key, {
        content: entry.content,
        type: entry.type,
        role: entry.role || '',
        timestamp: entry.timestamp.toString(),
        token_count: entry.tokenCount.toString(),
        metadata: JSON.stringify(entry.metadata || {}),
        embedding: entry.embedding ? JSON.stringify(entry.embedding) : '',
        tags: JSON.stringify(entry.tags || []),
        importance: (entry.importance || 0.5).toString(),
        is_consolidated: (entry.metadata?.isConsolidated || false).toString(),
        consolidation_score: (entry.metadata?.consolidationScore || 0).toString(),
        consolidated_from: JSON.stringify(entry.metadata?.consolidatedFrom || []),
        is_archived: (entry.metadata?.isArchived || false).toString(),
        archive_reason: entry.metadata?.archiveReason || ''
      });

      // Set TTL if configured
      if (this.ttl > 0) {
        multi.expire(key, this.ttl);
      }

      // Add to type index
      multi.zAdd(indexKey, {
        score: entry.timestamp,
        value: entry.id
      });

      await multi.exec();
    });

    return entry.id;
  }

  async addMany(entries: MemoryEntry[]): Promise<string[]> {
    const multi = this.client.multi();

    for (const entry of entries) {
      this.validateEntry(entry);
      const key = this.getKey(entry.id);
      const indexKey = this.getIndexKey(entry.type);

      // Store the entry
      multi.hSet(key, {
        content: entry.content,
        type: entry.type,
        role: entry.role || '',
        timestamp: entry.timestamp.toString(),
        token_count: entry.tokenCount.toString(),
        metadata: JSON.stringify(entry.metadata || {}),
        embedding: entry.embedding ? JSON.stringify(entry.embedding) : '',
        tags: JSON.stringify(entry.tags || [])
      });

      // Set TTL if configured
      if (this.ttl > 0) {
        multi.expire(key, this.ttl);
      }

      // Add to type index
      multi.zAdd(indexKey, {
        score: entry.timestamp,
        value: entry.id
      });
    }

    await this.retry(() => multi.exec());

    return entries.map(entry => entry.id);
  }

  async get(id: string): Promise<MemoryEntry | null> {
    const key = this.getKey(id);
    const data = await this.retry(() => this.client.hGetAll(key));

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return this.mapRedisDataToEntry(id, data);
  }

  async update(id: string, entry: Partial<MemoryEntry>): Promise<void> {
    const key = this.getKey(id);
    const updates = this.createEmptyRecord();

    if (entry.content !== undefined) updates.content = entry.content;
    if (entry.type !== undefined) updates.type = entry.type;
    if (entry.role !== undefined) updates.role = entry.role || '';
    if (entry.timestamp !== undefined) updates.timestamp = entry.timestamp.toString();
    if (entry.tokenCount !== undefined) updates.token_count = entry.tokenCount.toString();
    if (entry.metadata !== undefined) updates.metadata = JSON.stringify(entry.metadata);
    if (entry.embedding !== undefined) updates.embedding = JSON.stringify(entry.embedding);
    if (entry.tags !== undefined) updates.tags = JSON.stringify(entry.tags);

    if (Object.keys(updates).length > 0) {
      await this.retry(() => this.client.hSet(key, updates));

      // Reset TTL if configured
      if (this.ttl > 0) {
        await this.client.expire(key, this.ttl);
      }
    }
  }

  async delete(id: string): Promise<void> {
    const key = this.getKey(id);
    await this.retry(() => this.client.del(key));
  }

  async clear(): Promise<void> {
    const pattern = `${this.keyPrefix}*`;
    let cursor = 0;
    do {
      const result = await this.retry<RedisScanResult>(() =>
        this.client.scan(cursor, { MATCH: pattern, COUNT: 100 })
      );
      cursor = result.cursor;
      
      if (result.keys.length > 0) {
        await this.client.del(result.keys);
      }
    } while (cursor !== 0);
  }

  async search(query: string, options: MemoryQueryOptions = {}): Promise<VectorSearchResult[]> {
    const {
      limit = 10,
      offset = 0,
      filter = {},
      includeMetadata = true,
      minScore = 0.0
    } = options;

    // Redis doesn't have built-in full-text search without RedisSearch module
    // This is a basic implementation using pattern matching
    const pattern = `${this.keyPrefix}*`;
    const results: VectorSearchResult[] = [];
    let cursor = 0;

    do {
      const scanResult = await this.retry<RedisScanResult>(() =>
        this.client.scan(cursor, { MATCH: pattern, COUNT: 100 })
      );
      cursor = scanResult.cursor;

      for (const key of scanResult.keys) {
        const data = await this.client.hGetAll(key);
        if (!data || typeof data !== 'object') continue;

        const dataRecord = data as Record<string, string>;
        // Calculate score with importance and consolidation factors
        const score = this.calculateTextMatchScore(dataRecord.content, query, dataRecord);
        if (score > minScore) {
          const entry = this.mapRedisDataToEntry(key.replace(this.keyPrefix, ''), dataRecord);
          
          // Apply filters
          if (this.matchesFilter(entry, filter)) {
            results.push({ entry, score });
          }
        }
      }
    } while (cursor !== 0);

    // Sort by score and apply pagination
    return results
      .sort((a, b) => b.score - a.score)
      .slice(offset, offset + limit);
  }

  async similaritySearch(embedding: number[], options: MemoryQueryOptions = {}): Promise<VectorSearchResult[]> {
    const {
      limit = 10,
      offset = 0,
      filter = {},
      includeMetadata = true,
      minScore = 0.0
    } = options;

    // Basic vector similarity search
    const pattern = `${this.keyPrefix}*`;
    const results: VectorSearchResult[] = [];
    let cursor = 0;

    do {
      const scanResult = await this.retry<RedisScanResult>(() =>
        this.client.scan(cursor, { MATCH: pattern, COUNT: 100 })
      );
      cursor = scanResult.cursor;

      for (const key of scanResult.keys) {
        const data = await this.client.hGetAll(key);
        if (!data || typeof data !== 'object') continue;

        const dataRecord = data as Record<string, string>;
        if (!dataRecord.embedding) continue;

        try {
          const entryEmbedding = JSON.parse(dataRecord.embedding);
          if (!Array.isArray(entryEmbedding)) continue;

          const baseScore = this.cosineSimilarity(embedding, entryEmbedding);
          const importance = parseFloat(dataRecord.importance || '0.5');
          const isConsolidated = dataRecord.is_consolidated === 'true';
          const consolidationScore = parseFloat(dataRecord.consolidation_score || '0');
          const isArchived = dataRecord.is_archived === 'true';

          // Apply the same scoring modifiers as text search
          const finalScore = baseScore *
            (1 + importance) *
            (isConsolidated ? (1 + consolidationScore) : 1) *
            (isArchived ? 0.5 : 1);

          if (finalScore > minScore) {
            const entry = this.mapRedisDataToEntry(key.replace(this.keyPrefix, ''), dataRecord);
            
            if (this.matchesFilter(entry, filter)) {
              results.push({ entry, score: finalScore });
            }
          }
        } catch {
          continue;
        }
      }
    } while (cursor !== 0);

    return results
      .sort((a, b) => b.score - a.score)
      .slice(offset, offset + limit);
  }

  async count(): Promise<number> {
    const pattern = `${this.keyPrefix}*`;
    let total = 0;
    let cursor = 0;

    do {
      const result = await this.retry<RedisScanResult>(() =>
        this.client.scan(cursor, { MATCH: pattern, COUNT: 100 })
      );
      cursor = result.cursor;
      total += result.keys.length;
    } while (cursor !== 0);

    return total;
  }

  private createEmptyRecord(): Record<string, string> {
    return Object.create(null) as Record<string, string>;
  }

  async getMetrics(): Promise<Record<string, any>> {
    const info = await this.retry<string>(() => this.client.info());
    const dbSize = await this.retry<number>(() => this.client.dbSize());
    
    const metrics: Record<string, any> = {
      totalEntries: await this.count(),
      dbSize,
      typeDistribution: {},
      memoryUsage: 0,
      connectionCount: 0
    };

    // Parse Redis INFO command output
    const infoLines = info.split('\n');
    for (const line of infoLines) {
      if (line.includes('used_memory:')) {
        metrics.memoryUsage = parseInt(line.split(':')[1]);
      }
      if (line.includes('connected_clients:')) {
        metrics.connectionCount = parseInt(line.split(':')[1]);
      }
    }

    // Get type distribution
    const pattern = `${this.keyPrefix}*`;
    let cursor = 0;
    do {
      const result = await this.retry<RedisScanResult>(() =>
        this.client.scan(cursor, { MATCH: pattern, COUNT: 100 })
      );
      cursor = result.cursor;

      for (const key of result.keys) {
        const type = await this.client.hGet(key, 'type');
        if (typeof type === 'string') {
          metrics.typeDistribution[type] = (metrics.typeDistribution[type] || 0) + 1;
        }
      }
    } while (cursor !== 0);

    return metrics;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  private mapRedisDataToEntry(id: string, data: Record<string, string>): MemoryEntry {
    const metadata = data.metadata ? JSON.parse(data.metadata) : {};
    const consolidatedFrom = data.consolidated_from ? JSON.parse(data.consolidated_from) : [];

    return {
      id,
      content: data.content,
      type: data.type as MemoryEntry['type'],
      role: data.role as MemoryEntry['role'],
      timestamp: parseInt(data.timestamp),
      tokenCount: parseInt(data.token_count),
      importance: parseFloat(data.importance || '0.5'),
      metadata: {
        ...metadata,
        isConsolidated: data.is_consolidated === 'true',
        consolidationScore: parseFloat(data.consolidation_score || '0'),
        consolidatedFrom,
        isArchived: data.is_archived === 'true',
        archiveReason: data.archive_reason || ''
      },
      embedding: data.embedding ? JSON.parse(data.embedding) : undefined,
      tags: data.tags ? JSON.parse(data.tags) : undefined
    };
  }

  private calculateTextMatchScore(text: string, query: string, data: Record<string, string>): number {
    const normalizedText = text.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    const queryWords = normalizedQuery.split(/\s+/);
    
    let matchCount = 0;
    for (const word of queryWords) {
      if (normalizedText.includes(word)) {
        matchCount++;
      }
    }

    const baseScore = matchCount / queryWords.length;
    const importance = parseFloat(data.importance || '0.5');
    const isConsolidated = data.is_consolidated === 'true';
    const consolidationScore = parseFloat(data.consolidation_score || '0');
    const isArchived = data.is_archived === 'true';

    // Apply the same scoring modifiers as PostgresMemoryStore
    return baseScore *
      (1 + importance) *
      (isConsolidated ? (1 + consolidationScore) : 1) *
      (isArchived ? 0.5 : 1);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private matchesFilter(entry: MemoryEntry, filter: Record<string, any>): boolean {
    return Object.entries(filter).every(([key, value]) => {
      if (key === 'metadata' && entry.metadata) {
        return Object.entries(value).every(([k, v]) => entry.metadata![k] === v);
      }
      return (entry as any)[key] === value;
    });
  }
}