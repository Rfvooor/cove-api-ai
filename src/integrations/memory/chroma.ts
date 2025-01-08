import { ChromaClient, Collection, OpenAIEmbeddingFunction } from 'chromadb';
import { BaseMemoryStore, MemoryStoreConfig, VectorSearchResult, MemoryQueryOptions, MemoryEntry, MemoryEntryType, MemoryEntryRole } from './base.js';

export interface ChromaMemoryConfig extends MemoryStoreConfig {
  host?: string;
  port?: number;
  collectionName?: string;
  openaiApiKey?: string;
  embeddingModel?: string;
  distanceMetric?: 'l2' | 'ip' | 'cosine';
}

interface ChromaMetadata {
  type: MemoryEntryType;
  role?: MemoryEntryRole;
  timestamp: number;
  token_count: number;
  tags?: string[];
  metadata?: Record<string, any>;
  importance: number;
  is_consolidated: boolean;
  consolidation_score: number;
  consolidated_from?: string[];
  is_archived: boolean;
  archive_reason?: string;
}

export class ChromaMemoryStore extends BaseMemoryStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private embeddingFunction: OpenAIEmbeddingFunction;
  private readonly collectionName: string;
  private isInitialized: boolean = false;

  constructor(config: ChromaMemoryConfig) {
    super(config);
    this.collectionName = config.collectionName || 'memory_store';

    this.client = new ChromaClient({
      path: `http://${config.host || 'localhost'}:${config.port || 8000}`
    });

    this.embeddingFunction = new OpenAIEmbeddingFunction({
      openai_api_key: config.openaiApiKey!,
      model_name: config.embeddingModel || 'text-embedding-ada-002'
    });
  }

  async connect(): Promise<void> {
    try {
      // Check if collection exists, create if it doesn't
      const collections = await this.client.listCollections();
      const exists = collections.some(c => c.name === this.collectionName);

      if (!exists) {
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          embeddingFunction: this.embeddingFunction,
          metadata: { 
            'hnsw:space': 'cosine',
            'hnsw:construction_ef': 100,
            'hnsw:search_ef': 100
          }
        });
      } else {
        this.collection = await this.client.getCollection({
          name: this.collectionName,
          embeddingFunction: this.embeddingFunction
        });
      }

      this.isInitialized = true;
      this.emit('connected');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.collection = null;
    this.isInitialized = false;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.isInitialized && this.collection !== null;
  }

  private ensureConnected(): void {
    if (!this.isConnected() || !this.collection) {
      throw new Error('ChromaDB store is not connected');
    }
  }

  async add(entry: MemoryEntry): Promise<string> {
    this.ensureConnected();
    this.validateEntry(entry);

    const metadata: ChromaMetadata = {
      type: entry.type,
      role: entry.role,
      timestamp: entry.timestamp,
      token_count: entry.tokenCount,
      tags: entry.tags,
      metadata: entry.metadata,
      importance: entry.importance || 0.5,
      is_consolidated: entry.metadata?.isConsolidated || false,
      consolidation_score: entry.metadata?.consolidationScore || 0,
      consolidated_from: entry.metadata?.consolidatedFrom,
      is_archived: entry.metadata?.isArchived || false,
      archive_reason: entry.metadata?.archiveReason
    };

    await this.collection!.add({
      ids: [entry.id],
      documents: [entry.content],
      metadatas: [metadata],
      embeddings: entry.embedding ? [entry.embedding] : undefined
    });

    return entry.id;
  }

  async addMany(entries: MemoryEntry[]): Promise<string[]> {
    this.ensureConnected();
    entries.forEach(entry => this.validateEntry(entry));

    const ids = entries.map(e => e.id);
    const documents = entries.map(e => e.content);
    const metadatas = entries.map(e => ({
      type: e.type,
      role: e.role,
      timestamp: e.timestamp,
      token_count: e.tokenCount,
      tags: e.tags,
      metadata: e.metadata,
      importance: e.importance || 0.5,
      is_consolidated: e.metadata?.isConsolidated || false,
      consolidation_score: e.metadata?.consolidationScore || 0,
      consolidated_from: e.metadata?.consolidatedFrom,
      is_archived: e.metadata?.isArchived || false,
      archive_reason: e.metadata?.archiveReason
    }));
    const embeddings = entries.every(e => e.embedding) 
      ? entries.map(e => e.embedding!)
      : undefined;

    await this.collection!.add({
      ids,
      documents,
      metadatas,
      embeddings
    });

    return ids;
  }

  async get(id: string): Promise<MemoryEntry | null> {
    this.ensureConnected();

    const result = await this.collection!.get({
      ids: [id],
      include: ['metadatas', 'documents', 'embeddings']
    });

    if (result.ids.length === 0) {
      return null;
    }

    return this.mapChromaResultToEntry(
      result.ids[0],
      result.documents[0],
      result.metadatas[0] as ChromaMetadata,
      result.embeddings?.[0]
    );
  }

  async update(id: string, entry: Partial<MemoryEntry>): Promise<void> {
    this.ensureConnected();

    const current = await this.get(id);
    if (!current) {
      throw new Error(`Entry with id ${id} not found`);
    }

    const metadata: Partial<ChromaMetadata> = {};
    if (entry.type) metadata.type = entry.type;
    if (entry.role !== undefined) metadata.role = entry.role;
    if (entry.timestamp) metadata.timestamp = entry.timestamp;
    if (entry.tokenCount) metadata.token_count = entry.tokenCount;
    if (entry.tags) metadata.tags = entry.tags;
    if (entry.importance !== undefined) metadata.importance = entry.importance;
    if (entry.metadata) {
      metadata.metadata = entry.metadata;
      metadata.is_consolidated = entry.metadata.isConsolidated || false;
      metadata.consolidation_score = entry.metadata.consolidationScore || 0;
      metadata.consolidated_from = entry.metadata.consolidatedFrom;
      metadata.is_archived = entry.metadata.isArchived || false;
      metadata.archive_reason = entry.metadata.archiveReason;
    }

    await this.collection!.update({
      ids: [id],
      documents: entry.content ? [entry.content] : undefined,
      metadatas: [metadata],
      embeddings: entry.embedding ? [entry.embedding] : undefined
    });
  }

  async delete(id: string): Promise<void> {
    this.ensureConnected();
    await this.collection!.delete({ ids: [id] });
  }

  async clear(): Promise<void> {
    if (this.isConnected()) {
      await this.collection!.delete();
      await this.connect(); // Recreate the collection
    }
  }

  async search(query: string, options: MemoryQueryOptions = {}): Promise<VectorSearchResult[]> {
    this.ensureConnected();

    const {
      limit = 10,
      filter = {},
      minScore = 0.0
    } = options;

    // Convert filter to Chroma where clause
    const whereClause = Object.entries(filter).map(([key, value]) => ({
      [key]: { $eq: value }
    }));

    const results = await this.collection!.query({
      queryTexts: [query],
      nResults: limit,
      where: whereClause.length > 0 ? { $and: whereClause } : undefined,
      include: ['metadatas', 'documents', 'embeddings', 'distances']
    });

    if (!results.ids.length) {
      return [];
    }

    return results.ids[0].map((id, index) => {
      const metadata = results.metadatas[0][index] as ChromaMetadata;
      const baseScore = 1 - (results.distances?.[0][index] || 0);
      const adjustedScore = this.adjustScore(baseScore, metadata);
      
      return {
        entry: this.mapChromaResultToEntry(
          id,
          results.documents[0][index],
          metadata,
          results.embeddings?.[0][index]
        ),
        score: adjustedScore
      };
    }).filter(result => result.score >= minScore);
  }

  async similaritySearch(embedding: number[], options: MemoryQueryOptions = {}): Promise<VectorSearchResult[]> {
    this.ensureConnected();

    const {
      limit = 10,
      filter = {},
      minScore = 0.0
    } = options;

    // Convert filter to Chroma where clause
    const whereClause = Object.entries(filter).map(([key, value]) => ({
      [key]: { $eq: value }
    }));

    const results = await this.collection!.query({
      queryEmbeddings: [embedding],
      nResults: limit,
      where: whereClause.length > 0 ? { $and: whereClause } : undefined,
      include: ['metadatas', 'documents', 'embeddings', 'distances']
    });

    if (!results.ids.length) {
      return [];
    }

    return results.ids[0].map((id, index) => {
      const metadata = results.metadatas[0][index] as ChromaMetadata;
      const baseScore = 1 - (results.distances?.[0][index] || 0);
      const adjustedScore = this.adjustScore(baseScore, metadata);
      
      return {
        entry: this.mapChromaResultToEntry(
          id,
          results.documents[0][index],
          metadata,
          results.embeddings?.[0][index]
        ),
        score: adjustedScore
      };
    }).filter(result => result.score >= minScore);
  }

  async count(): Promise<number> {
    this.ensureConnected();
    const count = await this.collection!.count();
    return count;
  }

  async getMetrics(): Promise<Record<string, any>> {
    this.ensureConnected();

    const count = await this.count();
    const peek = await this.collection!.peek(1);
    
    // Get type distribution
    const typeResults = await this.collection!.get({
      include: ['metadatas']
    });

    const typeDistribution: Record<string, number> = {};
    typeResults.metadatas.forEach(metadata => {
      const type = (metadata as ChromaMetadata).type;
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    });

    return {
      totalEntries: count,
      typeDistribution,
      hasEmbeddings: peek.embeddings !== null,
      dimensions: peek.embeddings?.[0]?.length || 0
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.heartbeat();
      return true;
    } catch {
      return false;
    }
  }

  private mapChromaResultToEntry(
    id: string,
    document: string,
    metadata: ChromaMetadata,
    embedding?: number[]
  ): MemoryEntry {
    return {
      id,
      content: document,
      type: metadata.type,
      role: metadata.role,
      timestamp: metadata.timestamp,
      tokenCount: metadata.token_count,
      embedding,
      tags: metadata.tags,
      importance: metadata.importance,
      metadata: {
        ...metadata.metadata,
        isConsolidated: metadata.is_consolidated,
        consolidationScore: metadata.consolidation_score,
        consolidatedFrom: metadata.consolidated_from,
        isArchived: metadata.is_archived,
        archiveReason: metadata.archive_reason
      }
    };
  }

  private adjustScore(baseScore: number, metadata: ChromaMetadata): number {
    return baseScore *
      (1 + metadata.importance) *
      (metadata.is_consolidated ? (1 + metadata.consolidation_score) : 1) *
      (metadata.is_archived ? 0.5 : 1);
  }
}