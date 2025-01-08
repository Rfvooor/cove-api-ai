import { BaseMemoryStore } from './base.js';
import { PostgresMemoryStore, PostgresMemoryConfig } from './postgres.js';
import { RedisMemoryStore, RedisMemoryConfig } from './redis.js';
import { ChromaMemoryStore, ChromaMemoryConfig } from './chroma.js';
import { PineconeMemoryStore, PineconeMemoryConfig } from './pinecone.js';

export type MemoryStoreType = 'postgres' | 'redis' | 'chroma' | 'pinecone';

export type MemoryFactoryConfig = 
  | { type: 'postgres'; config: PostgresMemoryConfig }
  | { type: 'redis'; config: RedisMemoryConfig }
  | { type: 'chroma'; config: ChromaMemoryConfig }
  | { type: 'pinecone'; config: PineconeMemoryConfig };

export class MemoryFactory {
  static async create(config: MemoryFactoryConfig): Promise<BaseMemoryStore> {
    switch (config.type) {
      case 'postgres':
        return this.createPostgresStore(config.config);
      case 'redis':
        return this.createRedisStore(config.config);
      case 'chroma':
        return this.createChromaStore(config.config);
      case 'pinecone':
        return this.createPineconeStore(config.config);
      default:
        throw new Error(`Unsupported memory store type: ${(config as any).type || 'unknown'}`);
    }
  }

  private static async createPostgresStore(config: PostgresMemoryConfig): Promise<PostgresMemoryStore> {
    const store = new PostgresMemoryStore(config);
    await store.connect();
    return store;
  }

  private static async createRedisStore(config: RedisMemoryConfig): Promise<RedisMemoryStore> {
    const store = new RedisMemoryStore(config);
    await store.connect();
    return store;
  }

  private static async createChromaStore(config: ChromaMemoryConfig): Promise<ChromaMemoryStore> {
    const store = new ChromaMemoryStore(config);
    await store.connect();
    return store;
  }

  private static async createPineconeStore(config: PineconeMemoryConfig): Promise<PineconeMemoryStore> {
    const store = new PineconeMemoryStore(config);
    await store.connect();
    return store;
  }

  static async createDistributed(configs: MemoryFactoryConfig[]): Promise<BaseMemoryStore[]> {
    return Promise.all(configs.map(config => this.create(config)));
  }

  static getDefaultConfig(type: MemoryStoreType): MemoryFactoryConfig {
    switch (type) {
      case 'postgres':
        return {
          type: 'postgres',
          config: {
            host: 'localhost',
            port: 5432,
            database: 'cove_memory',
            user: 'cove',
            password: 'cove_secret',
            schema: 'public',
            maxConnections: 10,
            namespace: 'default'
          }
        };
      case 'redis':
        return {
          type: 'redis',
          config: {
            host: 'localhost',
            port: 6379,
            keyPrefix: 'memory:',
            ttl: 24 * 60 * 60, // 24 hours
            namespace: 'default'
          }
        };
      case 'chroma':
        return {
          type: 'chroma',
          config: {
            host: 'localhost',
            port: 8000,
            collectionName: 'memory_store',
            namespace: 'default'
          }
        };
      case 'pinecone':
        return {
          type: 'pinecone',
          config: {
            apiKey: process.env.PINECONE_API_KEY || '',
            environment: 'us-east-1',
            indexName: 'cove-memory',
            dimension: 1536, 
            metric: 'cosine',
            namespace: 'default'
          }
        };
      default:
        throw new Error(`Unsupported memory store type: ${type}`);
    }
  }

  static async healthCheck(store: BaseMemoryStore): Promise<{
    healthy: boolean;
    metrics?: Record<string, any>;
    error?: string;
  }> {
    try {
      const healthy = await store.healthCheck();
      if (!healthy) {
        return {
          healthy: false,
          error: 'Health check failed'
        };
      }

      const metrics = await store.getMetrics();
      return {
        healthy: true,
        metrics
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  // should override this in each store
  static async migrateData(
    source: BaseMemoryStore,
    target: BaseMemoryStore,
    options: {
      batchSize?: number;
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<{
    totalMigrated: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    const { batchSize = 100, onProgress } = options;
    const errors: Array<{ id: string; error: string }> = [];
    let totalMigrated = 0;

    // Get total count for progress calculation
    const totalCount = await source.count();
    let processedCount = 0;

    try {
      // Process in batches
      while (processedCount < totalCount) {
        // Get batch of entries from source
        const entries = await source.search('', {
          limit: batchSize,
          offset: processedCount
        });

        // Add entries to target store
        for (const result of entries) {
          try {
            await target.add(result.entry);
            totalMigrated++;
          } catch (error) {
            errors.push({
              id: result.entry.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        processedCount += entries.length;

        if (onProgress) {
          onProgress((processedCount / totalCount) * 100);
        }
      }
    } catch (error) {
      errors.push({
        id: 'batch_processing',
        error: error instanceof Error ? error.message : 'Unknown error during batch processing'
      });
    }

    return {
      totalMigrated,
      errors
    };
  }

  static async cleanup(store: BaseMemoryStore): Promise<void> {
    try {
      await store.clear();
      await store.disconnect();
    } catch (error) {
      throw new Error(`Failed to cleanup memory store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}