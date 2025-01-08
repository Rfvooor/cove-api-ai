import { BaseLanguageModelImpl, ModelCapabilities } from '../../core/base-language-model.js';

export interface LanguageModelConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  organization?: string;
}

export abstract class BaseLanguageModelIntegration extends BaseLanguageModelImpl {
  protected config: Required<LanguageModelConfig>;

  constructor(config: LanguageModelConfig, capabilities: ModelCapabilities) {
    super(capabilities);
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'default',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096,
      organization: config.organization || ''
    };
  }

  abstract generateText(prompt: string, options?: Partial<LanguageModelConfig>): Promise<string>;

  generateEmbedding?(text: string): Promise<number[]> {
    if (!this.capabilities.supportsEmbeddings) {
      throw new Error('Embeddings not supported by this model');
    }
    return Promise.reject(new Error('Embeddings not implemented by this model'));
  }

  countTokens?(text: string): Promise<number> {
    if (!this.capabilities.supportsTokenCounting) {
      throw new Error('Token counting not supported by this model');
    }
    return Promise.reject(new Error('Token counting not implemented by this model'));
  }

  abstract listAvailableModels(): Promise<string[]>;

  updateConfig(config: Partial<LanguageModelConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }

  protected validateMaxLength(text: string, maxLength: number): void {
    if (text.length > maxLength) {
      throw new Error(`Input text exceeds maximum length of ${maxLength} characters`);
    }
  }
}