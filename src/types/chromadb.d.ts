declare module 'chromadb' {
  export interface ChromaClientConfig {
    path?: string;
  }

  export interface CollectionConfig {
    name: string;
    embeddingFunction?: EmbeddingFunction;
    metadata?: Record<string, any>;
  }

  export interface QueryConfig {
    queryTexts?: string[];
    queryEmbeddings?: number[][];
    nResults?: number;
    where?: Record<string, any>;
    include?: Array<'metadatas' | 'documents' | 'embeddings' | 'distances'>;
  }

  export interface AddConfig {
    ids: string[];
    documents?: string[];
    metadatas?: Record<string, any>[];
    embeddings?: number[][];
  }

  export interface UpdateConfig {
    ids: string[];
    documents?: string[];
    metadatas?: Record<string, any>[];
    embeddings?: number[][];
  }

  export interface GetConfig {
    ids?: string[];
    where?: Record<string, any>;
    limit?: number;
    offset?: number;
    include?: Array<'metadatas' | 'documents' | 'embeddings'>;
  }

  export interface DeleteConfig {
    ids?: string[];
    where?: Record<string, any>;
  }

  export interface QueryResult {
    ids: string[][];
    documents: string[][];
    metadatas: Record<string, any>[][];
    embeddings?: number[][][];
    distances?: number[][];
  }

  export interface GetResult {
    ids: string[];
    documents: string[];
    metadatas: Record<string, any>[];
    embeddings?: number[][];
  }

  export interface Collection {
    name: string;
    add(config: AddConfig): Promise<void>;
    update(config: UpdateConfig): Promise<void>;
    get(config?: GetConfig): Promise<GetResult>;
    delete(config?: DeleteConfig): Promise<void>;
    query(config: QueryConfig): Promise<QueryResult>;
    count(): Promise<number>;
    peek(n: number): Promise<GetResult>;
  }

  export interface EmbeddingFunction {
    generate(texts: string[]): Promise<number[][]>;
  }

  export interface OpenAIEmbeddingConfig {
    openai_api_key: string;
    model_name?: string;
  }

  export class OpenAIEmbeddingFunction implements EmbeddingFunction {
    constructor(config: OpenAIEmbeddingConfig);
    generate(texts: string[]): Promise<number[][]>;
  }

  export class ChromaClient {
    constructor(config?: ChromaClientConfig);
    createCollection(config: CollectionConfig): Promise<Collection>;
    getCollection(config: CollectionConfig): Promise<Collection>;
    listCollections(): Promise<{ name: string }[]>;
    deleteCollection(name: string): Promise<void>;
    heartbeat(): Promise<number>;
  }
}

// Augment the metadata type to include our custom fields
declare module 'chromadb' {
  interface ChromaMetadata {
    type: 'message' | 'task' | 'result' | 'error' | 'system' | 'tool' | 'conversation';
    role?: 'system' | 'user' | 'assistant';
    timestamp: number;
    token_count: number;
    content: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }
}