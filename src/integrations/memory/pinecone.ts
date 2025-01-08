import { PineconeClient, Vector, QueryOptions } from '@pinecone-database/pinecone';
import { BaseMemoryStore, MemoryStoreConfig, VectorSearchResult, MemoryQueryOptions, MemoryEntry } from './base.js';

export interface PineconeMemoryConfig extends MemoryStoreConfig {
  apiKey: string;
  environment: string;
  indexName: string;
  namespace?: string;
  dimension?: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
  podType?: string;
}

interface PineconeMetadata {
  type: MemoryEntry['type'];
  role?: MemoryEntry['role'];
  timestamp: number;
  token_count: number;
  content: string;
  tags?: string[];
  metadata?: Record<string, any>;
  importance: number;
  is_consolidated: boolean;
  consolidation_score: number;
  consolidated_from?: string[];
  is_archived: boolean;
  archive_reason?: string;
}

export class PineconeMemoryStore extends BaseMemoryStore {
  private client: PineconeClient;
  private readonly indexName: string;
  private readonly namespace?: string;
  private isInitialized: boolean = false;
  protected readonly config: PineconeMemoryConfig;

  constructor(config: PineconeMemoryConfig) {
    super(config);
    this.config = config;
    this.client = new PineconeClient();
    this.indexName = config.indexName;
    this.namespace = config.namespace;
  }

