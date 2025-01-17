import { BaseLanguageModelIntegration, LanguageModelConfig } from './base.js';
import {
  ModelCapabilities,
  PromptInput,
  GenerateTextResult,
  GenerateTextOptions
} from '../../core/base-language-model.js';

export interface HuggingFaceConfig extends LanguageModelConfig {
  endpoint?: string;
  task?: string;
  waitForModel?: boolean;
}

const HUGGINGFACE_CAPABILITIES: Required<ModelCapabilities> = {
  supportsEmbeddings: true,
  supportsTokenCounting: false,
  supportsImages: true,
  supportsStreaming: false,
  maxContextLength: 2048, // Default context window, varies by model
  supportedModels: [
    'gpt2',
    'gpt2-large',
    'gpt2-xl',
    'facebook/opt-1.3b',
    'facebook/opt-6.7b',
    'EleutherAI/gpt-neo-2.7B',
    'EleutherAI/gpt-j-6B',
    'bigscience/bloom',
    'sentence-transformers/all-mpnet-base-v2', // For embeddings
    'sentence-transformers/all-MiniLM-L6-v2'   // For embeddings
  ],
  maxParallelRequests: 5,
  costPerToken: {
    prompt: 0.0001,
    completion: 0.0001
  }
};

export class HuggingFaceIntegration extends BaseLanguageModelIntegration {
  protected endpoint: string;
  protected waitForModel: boolean;

  constructor(config: HuggingFaceConfig) {
    const defaultConfig = {
      ...config,
      model: config.model || 'gpt2'
    };
    super(defaultConfig, HUGGINGFACE_CAPABILITIES);

    this.endpoint = config.endpoint || 'https://api-inference.huggingface.co/models';
    this.waitForModel = config.waitForModel ?? true;
  }

  async generateText(
    prompt: string | PromptInput,
    options: Partial<HuggingFaceConfig> = {}
  ): Promise<GenerateTextResult> {
    return this.wrapGenerateText(
      async (promptText: string, opts?: Partial<HuggingFaceConfig>) => {
        this.validateMaxLength(promptText, this.capabilities.maxContextLength);

        const {
          temperature = this.config.temperature,
          maxTokens = this.config.maxTokens,
          model = this.config.model
        } = opts || {};

        const response = await fetch(`${this.endpoint}/${model}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: promptText,
            parameters: {
              temperature,
              max_new_tokens: maxTokens,
              return_full_text: false
            },
            options: {
              wait_for_model: this.waitForModel
            }
          })
        });

        if (!response.ok) {
          throw new Error(`HuggingFace API error: ${response.statusText}`);
        }

        const result = await response.json() as Array<{ generated_text: string }>;

        if (!result || result.length === 0) {
          throw new Error('No content received from HuggingFace API');
        }

        return result[0].generated_text;
      },
      prompt,
      options
    );
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embeddingModel = 'sentence-transformers/all-mpnet-base-v2';
      const response = await fetch(`${this.endpoint}/${embeddingModel}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: text,
          options: {
            wait_for_model: this.waitForModel
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.statusText}`);
      }

      const result = await response.json() as number[][];

      if (!result || result.length === 0) {
        throw new Error('No embeddings received from HuggingFace API');
      }

      return result[0];
    } catch (error) {
      console.error('HuggingFace Embedding Error:', error);
      throw new Error('Failed to generate embedding using HuggingFace');
    }
  }

  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch('https://huggingface.co/api/models?sort=downloads&direction=-1&limit=100', {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.statusText}`);
      }

      const result = await response.json() as Array<{ id: string }>;
      const supportedModels = new Set(HUGGINGFACE_CAPABILITIES.supportedModels);

      return result
        .map(model => model.id)
        .filter(id => supportedModels.has(id));
    } catch (error) {
      console.error('Error fetching models:', error);
      return HUGGINGFACE_CAPABILITIES.supportedModels;
    }
  }

  override updateConfig(newConfig: Partial<HuggingFaceConfig>): void {
    super.updateConfig!(newConfig);
    
    // Update HuggingFace-specific config
    if (newConfig.endpoint) {
      this.endpoint = newConfig.endpoint;
    }
    if (newConfig.waitForModel !== undefined) {
      this.waitForModel = newConfig.waitForModel;
    }
  }
}