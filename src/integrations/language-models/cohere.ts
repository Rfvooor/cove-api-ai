import { BaseLanguageModelIntegration, LanguageModelConfig } from './base.js';
import {
  ModelCapabilities,
  PromptInput,
  GenerateTextResult,
  GenerateTextOptions
} from '../../core/base-language-model.js';

export interface CohereConfig extends LanguageModelConfig {
  // Cohere-specific config options can be added here
}

const COHERE_CAPABILITIES: Required<ModelCapabilities> = {
  supportsEmbeddings: true,
  supportsTokenCounting: false,
  supportsImages: false,
  supportsStreaming: false,
  maxContextLength: 32768, // Cohere's context window
  supportedModels: [
    'command',
    'command-light',
    'command-nightly',
    'command-light-nightly',
    'embed-english-v3.0',
    'embed-multilingual-v3.0'
  ],
  maxParallelRequests: 10,
  costPerToken: {
    prompt: 0.0002,
    completion: 0.0002
  }
};

export class CohereIntegration extends BaseLanguageModelIntegration {
  constructor(config: CohereConfig) {
    const defaultConfig = {
      ...config,
      model: config.model || 'command'
    };
    super(defaultConfig, COHERE_CAPABILITIES);
  }

  async generateText(
    prompt: string | PromptInput,
    options: Partial<CohereConfig> = {}
  ): Promise<GenerateTextResult> {
    return this.wrapGenerateText(
      async (promptText: string, opts?: Partial<CohereConfig>) => {
        this.validateMaxLength(promptText, this.capabilities.maxContextLength);

        const {
          temperature = this.config.temperature,
          maxTokens = this.config.maxTokens,
          model = this.config.model
        } = opts || {};

        const response = await fetch('https://api.cohere.ai/v1/generate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'Request-Source': 'cove-api-ai'
          },
          body: JSON.stringify({
            model,
            prompt: promptText,
            max_tokens: maxTokens,
            temperature,
            truncate: 'END'
          })
        });

        if (!response.ok) {
          throw new Error(`Cohere API error: ${response.statusText}`);
        }

        const result = await response.json() as {
          generations: Array<{ text: string }>;
        };

        if (!result.generations || result.generations.length === 0) {
          throw new Error('No content received from Cohere API');
        }

        return result.generations[0].text;
      },
      prompt,
      options
    );
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.cohere.ai/v1/embed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'Request-Source': 'cove-api-ai'
        },
        body: JSON.stringify({
          model: 'embed-english-v3.0',
          texts: [text],
          truncate: 'END'
        })
      });

      if (!response.ok) {
        throw new Error(`Cohere API error: ${response.statusText}`);
      }

      const result = await response.json() as {
        embeddings: number[][];
      };

      if (!result.embeddings || result.embeddings.length === 0) {
        throw new Error('No embeddings received from Cohere API');
      }

      return result.embeddings[0];
    } catch (error) {
      console.error('Cohere Embedding Error:', error);
      throw new Error('Failed to generate embedding using Cohere');
    }
  }

  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch('https://api.cohere.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Request-Source': 'cove-api-ai'
        }
      });

      if (!response.ok) {
        throw new Error(`Cohere API error: ${response.statusText}`);
      }

      const result = await response.json() as {
        models: Array<{ id: string }>;
      };

      const supportedModels = new Set(COHERE_CAPABILITIES.supportedModels);
      return result.models
        .map(model => model.id)
        .filter(id => supportedModels.has(id));
    } catch (error) {
      console.error('Error fetching models:', error);
      return COHERE_CAPABILITIES.supportedModels;
    }
  }

  override updateConfig(newConfig: Partial<CohereConfig>): void {
    super.updateConfig!(newConfig);
  }
}