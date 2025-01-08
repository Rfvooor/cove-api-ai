# Cove AI Framework

## Overview

Cove AI is a sophisticated, flexible multi-agent AI framework designed to enable complex task decomposition and collaborative problem-solving across various domains.

## Key Features

- **Multi-Agent Architecture**: Dynamically route tasks across specialized AI agents
- **Flexible Tool Integration**: Easily extend agent capabilities with custom tools
- **Language Model Agnostic**: Support for multiple LLM providers (OpenAI, Anthropic, Langchain)
- **Robust Conversation Management**: Advanced memory and context tracking
- **Scalable Swarm Routing**: Intelligent task distribution and execution
- **Various Memory Implementations**: Support for different memory implementations (Redis, Postgres, Chroma and more).

## Quick Start

### Basic Usage

```typescript
import { Agent } from 'cove-ai/core/agent';
import { OpenAIIntegration } from 'cove-ai/integrations/openai';
import { SwarmRouter } from 'cove-ai/core/swarm-router';

// Create Language Model Integrations
const openaiModel = new OpenAIIntegration({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-3.5-turbo'
});

// Create Agents
const researchAgent = new Agent({
  name: 'Research Assistant',
  languageModel: openaiModel,
  systemPrompt: 'You are a detailed research assistant.'
});

const writingAgent = new Agent({
  name: 'Writing Assistant', 
  languageModel: openaiModel,
  systemPrompt: 'You are a professional content writer.'
});

// Create Swarm Router
const swarmRouter = new SwarmRouter({
  name: 'Research Writing Swarm',
  agents: [researchAgent, writingAgent],
  max_loops: 3
});

// Run a Complex Task
async function generateResearchReport(topic: string) {
  const result = await swarmRouter.run(`Generate a comprehensive research report on ${topic}`);
  console.log(result);
}

generateResearchReport('Artificial Intelligence Trends');
```

## Core Concepts

### Agents
Agents are the fundamental building blocks of the Cove AI Framework. Each agent:
- Has a specific system prompt defining its role
- Can use multiple language models
- Supports tool integration
- Manages its own conversation context

### Swarm Router
The SwarmRouter manages task distribution across multiple agents:
- Dynamically selects the most appropriate agent
- Supports configurable workflow types
- Provides logging and execution tracking

### Tools
Tools extend agent capabilities to perform external tasks:
- Support schema-based validation
- Easily composable and extensible

## Advanced Configuration

### Custom Tools
```typescript
import { Tool } from 'cove-ai/core/tool';
import * as z from 'zod';

const weatherTool = new Tool({
  name: 'Weather Lookup',
  description: 'Retrieve current weather information',
  inputSchema: z.object({
    city: z.string(),
    country: z.string()
  }),
  execute: async (input) => {
    // Implement weather API call
  }
});
```

## Supported Integrations
- OpenAI
- Anthropic
- Langchain
- OpenRouter

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments
- Partly inspired by existing multi agentic frameworks such as [ElizaOS](https://github.com/elizaOS/eliza/tree/main) and [Swarms](https://github.com/kyegomez/swarms/tree/master/swarms) as well as other on-chain solana frameworks such as [SolanaAgentKit](https://github.com/sendaifun/solana-agent-kit) and [GOAT](https://github.com/goat-sdk/goat/tree/main). 
