// Base types and interfaces
export {
  BaseMemoryStore,
  MemoryStoreConfig,
  MemoryQueryOptions,
  VectorSearchResult,
  MemoryEntry,
  MemoryEntryType,
  MemoryEntryRole
} from './base.js';

// Memory store implementations
export { PostgresMemoryStore, type PostgresMemoryConfig } from './postgres.js';
export { RedisMemoryStore, type RedisMemoryConfig } from './redis.js';
export { ChromaMemoryStore, type ChromaMemoryConfig } from './chroma.js';
export { PineconeMemoryStore, type PineconeMemoryConfig } from './pinecone.js';

// Memory management
export { MemoryManager, type MemoryManagerConfig } from './manager.js';
export { 
  MemoryFactory, 
  type MemoryFactoryConfig, 
  type MemoryStoreType 
} from './factory.js';

// Example usage:
/*
import {
  MemoryManager,
  MemoryFactory,
  MemoryEntry,
  PostgresMemoryConfig,
  RedisMemoryConfig,
  ChromaMemoryConfig,
  PineconeMemoryConfig
} from './memory';

// Create a memory manager with multiple stores
const manager = new MemoryManager({
  primaryStore: {
    type: 'postgres',
    config: {
      host: 'localhost',
      port: 5432,
      database: 'cove_memory',
      user: 'cove',
      password: 'cove_secret'
    }
  },
  fallbackStores: [
    {
      type: 'redis',
      config: {
        host: 'localhost',
        port: 6379,
        keyPrefix: 'memory:'
      }
    }
  ],
  distributedStores: [
    {
      type: 'chroma',
      config: {
        host: 'localhost',
        port: 8000,
        collectionName: 'memory_store'
      }
    }
  ],
  replicationEnabled: true
});

// Initialize the memory system
await manager.initialize();

// Store a memory entry
const entry: MemoryEntry = {
  id: 'msg_123',
  content: 'Hello, world!',
  type: 'message',
  role: 'assistant',
  timestamp: Date.now(),
  tokenCount: 3,
  metadata: {
    conversationId: 'conv_123'
  }
};

await manager.add(entry);

// Search for content
const results = await manager.search('hello', {
  limit: 5,
  filter: {
    type: 'message'
  }
});

// Clean up
await manager.cleanup();
*/

// Default configurations
export const defaultConfigs = {
  postgres: {
    type: 'postgres' as const,
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
  },
  redis: {
    type: 'redis' as const,
    config: {
      host: 'localhost',
      port: 6379,
      keyPrefix: 'memory:',
      ttl: 24 * 60 * 60, // 24 hours
      namespace: 'default'
    }
  },
  chroma: {
    type: 'chroma' as const,
    config: {
      host: 'localhost',
      port: 8000,
      collectionName: 'memory_store',
      namespace: 'default'
    }
  },
  pinecone: {
    type: 'pinecone' as const,
    config: {
      apiKey: process.env.PINECONE_API_KEY || '',
      environment: 'us-east-1',
      indexName: 'cove-memory',
      dimension: 1536, // OpenAI embedding dimension
      metric: 'cosine',
      namespace: 'default'
    }
  }
} as const;

// Import required classes for helper functions
import { MemoryManager, MemoryManagerConfig } from './manager.js';
import { MemoryFactory, MemoryFactoryConfig, MemoryStoreType } from './factory.js';
import { BaseMemoryStore } from './base.js';
import { ChromaMemoryConfig } from './chroma.js';
import { PineconeMemoryConfig } from './pinecone.js';
import { PostgresMemoryConfig } from './postgres.js';
import { RedisMemoryConfig } from './redis.js';

// Helper functions
export function createMemoryManager(config: MemoryManagerConfig): MemoryManager {
  return new MemoryManager(config);
}

export async function createMemoryStore(config: MemoryFactoryConfig): Promise<BaseMemoryStore> {
  return MemoryFactory.create(config);
}

export async function createDistributedStores(configs: MemoryFactoryConfig[]): Promise<BaseMemoryStore[]> {
  return MemoryFactory.createDistributed(configs);
}

// Types for memory store events
export interface MemoryStoreEvents {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  retryAttempt: (info: { attempt: number; error: Error }) => void;
}

// Utility type for memory store options
export type MemoryStoreOptions = {
  [K in MemoryStoreType]: K extends 'postgres'
    ? PostgresMemoryConfig
    : K extends 'redis'
    ? RedisMemoryConfig
    : K extends 'chroma'
    ? ChromaMemoryConfig
    : K extends 'pinecone'
    ? PineconeMemoryConfig
    : never;
};