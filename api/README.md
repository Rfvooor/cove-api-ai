# API Layer

The API Layer provides a RESTful interface and WebSocket server for interacting with the Agent & Swarm Management Platform. It handles request processing, authentication, rate limiting, and real-time communication.

## 🌟 Features

- RESTful API endpoints
- WebSocket real-time updates
- Request validation
- Rate limiting
- Authentication & authorization
- Error handling
- Swagger documentation

## 🏗️ Architecture

### Directory Structure
```
api/
├── routes/          # API route handlers
├── middleware/      # Request processing middleware
├── models/          # Data models and schemas
├── business/        # Business logic layer
├── database/        # Database configuration
├── websocket/       # WebSocket server
└── swagger.yaml     # API documentation
```

### Components

#### Routes
- Agent management
- Swarm orchestration
- Task execution
- Tool management
- System monitoring

#### Middleware
- Authentication
- Rate limiting
- Request logging
- Error handling
- Input validation

#### Models
- Database schemas
- Data validation
- Type definitions
- Relationships

#### Business Logic
- Core operations
- Data processing
- Service integration
- Error handling

## 🔌 API Endpoints

### Agent Management
```typescript
// Create Agent
POST /api/v1/agents
Content-Type: application/json
{
  "name": "Research Assistant",
  "description": "Specialized in research tasks",
  "languageModelConfig": {
    "provider": "openai",
    "model": "gpt-4",
    "temperature": 0.7
  },
  "memoryConfig": {
    "provider": "redis",
    "ttl": 3600
  }
}

// List Agents
GET /api/v1/agents?limit=10&offset=0

// Get Agent Details
GET /api/v1/agents/:id

// Update Agent
PATCH /api/v1/agents/:id

// Delete Agent
DELETE /api/v1/agents/:id
```

### Swarm Management
```typescript
// Create Swarm
POST /api/v1/swarms
Content-Type: application/json
{
  "name": "Research Team",
  "description": "Collaborative research swarm",
  "topology": "hierarchical",
  "agents": ["agent-1", "agent-2"],
  "config": {
    "maxConcurrency": 5,
    "timeout": 30000
  }
}

// Execute Task
POST /api/v1/swarms/:id/execute
Content-Type: application/json
{
  "task": "Research AI safety",
  "context": {
    "depth": "technical",
    "format": "markdown"
  }
}
```

## 🔄 WebSocket Protocol

### Connection
```typescript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected to server');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleUpdate(data);
};
```

### Message Types
```typescript
interface WebSocketMessage {
  type: 'agent_status' | 'task_status' | 'swarm_status' | 'metrics';
  data: {
    id: string;
    status: string;
    timestamp: string;
    metadata: Record<string, any>;
  };
}
```

## 🔒 Security

### Authentication
```typescript
// JWT Authentication
interface AuthRequest extends Request {
  user?: {
    id: string;
    roles: string[];
    permissions: string[];
  };
}

// API Key Authentication
interface ApiKeyRequest extends Request {
  apiKey?: {
    id: string;
    scope: string[];
    rate: RateLimit;
  };
}
```

### Rate Limiting
```typescript
// Rate Limit Configuration
const rateLimits = {
  api: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100                   // limit each IP to 100 requests per windowMs
  },
  auth: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 5                     // limit each IP to 5 login attempts per hour
  }
};
```

## 📊 Monitoring

### Health Check
```typescript
GET /health
Response:
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2024-01-10T04:59:56.000Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "websocket": "healthy"
  }
}
```

### Metrics
```typescript
GET /metrics
Response:
{
  "requests": {
    "total": 1000,
    "success": 950,
    "error": 50
  },
  "latency": {
    "p50": 100,
    "p95": 250,
    "p99": 500
  },
  "memory": {
    "used": "500MB",
    "total": "1GB"
  }
}
```

## 🚀 Development

### Setup
```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### Testing
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "API Tests"

# Run with coverage
npm run test:coverage
```

### Documentation
```bash
# Generate API documentation
npm run docs:generate

# Serve documentation
npm run docs:serve
```

## 🤝 Contributing

1. Review API design
2. Follow REST principles
3. Add comprehensive tests
4. Update documentation
5. Submit PR

## 📚 Resources

- [API Design Guide](./docs/api-design.md)
- [WebSocket Protocol](./docs/websocket.md)
- [Security Guidelines](./docs/security.md)
- [Testing Guide](./docs/testing.md)