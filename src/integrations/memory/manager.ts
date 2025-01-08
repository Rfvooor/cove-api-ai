import { BaseMemoryStore, MemoryEntry, MemoryQueryOptions, VectorSearchResult } from './base.js';
import { MemoryFactory, MemoryFactoryConfig } from './factory.js';

export interface MemoryManagerConfig {
  primaryStore: MemoryFactoryConfig;
  fallbackStores?: MemoryFactoryConfig[];
  distributedStores?: MemoryFactoryConfig[];
  cacheEnabled?: boolean;
  cacheTTL?: number;
  replicationEnabled?: boolean;
  consistencyCheck?: boolean;
  consistencyCheckInterval?: number;
}

export class MemoryManager {
  private primaryStore!: BaseMemoryStore;
  private fallbackStores: BaseMemoryStore[] = [];
  private distributedStores: BaseMemoryStore[] = [];
  private isInitialized = false;

  constructor(private config: MemoryManagerConfig) {}

  async initialize(): Promise<void> {
    try {
      // Initialize primary store
      this.primaryStore = await MemoryFactory.create(this.config.primaryStore);

      // Initialize fallback stores if configured
      if (this.config.fallbackStores) {
        this.fallbackStores = await MemoryFactory.createDistributed(
          this.config.fallbackStores
        );
      }

      // Initialize distributed stores if configured
      if (this.config.distributedStores) {
        this.distributedStores = await MemoryFactory.createDistributed(
          this.config.distributedStores
        );
      }

      this.isInitialized = true;

      // Start consistency check if enabled
      if (this.config.consistencyCheck) {
        this.startConsistencyCheck();
      }
    } catch (error) {
      throw new Error(`Failed to initialize memory manager: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Memory manager is not initialized');
    }
  }

  async add(entry: MemoryEntry): Promise<string> {
    this.ensureInitialized();

    try {
      // Add to primary store
      const id = await this.primaryStore.add(entry);

      // Replicate to distributed stores if enabled
      if (this.config.replicationEnabled && this.distributedStores.length > 0) {
        await Promise.all(
          this.distributedStores.map(store => store.add(entry))
        );
      }

      return id;
    } catch (error) {
      // Try fallback stores if primary fails
      if (this.fallbackStores.length > 0) {
        for (const store of this.fallbackStores) {
          try {
            return await store.add(entry);
          } catch {
            continue;
          }
        }
      }
      throw error;
    }
  }

  async addMany(entries: MemoryEntry[]): Promise<string[]> {
    this.ensureInitialized();

    try {
      // Add to primary store
      const ids = await this.primaryStore.addMany(entries);

      // Replicate to distributed stores if enabled
      if (this.config.replicationEnabled && this.distributedStores.length > 0) {
        await Promise.all(
          this.distributedStores.map(store => store.addMany(entries))
        );
      }

      return ids;
    } catch (error) {
      // Try fallback stores if primary fails
      if (this.fallbackStores.length > 0) {
        for (const store of this.fallbackStores) {
          try {
            return await store.addMany(entries);
          } catch {
            continue;
          }
        }
      }
      throw error;
    }
  }

  async get(id: string): Promise<MemoryEntry | null> {
    this.ensureInitialized();

    try {
      return await this.primaryStore.get(id);
    } catch (error) {
      // Try fallback stores if primary fails
      if (this.fallbackStores.length > 0) {
        for (const store of this.fallbackStores) {
          try {
            const entry = await store.get(id);
            if (entry) return entry;
          } catch {
            continue;
          }
        }
      }

      // Try distributed stores as last resort
      if (this.distributedStores.length > 0) {
        for (const store of this.distributedStores) {
          try {
            const entry = await store.get(id);
            if (entry) return entry;
          } catch {
            continue;
          }
        }
      }

      return null;
    }
  }

  async search(query: string, options?: MemoryQueryOptions): Promise<VectorSearchResult[]> {
    this.ensureInitialized();

    try {
      return await this.primaryStore.search(query, options);
    } catch (error) {
      // Try fallback stores if primary fails
      if (this.fallbackStores.length > 0) {
        for (const store of this.fallbackStores) {
          try {
            return await store.search(query, options);
          } catch {
            continue;
          }
        }
      }

      // Try distributed stores and merge results
      if (this.distributedStores.length > 0) {
        const results = await Promise.all(
          this.distributedStores.map(store => 
            store.search(query, options).catch(() => [])
          )
        );

        return this.mergeAndDedupResults(results.flat());
      }

      throw error;
    }
  }

  async similaritySearch(embedding: number[], options?: MemoryQueryOptions): Promise<VectorSearchResult[]> {
    this.ensureInitialized();

    try {
      return await this.primaryStore.similaritySearch(embedding, options);
    } catch (error) {
      // Try fallback stores if primary fails
      if (this.fallbackStores.length > 0) {
        for (const store of this.fallbackStores) {
          try {
            return await store.similaritySearch(embedding, options);
          } catch {
            continue;
          }
        }
      }

      // Try distributed stores and merge results
      if (this.distributedStores.length > 0) {
        const results = await Promise.all(
          this.distributedStores.map(store => 
            store.similaritySearch(embedding, options).catch(() => [])
          )
        );

        return this.mergeAndDedupResults(results.flat());
      }

      throw error;
    }
  }

  async update(id: string, entry: Partial<MemoryEntry>): Promise<void> {
    this.ensureInitialized();

    try {
      await this.primaryStore.update(id, entry);

      // Update distributed stores if replication is enabled
      if (this.config.replicationEnabled && this.distributedStores.length > 0) {
        await Promise.all(
          this.distributedStores.map(store => 
            store.update(id, entry).catch(() => {})
          )
        );
      }
    } catch (error) {
      // Try fallback stores if primary fails
      if (this.fallbackStores.length > 0) {
        for (const store of this.fallbackStores) {
          try {
            await store.update(id, entry);
            return;
          } catch {
            continue;
          }
        }
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.primaryStore.delete(id);

      // Delete from distributed stores if replication is enabled
      if (this.config.replicationEnabled && this.distributedStores.length > 0) {
        await Promise.all(
          this.distributedStores.map(store => 
            store.delete(id).catch(() => {})
          )
        );
      }
    } catch (error) {
      // Try fallback stores if primary fails
      if (this.fallbackStores.length > 0) {
        for (const store of this.fallbackStores) {
          try {
            await store.delete(id);
            return;
          } catch {
            continue;
          }
        }
      }
      throw error;
    }
  }

  async clear(): Promise<void> {
    this.ensureInitialized();

    const errors: Error[] = [];

    // Clear primary store
    try {
      await this.primaryStore.clear();
    } catch (error) {
      errors.push(error as Error);
    }

    // Clear fallback stores
    await Promise.all(
      this.fallbackStores.map(store => 
        store.clear().catch(error => errors.push(error))
      )
    );

    // Clear distributed stores
    if (this.config.replicationEnabled) {
      await Promise.all(
        this.distributedStores.map(store => 
          store.clear().catch(error => errors.push(error))
        )
      );
    }

    if (errors.length > 0) {
      throw new Error(`Failed to clear all stores: ${errors.map(e => e.message).join(', ')}`);
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    stores: Record<string, {
      healthy: boolean;
      error?: string;
    }>;
  }> {
    this.ensureInitialized();

    const results: Record<string, { healthy: boolean; error?: string }> = {};

    // Check primary store
    try {
      const health = await MemoryFactory.healthCheck(this.primaryStore);
      results.primary = health;
    } catch (error) {
      results.primary = {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Check fallback stores
    await Promise.all(
      this.fallbackStores.map(async (store, index) => {
        try {
          const health = await MemoryFactory.healthCheck(store);
          results[`fallback_${index}`] = health;
        } catch (error) {
          results[`fallback_${index}`] = {
            healthy: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    // Check distributed stores
    await Promise.all(
      this.distributedStores.map(async (store, index) => {
        try {
          const health = await MemoryFactory.healthCheck(store);
          results[`distributed_${index}`] = health;
        } catch (error) {
          results[`distributed_${index}`] = {
            healthy: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    return {
      healthy: Object.values(results).every(r => r.healthy),
      stores: results
    };
  }

  private mergeAndDedupResults(results: VectorSearchResult[]): VectorSearchResult[] {
    // Create a map to deduplicate by entry ID
    const resultMap = new Map<string, VectorSearchResult>();

    for (const result of results) {
      const existing = resultMap.get(result.entry.id);
      if (!existing || existing.score < result.score) {
        resultMap.set(result.entry.id, result);
      }
    }

    // Convert back to array and sort by score
    return Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score);
  }

  private startConsistencyCheck(): void {
    const interval = this.config.consistencyCheckInterval || 60000; // Default to 1 minute

    setInterval(async () => {
      try {
        await this.runConsistencyCheck();
      } catch (error) {
        console.error('Consistency check failed:', error);
      }
    }, interval);
  }

  private async runConsistencyCheck(): Promise<void> {
    if (!this.config.replicationEnabled || this.distributedStores.length === 0) {
      return;
    }

    const primaryCount = await this.primaryStore.count();
    const storeCounts = await Promise.all(
      this.distributedStores.map(store => store.count())
    );

    // Check if all stores have the same count
    const inconsistentStores = storeCounts.map((count, index) => ({
      index,
      count,
      difference: Math.abs(count - primaryCount)
    })).filter(store => store.difference > 0);

    if (inconsistentStores.length > 0) {
      console.warn('Inconsistency detected in distributed stores:', inconsistentStores);
      // TODO: Implement reconciliation strategy
    }
  }

  async cleanup(): Promise<void> {
    this.ensureInitialized();

    const errors: Error[] = [];

    // Cleanup primary store
    try {
      await MemoryFactory.cleanup(this.primaryStore);
    } catch (error) {
      errors.push(error as Error);
    }

    // Cleanup fallback stores
    await Promise.all(
      this.fallbackStores.map(store => 
        MemoryFactory.cleanup(store).catch(error => errors.push(error))
      )
    );

    // Cleanup distributed stores
    await Promise.all(
      this.distributedStores.map(store => 
        MemoryFactory.cleanup(store).catch(error => errors.push(error))
      )
    );

    this.isInitialized = false;

    if (errors.length > 0) {
      throw new Error(`Failed to cleanup all stores: ${errors.map(e => e.message).join(', ')}`);
    }
  }
}