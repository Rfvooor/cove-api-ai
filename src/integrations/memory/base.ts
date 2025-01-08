import { EventEmitter } from 'events';

export interface VectorSearchResult {
  entry: MemoryEntry;
  score: number;
}

export interface MemoryStoreConfig {
  namespace?: string;
  maxConnections?: number;
  connectionTimeout?: number;
  queryTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  compressionEnabled?: boolean;
}

export interface MemoryQueryOptions {
  limit?: number;
  offset?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
  minScore?: number;
}

export type MemoryEntryType = 'message' | 'task' | 'result' | 'error' | 'system' | 'tool' | 'conversation';
export type MemoryEntryRole = 'system' | 'user' | 'assistant';

export interface MemoryEntry {
  id: string;
  content: string;
  type: MemoryEntryType;
  role?: MemoryEntryRole;
  timestamp: number;
  tokenCount: number;
  metadata?: Record<string, any>;
  embedding?: number[];
  tags?: string[];
  importance?: number;
  lastAccessed?: number;
  accessCount?: number;
  relatedMemories?: string[];
}

export abstract class BaseMemoryStore extends EventEmitter {
  protected config: MemoryStoreConfig;

  constructor(config: MemoryStoreConfig = {}) {
    super();
    this.config = {
      namespace: 'default',
      maxConnections: 10,
      connectionTimeout: 5000,
      queryTimeout: 10000,
      retryAttempts: 3,
      retryDelay: 1000,
      compressionEnabled: false,
      ...config
    };
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract isConnected(): boolean;
  
  abstract add(entry: MemoryEntry): Promise<string>;
  abstract addMany(entries: MemoryEntry[]): Promise<string[]>;
  abstract get(id: string): Promise<MemoryEntry | null>;
  abstract update(id: string, entry: Partial<MemoryEntry>): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract clear(): Promise<void>;

  abstract search(query: string, options?: MemoryQueryOptions): Promise<VectorSearchResult[]>;
  abstract similaritySearch(embedding: number[], options?: MemoryQueryOptions): Promise<VectorSearchResult[]>;
  
  abstract count(): Promise<number>;
  abstract getMetrics(): Promise<Record<string, any>>;
  abstract healthCheck(): Promise<boolean>;

  protected async retry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.config.retryAttempts!; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retryAttempts! - 1) {
          await new Promise(resolve => 
            setTimeout(resolve, this.config.retryDelay)
          );
          
          this.emit('retryAttempt', {
            attempt: attempt + 1,
            error: lastError
          });
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  protected validateEntry(entry: MemoryEntry): void {
    if (!entry.id) throw new Error('Entry must have an id');
    if (!entry.content) throw new Error('Entry must have content');
    if (!entry.type) throw new Error('Entry must have a type');
    if (!entry.timestamp) throw new Error('Entry must have a timestamp');
    if (!entry.tokenCount) throw new Error('Entry must have a token count');
    
    // Validate type
    const validTypes: MemoryEntryType[] = ['message', 'task', 'result', 'error', 'system', 'tool', 'conversation'];
    if (!validTypes.includes(entry.type)) {
      throw new Error(`Invalid entry type: ${entry.type}`);
    }

    // Validate role if present
    if (entry.role) {
      const validRoles: MemoryEntryRole[] = ['system', 'user', 'assistant'];
      if (!validRoles.includes(entry.role)) {
        throw new Error(`Invalid entry role: ${entry.role}`);
      }
    }
  }
}