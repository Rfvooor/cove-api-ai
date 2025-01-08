import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { BaseLanguageModel } from './base-language-model.js';
import { BaseMemoryStore } from '../integrations/memory/base.js';
import { MemoryFactory, MemoryFactoryConfig } from '../integrations/memory/factory.js';

export interface MemoryConfig {
  maxShortTermItems?: number;
  maxTokenSize?: number;
  autoArchive?: boolean;
  archiveThreshold?: number;
  persistPath?: string;
  indexStrategy?: 'basic' | 'semantic';
  compressionEnabled?: boolean;
  deduplicationEnabled?: boolean;
  consolidationThreshold?: number;
  importanceThreshold?: number;
  metadata?: Record<string, any>;
  languageModel?: BaseLanguageModel;
  store?: MemoryFactoryConfig;
  embeddingModel?: {
    provider: 'openai' | 'claude' | 'langchain' | 'openrouter' | 'cohere' | 'huggingface';
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface MemoryState {
  shortTermMemory: MemoryEntry[];
  longTermMemory: MemoryEntry[];
  metadata: Record<string, any>;
  metrics: MemoryMetrics;
}

export interface MemoryUpdateFields {
  content?: string;
  type?: MemoryEntry['type'];
  role?: MemoryEntry['role'];
  metadata?: Record<string, any>;
  embedding?: number[];
  tags?: string[];
  importance?: number;
  lastAccessed?: number;
  accessCount?: number;
  relatedMemories?: string[];
}

export interface MemoryEntry {
  id: string;
  content: string;
  type: 'message' | 'task' | 'result' | 'error' | 'system' | 'tool' | 'conversation';
  role?: 'user' | 'assistant' | 'system';
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

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
  context?: MemoryEntry[];
}

export interface MemoryMetrics {
  totalEntries: number;
  shortTermEntries: number;
  longTermEntries: number;
  totalTokens: number;
  averageTokensPerEntry: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  averageImportance?: number;
  memoryDistribution?: Record<string, number>;
  accessPatterns?: Record<string, number>;
}


export class Memory extends EventEmitter {
  private shortTermMemory: MemoryEntry[] = [];
  private longTermMemory: MemoryEntry[] = [];
  private maxShortTermItems: number = 100;
  private maxTokenSize: number = 4096;
  private autoArchive: boolean = true;
  private archiveThreshold: number = 0.8;
  private persistPath?: string = '';
  private indexStrategy: 'basic' | 'semantic' = 'semantic';
  private compressionEnabled: boolean = false;
  private deduplicationEnabled: boolean = true;
  private consolidationThreshold: number = 0.7;
  private importanceThreshold: number = 0.5;
  private metadata: Record<string, any> = {};
  private languageModel?: BaseLanguageModel;
  private store?: BaseMemoryStore;

  static async create(config: MemoryConfig = {}): Promise<Memory> {
    const memory = new Memory();
    await memory.initialize(config);
    return memory;
  }

  private constructor() {
    super();
    this.shortTermMemory = [];
    this.longTermMemory = [];
    this.metadata = {};
  }

  private async initialize(config: MemoryConfig): Promise<void> {
    this.maxShortTermItems = config.maxShortTermItems || 100;
    this.maxTokenSize = config.maxTokenSize || 4096;
    this.autoArchive = config.autoArchive ?? true;
    this.archiveThreshold = config.archiveThreshold || 0.8;
    this.persistPath = config.persistPath || '';
    this.indexStrategy = config.indexStrategy || 'semantic';
    this.compressionEnabled = config.compressionEnabled || false;
    this.deduplicationEnabled = config.deduplicationEnabled || true;
    this.consolidationThreshold = config.consolidationThreshold || 0.7;
    this.importanceThreshold = config.importanceThreshold || 0.5;
    this.metadata = config.metadata || {};
    this.languageModel = config.languageModel;

    // Initialize language model for embeddings if configured
    if (config.embeddingModel) {
      const { createLanguageModel } = await import('../integrations/language-models/index.js');
      this.languageModel = await createLanguageModel(config.embeddingModel.provider, {
        apiKey: config.embeddingModel.apiKey || '',
        model: config.embeddingModel.model || 'text-embedding-ada-002',
        temperature: config.embeddingModel.temperature || 0.0,
        maxTokens: config.embeddingModel.maxTokens || 8192
      });
    }

    // Initialize memory store if configured
    if (config.store) {
      await this.initializeStore(config.store);
    }

    if (this.persistPath) {
      await this.loadFromDisk();
    }

    // Start periodic memory maintenance
    this.startMemoryMaintenance();
  }

  private async initializeStore(config: MemoryFactoryConfig): Promise<void> {
    try {
      this.store = await MemoryFactory.create(config);
      
      // Load existing memories from store
      const existingMemories = await this.store?.search('', { limit: 1000 }) ?? [];
      for (const result of existingMemories) {
        if (result.entry.metadata?.isLongTerm) {
          this.longTermMemory.push(result.entry);
        } else {
          this.shortTermMemory.push(result.entry);
        }
      }
    } catch (error) {
      console.error('Failed to initialize memory store:', error);
      throw error;
    }
  }

  private startMemoryMaintenance(): void {
    // Run memory maintenance every hour
    setInterval(async () => {
      await this.consolidateMemories();
      await this.pruneMemories();
      await this.updateImportanceScores();
    }, 60 * 60 * 1000);
  }

  async add(entry: Omit<MemoryEntry, 'id' | 'timestamp' | 'tokenCount'>): Promise<string> {
    const id = randomUUID();
    const timestamp = Date.now();
    const tokenCount = await this.countTokens(entry.content);

    const memoryEntry: MemoryEntry = {
      id,
      timestamp,
      tokenCount,
      importance: await this.calculateImportance(entry.content),
      lastAccessed: timestamp,
      accessCount: 0,
      ...entry
    };

    if (this.deduplicationEnabled && await this.isDuplicate(memoryEntry)) {
      return id;
    }

    if (this.indexStrategy === 'semantic' && this.languageModel?.generateEmbedding) {
      memoryEntry.embedding = await this.languageModel.generateEmbedding(entry.content);
    }

    // Find related memories
    if (memoryEntry.embedding) {
      memoryEntry.relatedMemories = await this.findRelatedMemories(memoryEntry);
    }

    this.shortTermMemory.push(memoryEntry);

    // Store in persistent storage if available
    if (this.store) {
      await this.store.add(memoryEntry);
    }

    this.emit('memoryAdded', memoryEntry);

    if (this.shouldArchive()) {
      await this.archive();
    }

    return id;
  }

  private async calculateImportance(content: string): Promise<number> {
    const factors: number[] = [];
    
    // Content length and complexity
    factors.push(Math.min(content.length / 1000, 1));
    
    // Semantic similarity to recent memories
    if (this.indexStrategy === 'semantic' && this.languageModel?.generateEmbedding) {
      const embedding = await this.languageModel.generateEmbedding(content);
      const similarities = await Promise.all(
        this.shortTermMemory.slice(-5).map(async m => {
          if (!m.embedding) return 0;
          return this.cosineSimilarity(embedding, m.embedding);
        })
      );
      factors.push(Math.max(...similarities));
    }

    // Key concepts
    const keyTerms = ['important', 'critical', 'urgent', 'essential', 'key'];
    const containsKeyTerms = keyTerms.some(term => 
      content.toLowerCase().includes(term)
    );
    factors.push(containsKeyTerms ? 1 : 0);

    return factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
  }

  private async findRelatedMemories(entry: MemoryEntry): Promise<string[]> {
    if (!entry.embedding) return [];

    const allMemories = [...this.shortTermMemory, ...this.longTermMemory];
    const similarities = await Promise.all(
      allMemories.map(async m => ({
        id: m.id,
        similarity: m.embedding 
          ? this.cosineSimilarity(entry.embedding!, m.embedding)
          : 0
      }))
    );

    return similarities
      .filter(s => s.similarity > this.consolidationThreshold)
      .map(s => s.id);
  }

  private async consolidateMemories(): Promise<void> {
    const allMemories = [...this.shortTermMemory, ...this.longTermMemory];
    
    // Group related memories
    const groups = new Map<string, MemoryEntry[]>();
    
    for (const memory of allMemories) {
      if (!memory.relatedMemories?.length) continue;
      
      const groupKey = memory.relatedMemories.sort().join(',');
      const group = groups.get(groupKey) || [];
      group.push(memory);
      groups.set(groupKey, group);
    }

    // Consolidate groups that exceed threshold
    for (const [_, group] of groups) {
      if (group.length < 3) continue;

      const consolidated = await this.createConsolidatedMemory(group);
      await this.add(consolidated);

      // Remove individual memories
      await this.removeMemories(group.map(m => m.id));
    }
  }

  private async removeMemories(ids: string[]): Promise<void> {
    this.shortTermMemory = this.shortTermMemory.filter(
      m => !ids.includes(m.id)
    );
    this.longTermMemory = this.longTermMemory.filter(
      m => !ids.includes(m.id)
    );

    if (this.store) {
      await Promise.all(ids.map(id => this.store!.delete(id)));
    }
  }

  private async createConsolidatedMemory(
    memories: MemoryEntry[]
  ): Promise<Omit<MemoryEntry, 'id' | 'timestamp' | 'tokenCount'>> {
    const content = memories
      .sort((a, b) => b.importance! - a.importance!)
      .map(m => m.content)
      .join('\n\n');

    return {
      content: `Consolidated Memory:\n${content}`,
      type: 'system',
      metadata: {
        consolidatedFrom: memories.map(m => m.id),
        originalTimestamps: memories.map(m => m.timestamp)
      },
      importance: Math.max(...memories.map(m => m.importance || 0)),
      tags: [...new Set(memories.flatMap(m => m.tags || []))]
    };
  }

  private async pruneMemories(): Promise<void> {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    const memoriesToRemove = this.longTermMemory.filter(memory => {
      const age = now - memory.timestamp;
      const importance = memory.importance || 0;
      const recentlyAccessed = memory.lastAccessed && (now - memory.lastAccessed) < oneWeek;
      const frequentlyAccessed = (memory.accessCount || 0) > 5;

      return !(importance > this.importanceThreshold || recentlyAccessed || frequentlyAccessed);
    });

    await this.removeMemories(memoriesToRemove.map(m => m.id));
  }

  private async updateImportanceScores(): Promise<void> {
    const allMemories = [...this.shortTermMemory, ...this.longTermMemory];
    
    for (const memory of allMemories) {
      // Decay importance over time
      const age = Date.now() - memory.timestamp;
      const ageDecay = Math.exp(-age / (30 * 24 * 60 * 60 * 1000)); // 30-day half-life
      
      // Access frequency boost
      const accessBoost = Math.min((memory.accessCount || 0) / 10, 1);
      
      // Recency boost
      const lastAccessedBoost = memory.lastAccessed
        ? Math.exp(-(Date.now() - memory.lastAccessed) / (7 * 24 * 60 * 60 * 1000))
        : 0;

      memory.importance = (memory.importance || 0.5) * 
        (0.4 * ageDecay + 0.3 * accessBoost + 0.3 * lastAccessedBoost);

      // Update in store if available
      if (this.store) {
        const update: MemoryUpdateFields = {};
        if (memory.importance !== undefined) update.importance = memory.importance;
        await this.store.update(memory.id, update);
      }
    }
  }

  async query(
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      includeContext?: boolean;
      filter?: (entry: MemoryEntry) => boolean;
    } = {}
  ): Promise<MemorySearchResult[]> {
    if (this.store) {
      return this.store.search(query, options);
    }

    const {
      limit = 10,
      threshold = 0.7,
      includeContext = false,
      filter
    } = options;

    let results: MemorySearchResult[] = [];

    if (this.indexStrategy === 'semantic' && this.languageModel?.generateEmbedding) {
      const queryEmbedding = await this.languageModel.generateEmbedding(query);
      results = await this.semanticSearch(queryEmbedding, threshold);
    } else {
      results = this.basicSearch(query, threshold);
    }

    if (filter) {
      results = results.filter(result => filter(result.entry));
    }

    if (includeContext) {
      results = await this.addContext(results);
    }

    // Update access metadata
    await Promise.all(results.map(async result => {
      result.entry.lastAccessed = Date.now();
      result.entry.accessCount = (result.entry.accessCount || 0) + 1;

      if (this.store) {
        const update: MemoryUpdateFields = {};
        if (result.entry.lastAccessed !== undefined) update.lastAccessed = result.entry.lastAccessed;
        if (result.entry.accessCount !== undefined) update.accessCount = result.entry.accessCount;
        await this.store.update(result.entry.id, update);
      }
    }));

    return results.slice(0, limit);
  }

  private async semanticSearch(
    queryEmbedding: number[],
    threshold: number
  ): Promise<MemorySearchResult[]> {
    const results: MemorySearchResult[] = [];
    const allMemories = [...this.shortTermMemory, ...this.longTermMemory];

    for (const entry of allMemories) {
      if (!entry.embedding) continue;

      const score = this.cosineSimilarity(queryEmbedding, entry.embedding);
      if (score >= threshold) {
        results.push({ entry, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private basicSearch(
    query: string,
    threshold: number
  ): MemorySearchResult[] {
    const results: MemorySearchResult[] = [];
    const allMemories = [...this.shortTermMemory, ...this.longTermMemory];
    const queryTerms = query.toLowerCase().split(/\s+/);

    for (const entry of allMemories) {
      const content = entry.content.toLowerCase();
      const matchCount = queryTerms.filter(term => content.includes(term)).length;
      const score = matchCount / queryTerms.length;

      if (score >= threshold) {
        results.push({ entry, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private async addContext(
    results: MemorySearchResult[]
  ): Promise<MemorySearchResult[]> {
    return Promise.all(
      results.map(async (result) => {
        const timestamp = result.entry.timestamp;
        const contextWindow = 5 * 60 * 1000; // 5 minutes

        const context = [...this.shortTermMemory, ...this.longTermMemory]
          .filter(entry => 
            Math.abs(entry.timestamp - timestamp) <= contextWindow &&
            entry.id !== result.entry.id
          )
          .sort((a, b) => Math.abs(a.timestamp - timestamp) - Math.abs(b.timestamp - timestamp))
          .slice(0, 5);

        return {
          ...result,
          context
        };
      })
    );
  }

  private shouldArchive(): boolean {
    if (!this.autoArchive) return false;

    const currentSize = this.shortTermMemory.length;
    return currentSize >= this.maxShortTermItems * this.archiveThreshold;
  }

  private async archive(): Promise<void> {
    const itemsToArchive = this.shortTermMemory
      .sort((a, b) => {
        const importanceDiff = (a.importance || 0) - (b.importance || 0);
        if (importanceDiff !== 0) return importanceDiff;
        return a.timestamp - b.timestamp;
      })
      .slice(0, Math.floor(this.shortTermMemory.length * 0.5));

    // Update metadata to mark as long-term memory
    await Promise.all(itemsToArchive.map(async memory => {
      memory.metadata = {
        ...memory.metadata,
        isLongTerm: true
      };
      if (this.store) {
        await this.store.update(memory.id, { metadata: memory.metadata });
      }
    }));

    this.longTermMemory.push(...itemsToArchive);
    this.shortTermMemory = this.shortTermMemory.filter(
      m => !itemsToArchive.some(a => a.id === m.id)
    );

    this.emit('memoryArchived', {
      archivedCount: itemsToArchive.length,
      shortTermCount: this.shortTermMemory.length,
      longTermCount: this.longTermMemory.length
    });
  }

  private async isDuplicate(entry: MemoryEntry): Promise<boolean> {
    const recentWindow = 5 * 60 * 1000; // 5 minutes
    
    if (this.store) {
      const recentMemories = await this.store.search('', {
        filter: {
          timestamp: { $gt: Date.now() - recentWindow }
        }
      });
      return recentMemories.some(m => 
        m.entry.type === entry.type && 
        m.entry.content === entry.content
      );
    }

    const recentMemories = this.shortTermMemory.filter(
      m => Date.now() - m.timestamp < recentWindow
    );

    return recentMemories.some(m => 
      m.type === entry.type && 
      m.content === entry.content
    );
  }

  private async countTokens(text: string): Promise<number> {
    if (this.languageModel?.countTokens) {
      try {
        return await this.languageModel.countTokens(text);
      } catch (error) {
        console.error('Error counting tokens:', error);
      }
    }
    // Fallback token counting
    return text.split(/\s+/).length;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async persist(): Promise<void> {
    if (this.store) {
      // Store is already handling persistence
      return;
    }

    if (!this.persistPath) {
      throw new Error('No persist path configured');
    }

    await this.saveToDisk();
  }

  private async loadFromDisk(): Promise<void> {
    // This is a placeholder - actual implementation would load from persistPath
    // Only used when no store is configured
    this.emit('memoryLoaded', {
      shortTermCount: this.shortTermMemory.length,
      longTermCount: this.longTermMemory.length
    });
  }

  private async saveToDisk(): Promise<void> {
    // This is a placeholder - actual implementation would save to persistPath
    // Only used when no store is configured
    this.emit('memorySaved', {
      shortTermCount: this.shortTermMemory.length,
      longTermCount: this.longTermMemory.length
    });
  }

  getMetrics(): MemoryMetrics {
    const allMemories = [...this.shortTermMemory, ...this.longTermMemory];
    const totalTokens = allMemories.reduce((sum, entry) => sum + entry.tokenCount, 0);
    const totalImportance = allMemories.reduce((sum, entry) => sum + (entry.importance || 0), 0);

    // Calculate memory distribution by type
    const memoryDistribution = allMemories.reduce((acc, entry) => {
      acc[entry.type] = (acc[entry.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate access patterns
    const now = Date.now();
    const accessPatterns = {
      last24h: 0,
      last7d: 0,
      last30d: 0
    };

    allMemories.forEach(entry => {
      const age = now - (entry.lastAccessed || entry.timestamp);
      if (age < 24 * 60 * 60 * 1000) accessPatterns.last24h++;
      if (age < 7 * 24 * 60 * 60 * 1000) accessPatterns.last7d++;
      if (age < 30 * 24 * 60 * 60 * 1000) accessPatterns.last30d++;
    });

    return {
      totalEntries: allMemories.length,
      shortTermEntries: this.shortTermMemory.length,
      longTermEntries: this.longTermMemory.length,
      totalTokens,
      averageTokensPerEntry: totalTokens / allMemories.length || 0,
      oldestEntry: allMemories.length > 0 
        ? new Date(Math.min(...allMemories.map(e => e.timestamp)))
        : undefined,
      newestEntry: allMemories.length > 0
        ? new Date(Math.max(...allMemories.map(e => e.timestamp)))
        : undefined,
      averageImportance: totalImportance / allMemories.length || 0,
      memoryDistribution,
      accessPatterns
    };
  }

  async clear(): Promise<void> {
    this.shortTermMemory = [];
    this.longTermMemory = [];

    if (this.store) {
      await this.store.clear();
    }

    this.emit('memoryCleared');
  }

  async getState(): Promise<MemoryState> {
    return {
      shortTermMemory: [...this.shortTermMemory],
      longTermMemory: [...this.longTermMemory],
      metadata: { ...this.metadata },
      metrics: this.getMetrics()
    };
  }
}