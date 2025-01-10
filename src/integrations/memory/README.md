# Memory Integration System

The Memory Integration System provides a flexible and extensible way to manage agent memory across different storage providers.

## 🌟 Features

- Multiple storage provider support
- Automatic data serialization/deserialization
- Vector embedding for semantic search
- Configurable retention policies
- Automatic archival and cleanup

## 🔌 Supported Providers

### Redis
- Fast, in-memory storage
- Volatile memory with optional persistence
- Ideal for short-term memory and caching
- Configurable TTL and memory limits

### PostgreSQL
- Persistent, relational storage
- Complex querying capabilities
- Transaction support
- Ideal for long-term memory storage

### ChromaDB
- Vector database for semantic search
- Metadata filtering
- Local deployment option
- Efficient similarity search

### Pinecone
- Managed vector database service
- Highly scalable
- Real-time updates
- Production-ready vector search

## 🛠️ Usage

### Basic Configuration

```typescript
import { MemoryManager } from './manager';
import { RedisMemory, PostgresMemory, ChromaMemory, PineconeMemory } from './providers';

// Initialize memory manager
const memoryManager = new MemoryManager({
  defaultProvider: 'redis',
  providers: {
    redis: {
      url: process.env.REDIS_URL,
      ttl: 3600,
      maxMemory: '1gb'
    },
    postgres: {
      connectionString: process.env.POSTGRES_URL,
      schema: 'agent_memory',
      tableName: 'memories'
    },
    chroma: {
      path: './chromadb',
      dimensions: 1536,
      metric: 'cosine'
    },
    pinecone: {
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENV,
      index: 'agent-memories'
    }
  }
});
```

### Provider-Specific Usage

#### Redis Memory
```typescript
const redisMemory = await memoryManager.getProvider('redis');

// Store memory
await redisMemory.store({
  key: 'conversation:123',
  value: { messages: [...] },
  ttl: 3600 // 1 hour
});

// Retrieve memory
const memory = await redisMemory.retrieve('conversation:123');
```

#### PostgreSQL Memory
```typescript
const pgMemory = await memoryManager.getProvider('postgres');

// Store with metadata
await pgMemory.store({
  key: 'task:456',
  value: { result: '...' },
  metadata: {
    agentId: 'agent-123',
    taskType: 'analysis'
  }
});

// Query memories
const memories = await pgMemory.query({
  metadata: {
    agentId: 'agent-123',
    taskType: 'analysis'
  },
  limit: 10,
  orderBy: 'createdAt'
});
```

#### ChromaDB Memory
```typescript
const chromaMemory = await memoryManager.getProvider('chroma');

// Store with embedding
await chromaMemory.store({
  key: 'knowledge:789',
  value: 'Some text to remember',
  embedding: [...], // Vector embedding
  metadata: { topic: 'science' }
});

// Semantic search
const similar = await chromaMemory.search({
  query: 'Related information',
  filter: { topic: 'science' },
  limit: 5
});
```

#### Pinecone Memory
```typescript
const pineconeMemory = await memoryManager.getProvider('pinecone');

// Upsert vectors
await pineconeMemory.store({
  vectors: [{
    id: 'mem:123',
    values: [...], // Vector embedding
    metadata: { type: 'fact' }
  }]
});

// Query vectors
const results = await pineconeMemory.query({
  vector: [...],
  filter: { type: 'fact' },
  topK: 10
});
```

## 🔧 Configuration Options

### Redis Options
```typescript
interface RedisOptions {
  url: string;
  ttl?: number;
  maxMemory?: string;
  keyPrefix?: string;
  serializer?: 'json' | 'msgpack';
}
```

### PostgreSQL Options
```typescript
interface PostgresOptions {
  connectionString: string;
  schema?: string;
  tableName?: string;
  maxConnections?: number;
  idleTimeout?: number;
}
```

### ChromaDB Options
```typescript
interface ChromaOptions {
  path: string;
  dimensions: number;
  metric?: 'cosine' | 'euclidean' | 'dot';
  autoCleanup?: boolean;
  cleanupInterval?: number;
}
```

### Pinecone Options
```typescript
interface PineconeOptions {
  apiKey: string;
  environment: string;
  index: string;
  namespace?: string;
  dimension?: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}
```

## 🔄 Memory Lifecycle

1. **Creation**
   - Memory object created
   - Metadata attached
   - Embeddings generated (if needed)

2. **Storage**
   - Data serialized
   - Provider-specific storage
   - Indexes updated

3. **Retrieval**
   - Query processed
   - Data fetched
   - Results deserialized

4. **Archival**
   - Age/size checks
   - Importance evaluation
   - Storage transition

5. **Cleanup**
   - TTL expiration
   - Manual deletion
   - Automatic pruning

## 📊 Monitoring

Each provider implements monitoring:

```typescript
// Get provider stats
const stats = await memory.getStats();
// {
//   totalEntries: 1000,
//   totalSize: '500MB',
//   oldestEntry: '2024-01-01',
//   newestEntry: '2024-01-10'
// }

// Get provider health
const health = await memory.healthCheck();
// {
//   status: 'healthy',
//   latency: 5,
//   errors: []
// }
```

## 🔒 Security

- Encryption at rest (provider-dependent)
- Access control integration
- Sanitized inputs
- Secure connections

## 🚀 Performance Tips

1. Choose the right provider for your use case
2. Use appropriate TTL values
3. Implement regular cleanup
4. Monitor memory usage
5. Use batch operations when possible

## 🤝 Contributing

1. Review the provider interface
2. Implement required methods
3. Add tests
4. Submit PR with documentation