  async connect(): Promise<void> {
    try {
      await this.client.init({
        apiKey: this.config.apiKey,
        environment: this.config.environment
      });

      // Get index information
      const indexList = await this.client.listIndexes();
      const indexExists = indexList.includes(this.indexName);

      if (!indexExists) {
        await this.client.createIndex({
          createRequest: {
            name: this.indexName,
            dimension: this.config.dimension || 1536, // Default for OpenAI embeddings
            metric: this.config.metric || 'cosine',
            podType: this.config.podType
          }
        });

        // Wait for index to be ready
        await new Promise(resolve => setTimeout(resolve, 30000));
      }

      this.isInitialized = true;
      this.emit('connected');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isInitialized = false;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.isInitialized;
  }

  private ensureConnected(): void {
    if (!this.isConnected()) {
      throw new Error('Pinecone store is not connected');
    }
  }

  private getIndex() {
    return this.client.Index(this.indexName);
  }

  async add(entry: MemoryEntry): Promise<string> {
    this.ensureConnected();
    this.validateEntry(entry);

    if (!entry.embedding) {
      throw new Error('Entry must have an embedding for Pinecone storage');
    }

    const metadata: PineconeMetadata = {
      type: entry.type,
      role: entry.role,
      timestamp: entry.timestamp,
      token_count: entry.tokenCount,
      content: entry.content,
      tags: entry.tags,
      metadata: entry.metadata,
      importance: entry.importance || 0.5,
      is_consolidated: entry.metadata?.isConsolidated || false,
      consolidation_score: entry.metadata?.consolidationScore || 0,
      consolidated_from: entry.metadata?.consolidatedFrom,
      is_archived: entry.metadata?.isArchived || false,
      archive_reason: entry.metadata?.archiveReason
    };

    const vector: Vector = {
      id: entry.id,
      values: entry.embedding,
      metadata
    };

    const index = this.getIndex();
    await index.upsert({
      upsertRequest: {
        vectors: [vector],
        namespace: this.namespace
      }
    });

    return entry.id;
  }

  async addMany(entries: MemoryEntry[]): Promise<string[]> {
    this.ensureConnected();
    entries.forEach(entry => {
      this.validateEntry(entry);
      if (!entry.embedding) {
        throw new Error('All entries must have embeddings for Pinecone storage');
      }
    });

    const vectors: Vector[] = entries.map(entry => ({
      id: entry.id,
      values: entry.embedding!,
      metadata: {
        type: entry.type,
        role: entry.role,
        timestamp: entry.timestamp,
        token_count: entry.tokenCount,
        content: entry.content,
        tags: entry.tags,
        metadata: entry.metadata,
        importance: entry.importance || 0.5,
        is_consolidated: entry.metadata?.isConsolidated || false,
        consolidation_score: entry.metadata?.consolidationScore || 0,
        consolidated_from: entry.metadata?.consolidatedFrom,
        is_archived: entry.metadata?.isArchived || false,
        archive_reason: entry.metadata?.archiveReason
      }
    }));

    const index = this.getIndex();
    await index.upsert({
      upsertRequest: {
        vectors,
        namespace: this.namespace
      }
    });

    return entries.map(entry => entry.id);
  }

  async get(id: string): Promise<MemoryEntry | null> {
    this.ensureConnected();

    const index = this.getIndex();
    const response = await index.fetch({
      ids: [id],
      namespace: this.namespace
    });

    const vector = response.vectors[id];
    if (!vector) {
      return null;
    }

    return this.mapPineconeVectorToEntry(vector);
  }

  async update(id: string, entry: Partial<MemoryEntry>): Promise<void> {
    this.ensureConnected();

    const current = await this.get(id);
    if (!current) {
      throw new Error(`Entry with id ${id} not found`);
    }

    const metadata: Partial<PineconeMetadata> = {};
    if (entry.type) metadata.type = entry.type;
    if (entry.role !== undefined) metadata.role = entry.role;
    if (entry.timestamp) metadata.timestamp = entry.timestamp;
    if (entry.tokenCount) metadata.token_count = entry.tokenCount;
    if (entry.content) metadata.content = entry.content;
    if (entry.tags) metadata.tags = entry.tags;
    if (entry.metadata) metadata.metadata = entry.metadata;

    const vector: Partial<Vector> = {
      id,
      metadata
    };

    if (entry.embedding) {
      vector.values = entry.embedding;
    }

    const index = this.getIndex();
    await index.update({
      updateRequest: {
        id,
        values: vector.values,
        setMetadata: vector.metadata,
        namespace: this.namespace
      }
    });
  }

  async delete(id: string): Promise<void> {
    this.ensureConnected();

    const index = this.getIndex();
    await index.delete1({
      ids: [id],
      namespace: this.namespace
    });
  }

  async clear(): Promise<void> {
    this.ensureConnected();

    const index = this.getIndex();
    await index.delete1({
      deleteAll: true,
      namespace: this.namespace
    });
  }

  async search(query: string, options: MemoryQueryOptions = {}): Promise<VectorSearchResult[]> {
    throw new Error('Text search not supported in Pinecone. Use similaritySearch with embeddings instead.');
  }

  async similaritySearch(embedding: number[], options: MemoryQueryOptions = {}): Promise<VectorSearchResult[]> {
    this.ensureConnected();

    const {
      limit = 10,
      filter = {},
      minScore = 0.0
    } = options;

    const queryOptions: QueryOptions = {
      topK: limit,
      includeMetadata: true,
      includeValues: true,
      namespace: this.namespace
    };

    // Convert filter to Pinecone filter format
    if (Object.keys(filter).length > 0) {
      queryOptions.filter = {};
      Object.entries(filter).forEach(([key, value]) => {
        queryOptions.filter![key] = { $eq: value };
      });
    }

    const index = this.getIndex();
    const results = await index.query({
      queryRequest: {
        vector: embedding,
        ...queryOptions
      }
    });

    return results.matches
      .map(match => {
        const metadata = match.metadata as PineconeMetadata;
        const baseScore = match.score || 0;
        const adjustedScore = this.adjustScore(baseScore, metadata);
        
        return {
          entry: this.mapPineconeVectorToEntry({
            id: match.id,
            values: match.values!,
            metadata
          }),
          score: adjustedScore
        };
      })
      .filter(result => result.score >= minScore);
  }

  async count(): Promise<number> {
    this.ensureConnected();

    const index = this.getIndex();
    const stats = await index.describeIndexStats({});
    
    return stats.totalVectorCount;
  }

  async getMetrics(): Promise<Record<string, any>> {
    this.ensureConnected();

    const index = this.getIndex();
    const stats = await index.describeIndexStats({});
    const description = await this.client.describeIndex({
      indexName: this.indexName
    });

    return {
      totalVectors: stats.totalVectorCount,
      dimension: description.database.dimension,
      indexFullness: stats.indexFullness,
      namespaces: stats.namespaces
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        return false;
      }

      const index = this.getIndex();
      await index.describeIndexStats({});
      return true;
    } catch {
      return false;
    }
  }

  private adjustScore(baseScore: number, metadata: PineconeMetadata): number {
    return baseScore *
      (1 + metadata.importance) *
      (metadata.is_consolidated ? (1 + metadata.consolidation_score) : 1) *
      (metadata.is_archived ? 0.5 : 1);
  }

  private mapPineconeVectorToEntry(vector: Vector): MemoryEntry {
    const metadata = vector.metadata as PineconeMetadata;
    
    return {
      id: vector.id,
      content: metadata.content,
      type: metadata.type,
      role: metadata.role,
      timestamp: metadata.timestamp,
      tokenCount: metadata.token_count,
      embedding: vector.values,
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
}