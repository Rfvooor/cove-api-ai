import { BaseLanguageModel, ModelCapabilities } from '../../core/base-language-model.js';
import { BaseLanguageModelIntegration, LanguageModelConfig } from './base.js';
import { OpenAIIntegration, OpenAIConfig } from './openai.js';
import { ClaudeIntegration, ClaudeConfig } from './claude.js';
import { LangchainIntegration, LangchainConfig } from './langchain.js';
import { OpenRouterIntegration, OpenRouterConfig } from './openrouter.js';
import { CohereIntegration, CohereConfig } from './cohere.js';
import { HuggingFaceIntegration, HuggingFaceConfig } from './huggingface.js';

// Re-export base types and interfaces
export {
  BaseLanguageModel,
  ModelCapabilities,
  BaseLanguageModelIntegration,
  type LanguageModelConfig
};

// Re-export language model implementations and their configs
export {
  OpenAIIntegration,
  type OpenAIConfig,
  ClaudeIntegration,
  type ClaudeConfig,
  LangchainIntegration,
  type LangchainConfig,
  OpenRouterIntegration,
  type OpenRouterConfig,
  CohereIntegration,
  type CohereConfig,
  HuggingFaceIntegration,
  type HuggingFaceConfig
};

// Factory function to create language model instances
export function createLanguageModel(
  type: 'openai' | 'claude' | 'langchain' | 'openrouter' | 'cohere' | 'huggingface',
  config: LanguageModelConfig
): BaseLanguageModelIntegration {
  switch (type) {
    case 'openai':
      return new OpenAIIntegration(config as OpenAIConfig);
    case 'claude':
      return new ClaudeIntegration(config as ClaudeConfig);
    case 'langchain':
      return new LangchainIntegration(config as LangchainConfig);
    case 'openrouter':
      return new OpenRouterIntegration(config as OpenRouterConfig);
    case 'cohere':
      return new CohereIntegration(config as CohereConfig);
    case 'huggingface':
      return new HuggingFaceIntegration(config as HuggingFaceConfig);
    default:
      throw new Error(`Unsupported language model type: ${type}`);
  }
}

// Example usage:
/*
import { createLanguageModel } from './integrations/language-models';

const model = createLanguageModel('openai', {
  apiKey: 'your-api-key',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 4096
});

const response = await model.generateText('Hello, world!');
*/