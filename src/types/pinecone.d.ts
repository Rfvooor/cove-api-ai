declare module '@pinecone-database/pinecone' {
  export interface PineconeConfiguration {
    apiKey: string;
    environment: string;
  }

  export interface Vector {
    id: string;
    values: number[];
    metadata?: Record<string, any>;
  }

  export interface QueryMatch {
    id: string;
    score?: number;
    values?: number[];
    metadata?: Record<string, any>;
  }

  export interface QueryOptions {
    topK?: number;
    includeValues?: boolean;
    includeMetadata?: boolean;
    namespace?: string;
    filter?: Record<string, { $eq: any } | { $ne: any } | { $gt: number } | { $gte: number } | { $lt: number } | { $lte: number }>;
  }

  export interface UpsertRequest {
    vectors: Vector[];
    namespace?: string;
  }

  export interface UpsertResponse {
    upsertedCount: number;
  }

  export interface QueryRequest extends QueryOptions {
    vector: number[];
    sparseVector?: {
      indices: number[];
      values: number[];
    };
  }

  export interface QueryResponse {
    matches: QueryMatch[];
    namespace: string;
  }

  export interface DeleteRequest {
    ids?: string[];
    deleteAll?: boolean;
    namespace?: string;
    filter?: Record<string, any>;
  }

  export interface UpdateRequest {
    id: string;
    values?: number[];
    setMetadata?: Record<string, any>;
    namespace?: string;
  }

  export interface IndexStats {
    namespaces: Record<string, { vectorCount: number }>;
    dimension: number;
    indexFullness: number;
    totalVectorCount: number;
  }

  export interface IndexDescription {
    database: {
      name: string;
      metric: string;
      dimension: number;
      pods: number;
      replicas: number;
      shards: number;
      podType: string;
    };
    status: {
      ready: boolean;
      state: string;
    };
  }

  export interface CreateIndexRequest {
    name: string;
    dimension: number;
    metric?: 'cosine' | 'euclidean' | 'dotproduct';
    pods?: number;
    replicas?: number;
    podType?: string;
    metadata_config?: {
      indexed?: string[];
    };
    source_collection?: string;
  }

  export class Index {
    constructor(name: string, client: PineconeClient);

    upsert(request: { upsertRequest: UpsertRequest }): Promise<UpsertResponse>;
    query(request: { queryRequest: QueryRequest }): Promise<QueryResponse>;
    delete1(request: DeleteRequest): Promise<void>;
    fetch(request: { ids: string[]; namespace?: string }): Promise<{ vectors: Record<string, Vector> }>;
    update(request: { updateRequest: UpdateRequest }): Promise<void>;
    describeIndexStats(request: { filter?: Record<string, any> }): Promise<IndexStats>;
  }

  export class PineconeClient {
    constructor();

    init(config: PineconeConfiguration): Promise<void>;
    Index(name: string): Index;
    createIndex(request: { createRequest: CreateIndexRequest }): Promise<void>;
    deleteIndex(request: { indexName: string }): Promise<void>;
    listIndexes(): Promise<string[]>;
    describeIndex(request: { indexName: string }): Promise<IndexDescription>;
  }
}