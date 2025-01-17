# Language Model Integration System

The Language Model Integration System provides a unified interface for interacting with various language model providers while handling provider-specific features and optimizations.

## 🌟 Features

- Multiple provider support
- Streaming responses
- Function calling capabilities
- Token usage tracking
- Error handling and retries
- Cost optimization

## 🔌 Supported Providers

### OpenAI
- Models: GPT-4, GPT-4-32k, GPT-3.5-turbo, GPT-3.5-turbo-16k
- Features:
  - Streaming responses
  - Function calling
  - JSON mode
  - System messages

### OpenRouter
- Unified access to multiple AI providers
- Features:
  - Single API for multiple models
  - Cost optimization
  - Automatic fallback
  - Usage tracking
  - Model performance analytics

### Anthropic
- Models: Claude-2, Claude-instant, Claude-1
- Features:
  - Streaming responses
  - Long context support
  - Constitutional AI

### Cohere
- Models: Command, Command-light, Command-nightly
- Features:
  - Custom model fine-tuning
  - Multi-lingual support
  - Classification capabilities

### HuggingFace
- Models: Custom deployments
- Features:
  - Local deployment
  - Model customization
  - Inference optimization

## 🛠️ Usage

### Basic Configuration

```typescript
import { LanguageModelManager } from './manager';
import { OpenAI, Claude, Cohere, HuggingFace } from './providers';

// Initialize language model manager
const modelManager = new LanguageModelManager({
  defaultProvider: 'openai',
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: 'gpt-4',
      organization: process.env.OPENAI_ORG
    },
    anthropic: {
      apiKey: process.env.CLAUDE_API_KEY,
      defaultModel: 'claude-2'
    },
    cohere: {
      apiKey: process.env.COHERE_API_KEY,
      defaultModel: 'command'
    },
    huggingface: {
      apiKey: process.env.HF_API_KEY,
      defaultModel: 'custom-model'
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultModel: 'anthropic/claude-2',
      fallbackStrategy: 'sequential',
      costOptimization: {
        maxCost: 0.05,
        preferredModels: ['openai/gpt-3.5-turbo', 'anthropic/claude-instant']
      }
    }
  }
});
```

### Provider-Specific Usage

#### OpenRouter
```typescript
const openrouter = await modelManager.getProvider('openrouter');

// Basic completion with model selection
const response = await openrouter.complete({
  messages: [{ role: 'user', content: 'Analyze this data' }],
  model: 'anthropic/claude-2',
  temperature: 0.7,
  maxTokens: 1000
});

// Automatic fallback configuration
const fallbackResponse = await openrouter.complete({
  messages: [{ role: 'user', content: 'Complex analysis task' }],
  models: ['anthropic/claude-2', 'openai/gpt-4', 'google/palm-2'],
  fallbackStrategy: 'sequential',
  fallbackConditions: {
    timeout: 5000,
    errorTypes: ['rate_limit', 'server_error']
  }
});

// Cost optimization
const optimizedResponse = await openrouter.complete({
  messages: [{ role: 'user', content: 'Simple task' }],
  costOptimization: {
    maxCost: 0.05,
    preferredModels: ['openai/gpt-3.5-turbo', 'anthropic/claude-instant'],
    performanceThreshold: 0.8
  }
});
```

#### OpenAI
```typescript
const openai = await modelManager.getProvider('openai');

// Basic completion
const response = await openai.complete({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is machine learning?' }
  ],
  temperature: 0.7,
  maxTokens: 1000
});

// Function calling
const functionResponse = await openai.complete({
  messages: [{ role: 'user', content: 'What\'s the weather in London?' }],
  functions: [{
    name: 'get_weather',
    description: 'Get weather information for a location',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
      }
    }
  }]
});
```

