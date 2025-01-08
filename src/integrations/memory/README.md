# Memory System

The memory system provides a flexible and robust way to store, retrieve, and search agent memories across different storage backends. It supports multiple storage solutions with automatic fallback and replication capabilities.

## Features

- Multiple storage backends (PostgreSQL, Redis, ChromaDB, Pinecone)
- Automatic fallback handling
- Distributed storage support
- Vector similarity search
- Configurable replication
- Consistency checking
- Health monitoring
- Batch operations
- Type-safe interfaces

## Storage Backends

### PostgreSQL
- Primary storage for structured data
- Full-text search capabilities
- JSONB support for metadata
- Vector similarity search using pgvector

### Redis
- Fast in-memory storage
- Configurable TTL
- Great for short-term memory and caching
- Automatic persistence

### ChromaDB
- Vector database optimized for embeddings
- Efficient similarity search
- Local deployment option
- Supports hybrid search

### Pinecone
- Cloud-native vector database
- Highly scalable
- Optimized for production workloads
- Advanced filtering capabilities

## Installation

```bash
# Install dependencies
npm install pg redis @pinecone-database/pinecone chromadb

# Optional: Set up local services using Docker
docker-compose up -d
```

## Basic Usage

```typescript
import { 
  MemoryManager, 
  MemoryEntry,
  defaultConfigs 
} from './integrations/memory';

// Create a memory manager
const manager = new MemoryManager({
  primaryStore: defaultConfigs.postgres,
  fallbackStores: [defaultConfigs.redis],
  distributedStores: [defaultConfigs.chroma],
  replicationEnabled: true
});

// Initialize the system
await manager.initialize();

// Store a memory
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

// Search for memories
const results = await manager.search('hello', {
  limit: 5,
  filter: { type: 'message' }
});

// Clean up
await manager.cleanup();
```

## Advanced Usage

### Custom Configuration

```typescript
const manager = new MemoryManager({
  primaryStore: {
    type: 'postgres',
    config: {
      host: 'custom.host',
      port: 5432,
      database: 'memory_db',
      user: 'user',
      password: 'password',
      schema: 'memories',
      maxConnections: 20
    }
  },
  // ... other configurations
});
```

### Vector Similarity Search

```typescript
// Search using embeddings
const embedding = new Array(1536).fill(0); // Your embedding here
const results = await manager.similaritySearch(embedding, {
  limit: 10,
  minScore: 0.7,
  filter: {
    type: 'message'
  }
});
```

### Distributed Storage

```typescript
const manager = new MemoryManager({
  primaryStore: defaultConfigs.postgres,
  distributedStores: [
    defaultConfigs.chroma,
    defaultConfigs.pinecone
  ],
  replicationEnabled: true,
  consistencyCheck: true,
  consistencyCheckInterval: 60000 // 1 minute
});
```

### Health Monitoring

```typescript
const health = await manager.healthCheck();
console.log('System health:', health);
// {
//   healthy: true,
//   stores: {
//     primary: { healthy: true },
//     distributed_0: { healthy: true },
//     distributed_1: { healthy: true }
//   }
// }
```

## Environment Variables

```bash
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=cove_memory
POSTGRES_USER=cove
POSTGRES_PASSWORD=cove_secret

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Pinecone
PINECONE_API_KEY=your-api-key
PINECONE_ENVIRONMENT=us-east-1
```

## Docker Support

A `docker-compose.yml` file is provided for easy local development:

```bash
# Start all services
docker-compose up -d

# Start specific services
docker-compose up -d postgres redis

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Best Practices

1. **Storage Selection**
   - Use PostgreSQL for structured data and long-term storage
   - Use Redis for fast access to recent data
   - Use ChromaDB/Pinecone for semantic search capabilities

2. **Error Handling**
   - Always initialize the manager before use
   - Implement proper cleanup in your application lifecycle
   - Handle potential errors during operations

3. **Performance**
   - Use batch operations for multiple entries
   - Configure appropriate connection pools
   - Monitor memory usage and clean up when needed

4. **Security**
   - Never commit credentials to version control
   - Use environment variables for sensitive data
   - Implement proper access controls

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT License - see LICENSE file for details