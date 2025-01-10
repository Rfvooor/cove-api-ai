# Quick Start Guide

This guide will help you get started with the Agent and Swarm Management API, a powerful platform for creating and managing AI agents and swarms.

## Prerequisites

- Node.js (v18 or later)
- PostgreSQL (v14 or later)
- npm or yarn
- A supported language model API key (OpenAI, Claude, etc.)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cove-api-ai
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
# Database Configuration
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=agent_swarm_db
DB_PORT=5432

# API Configuration
PORT=3000
NODE_ENV=development

# Language Model API Keys
OPENAI_API_KEY=your_openai_api_key
CLAUDE_API_KEY=your_claude_api_key
COHERE_API_KEY=your_cohere_api_key

# Memory Provider Configuration
REDIS_URL=redis://localhost:6379
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=your_environment
```

## Development

Start the development server:
```bash
npm run dev
```

The system provides:
- REST API at `http://localhost:3000/api/v1`
- WebSocket server at `ws://localhost:3000/ws`
- API documentation at `http://localhost:3000/api-docs`
- Real-time monitoring dashboard at `http://localhost:3000`

## Features

### Real-time Communication
- WebSocket-based real-time updates
- Live agent status monitoring
- Task progress tracking
- System metrics and analytics

### Memory Systems
- Redis: Fast, volatile memory for short-term storage
- PostgreSQL: Persistent, queryable storage for long-term memory
- ChromaDB: Vector-based storage for semantic search
- Pinecone: Scalable, managed vector database

### Language Models
- OpenAI: GPT-4, GPT-3.5-turbo with streaming and function calling
- Anthropic: Claude-2, Claude-instant with long context support
- Cohere: Command models with custom model support
- HuggingFace: Custom model deployment support

### Tools
- `web-search`: Internet search capabilities
- `file-processor`: Document analysis and processing
- `code-executor`: Code execution and analysis
- `math`: Mathematical computations
- `blockchain`: Blockchain data and service integration
- Custom tools: Extensible tool system

## API Usage Examples

### Creating an Agent
```bash
curl -X POST http://localhost:3000/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Research Assistant",
    "description": "An agent specialized in research tasks",
    "languageModelConfig": {
      "provider": "openai",
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 2048,
      "streaming": true,
      "functionCalling": true
    },
    "memoryConfig": {
      "provider": "pinecone",
      "connectionString": "your-connection-string",
      "embeddingConfig": {
        "provider": "openai"
      },
      "retrievalConfig": {
        "maxResults": 10,
        "minRelevanceScore": 0.7
      }
    }
  }'
```

### Creating a Swarm
```bash
curl -X POST http://localhost:3000/api/v1/swarms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Research Team",
    "description": "A team of agents working together on research tasks",
    "agents": ["agent-id-1", "agent-id-2"],
    "topology": "hierarchical",
    "routingStrategy": "roundRobin",
    "maxConcurrency": 5,
    "timeout": 30000
  }'
```

## Architecture

The platform follows a modular architecture:

### API Layer (`/api`)
- `routes/`: RESTful API endpoints
- `middleware/`: Request processing and validation
- `models/`: Data models and database schemas
- `business/`: Business logic and service layer
- `websocket/`: Real-time communication

### Core Layer (`/src`)
- `core/`: Core agent and swarm implementations
- `integrations/`: External service integrations
- `utils/`: Utility functions and helpers
- `types/`: TypeScript type definitions

### Client Layer (`/client`)
- Real-time dashboard
- Agent and swarm management interface
- Task monitoring and control
- System metrics visualization

## Swarm Topologies

### Sequential
- Agents work in a predefined sequence
- Output of one agent becomes input for the next
- Suitable for pipeline-style processing

### Parallel
- Agents work simultaneously on tasks
- Results are aggregated after completion
- Ideal for independent subtasks

### Hierarchical
- Manager-worker structure
- Task delegation and result aggregation
- Good for complex, multi-step tasks

### Mesh
- Fully connected agent network
- Peer-to-peer communication
- Suitable for collaborative problem-solving

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run linting: `npm run lint`
6. Submit a pull request

## Monitoring

The platform includes built-in monitoring:
- Prometheus metrics at `/metrics`
- Grafana dashboards for visualization
- Alert rules for system health
- Performance tracking and analytics

## License

This project is licensed under the ISC License. See LICENSE file for details.