#### Claude
```typescript
const claude = await modelManager.getProvider('anthropic');

// Long context completion
const response = await claude.complete({
  messages: [
    { role: 'system', content: 'You are a research assistant.' },
    { role: 'user', content: longDocument }
  ],
  maxTokens: 4000
});

// Streaming response
const stream = await claude.completeStream({
  messages: [{ role: 'user', content: 'Write a long story.' }],
  temperature: 0.8
});

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

#### Cohere
```typescript
const cohere = await modelManager.getProvider('cohere');

// Custom model completion
const response = await cohere.complete({
  messages: [{ role: 'user', content: 'Translate to French: Hello world' }],
  model: 'custom-multilingual-model'
});

// Classification
const classification = await cohere.classify({
  inputs: ['Great product!', 'Terrible experience'],
  examples: [
    { text: 'Amazing service', label: 'positive' },
    { text: 'Poor quality', label: 'negative' }
  ]
});
```

## 🔧 Configuration Options

### Common Options
```typescript
interface BaseModelOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  timeout?: number;
}
```

### Provider-Specific Options

#### OpenAI Options
```typescript
interface OpenAIOptions extends BaseModelOptions {
  organization?: string;
  apiVersion?: string;
  functionCalling?: boolean;
  jsonMode?: boolean;
}
```

#### OpenRouter Options
```typescript
interface OpenRouterOptions extends BaseModelOptions {
  models?: string[];                    // List of models to try
  fallbackStrategy?: 'sequential' | 'parallel' | 'cost-optimized';
  fallbackConditions?: {
    timeout?: number;                   // Timeout in milliseconds
    errorTypes?: string[];             // Error types that trigger fallback
    maxAttempts?: number;              // Maximum fallback attempts
  };
  costOptimization?: {
    maxCost?: number;                  // Maximum cost per request
    preferredModels?: string[];        // Preferred models for cost optimization
    performanceThreshold?: number;     // Minimum performance score (0-1)
  };
  routingStrategy?: {
    type: 'round-robin' | 'weighted' | 'performance-based';
    weights?: Record<string, number>;  // Model weights for weighted strategy
    metrics?: string[];               // Metrics for performance-based routing
  };
}
```

#### Claude Options
```typescript
interface ClaudeOptions extends BaseModelOptions {
  longContext?: boolean;
  constitutionalPrinciples?: string[];
  maxContextWindow?: number;
}
```

#### Cohere Options
```typescript
interface CohereOptions extends BaseModelOptions {
  customModel?: string;
  truncate?: 'START' | 'END';
  returnLikelihoods?: 'NONE' | 'ALL' | 'TOP';
}
```

## 📊 Monitoring & Analytics

### Usage Tracking
```typescript
// Get provider usage
const usage = await model.getUsage({
  startDate: '2024-01-01',
  endDate: '2024-01-10'
});
// {
//   totalTokens: 1000000,
//   totalCost: 10.50,
//   requestCount: 500,
//   averageLatency: 250
// }

// Get model performance
const performance = await model.getPerformance();
// {
//   successRate: 0.99,
//   averageTokensPerRequest: 2000,
//   p95Latency: 500,
//   errorRate: 0.01
// }
```

## 🔒 Security & Rate Limiting

- API key rotation
- Request rate limiting
- Token usage limits
- Error handling
- Retry strategies

## 🚀 Best Practices

1. **Token Management**
   - Track token usage
   - Implement soft/hard limits
   - Use appropriate context windows

2. **Cost Optimization**
   - Choose appropriate models
   - Implement caching
   - Batch requests when possible

3. **Error Handling**
   - Implement retries
   - Handle rate limits
   - Log errors properly

4. **Performance**
   - Use streaming for long responses
   - Implement request queuing
   - Monitor latency

## 🤝 Contributing

1. Review provider interface
2. Implement required methods
3. Add tests
4. Update documentation
5. Submit PR

## 📚 Resources

- [OpenAI Documentation](https://platform.openai.com/docs)
- [OpenRouter Documentation](https://openrouter.ai/docs)
- [Claude Documentation](https://docs.anthropic.com)
- [Cohere Documentation](https://docs.cohere.ai)
- [HuggingFace Documentation](https://huggingface.co/docs)