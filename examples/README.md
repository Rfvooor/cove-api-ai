# Usage Examples

This directory contains example implementations and use cases for the Agent & Swarm Management Platform. These examples demonstrate various features and integration patterns.

## 🌟 Examples Overview

### Basic Usage
- [Basic Usage](basic-usage.ts): Simple agent creation and task execution
- [Advanced Usage](advanced-usage.ts): Complex agent configurations and tool usage

### Swarm Examples
- [Chained Swarms](chained-swarms-example.ts): Sequential task processing across multiple swarms
- [Swarm Code Search](swarm-code-search-example.ts): Distributed code analysis
- [Swarm Optimization](swarm-optimization-example.ts): Performance tuning and load balancing

### Specialized Examples
- [Crypto Analysis](crypto-analysis-agent.ts): Cryptocurrency market analysis agent
- [DEXScreener Integration](dexscreener-example.ts): DEX market data analysis

## 🚀 Getting Started

### Prerequisites
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys and configuration
```

### Running Examples
```bash
# Run a specific example
npm run example basic-usage

# Run all examples
npm run examples
```

## 📚 Example Details

### Basic Usage Example
```typescript
// basic-usage.ts
import { Agent, LanguageModel, Memory } from '../src';

async function basicExample() {
  // Create an agent
  const agent = await Agent.create({
    name: 'Basic Agent',
    description: 'A simple example agent',
    languageModel: {
      provider: 'openai',
      model: 'gpt-4'
    },
    memory: {
      provider: 'redis',
      ttl: 3600
    }
  });

  // Execute a task
  const result = await agent.execute({
    type: 'simple',
    input: 'Hello, world!',
    context: { format: 'text' }
  });

  console.log('Result:', result);
}
```

### Swarm Example
```typescript
// swarm-code-search-example.ts
import { Swarm, Agent } from '../src';

async function swarmExample() {
  // Create specialized agents
  const fileAgent = await Agent.create({
    name: 'File Processor',
    tools: ['file-processor']
  });

  const searchAgent = await Agent.create({
    name: 'Code Searcher',
    tools: ['code-search']
  });

  // Create swarm
  const swarm = await Swarm.create({
    name: 'Code Analysis Swarm',
    topology: 'hierarchical',
    agents: [fileAgent, searchAgent],
    router: {
      strategy: 'capability-based'
    }
  });

  // Execute swarm task
  const result = await swarm.execute({
    type: 'code-analysis',
    input: {
      repository: 'https://github.com/example/repo',
      pattern: 'security.*vulnerability'
    }
  });

  console.log('Analysis Result:', result);
}
```

### Crypto Analysis Example
```typescript
// crypto-analysis-agent.ts
import { Agent } from '../src';
import { DexScreenerTool, BirdeyeTool } from '../src/tools';

async function cryptoAnalysisExample() {
  // Create specialized crypto agent
  const agent = await Agent.create({
    name: 'Crypto Analyst',
    tools: [
      new DexScreenerTool(),
      new BirdeyeTool()
    ],
    memory: {
      provider: 'redis',
      config: {
        ttl: 300 // 5 minutes cache
      }
    }
  });

  // Analyze token
  const analysis = await agent.execute({
    type: 'market-analysis',
    input: {
      token: 'SOL',
      metrics: ['price', 'volume', 'liquidity']
    }
  });

  console.log('Market Analysis:', analysis);
}
```

## 🔧 Configuration

### Environment Variables
```env
# Language Model APIs
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key

# Memory Providers
REDIS_URL=redis://localhost:6379
POSTGRES_URL=postgresql://user:pass@localhost:5432/db

# External APIs
DEXSCREENER_API_KEY=your_dexscreener_key
BIRDEYE_API_KEY=your_birdeye_key
```

### Tool Configuration
```typescript
// Configure tool options
const toolConfig = {
  dexscreener: {
    rateLimit: 5,
    timeout: 5000
  },
  birdeye: {
    maxRequests: 100,
    cacheTime: 300
  }
};

// Apply configuration
agent.configureTools(toolConfig);
```

## 📊 Example Results

### Basic Task
```json
{
  "success": true,
  "result": "Hello! How can I assist you today?",
  "metadata": {
    "executionTime": 245,
    "tokenUsage": 15
  }
}
```

### Swarm Analysis
```json
{
  "success": true,
  "results": [
    {
      "agent": "File Processor",
      "findings": ["Potential SQL injection in login.js"]
    },
    {
      "agent": "Code Searcher",
      "findings": ["3 similar patterns found in /src"]
    }
  ],
  "metadata": {
    "executionTime": 1250,
    "agentsUsed": 2
  }
}
```

## 🤝 Contributing

1. Choose an example category
2. Create a new example file
3. Add comprehensive comments
4. Update this README
5. Submit PR

## 📚 Resources

- [API Documentation](../docs/api.md)
- [Tool Documentation](../src/tools/README.md)
- [Swarm Guide](../docs/swarms.md)
- [Memory Systems](../src/integrations/memory/README.md)