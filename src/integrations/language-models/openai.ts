import OpenAI from 'openai';
import { ModelCapabilities } from '../../core/base-language-model.js';
import { BaseLanguageModelIntegration, LanguageModelConfig } from './base.js';

export interface OpenAIConfig extends Omit<LanguageModelConfig, 'organization'> {
  organization?: string;
}

interface OpenAIModel {
  id: string;
  [key: string]: any;
}

export class OpenAIIntegration extends BaseLanguageModelIntegration {
  private client: OpenAI;

  constructor(config: OpenAIConfig) {
    const capabilities: ModelCapabilities = {
      supportsEmbeddings: true,
      supportsTokenCounting: true,
      maxContextLength: config.maxTokens || 4096,
      supportedModels: [
        'gpt-4',
        'gpt-4-32k',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
        'text-embedding-ada-002'
      ]
    };

    // Convert OpenAIConfig to LanguageModelConfig
    const baseConfig: LanguageModelConfig = {
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      organization: config.organization || ''
    };

    super(baseConfig, capabilities);

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      organization: this.config.organization || undefined
    });
  }

  async generateText(prompt: string, options: Partial<LanguageModelConfig> = {}): Promise<string> {
    try {
      const {
        temperature = this.config.temperature,
        maxTokens = this.config.maxTokens,
        model = this.config.model
      } = options;

      this.validateMaxLength(prompt, this.capabilities.maxContextLength);

      const response = await this.client.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: temperature,
        max_tokens: maxTokens
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error('Failed to generate text using OpenAI');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.capabilities.supportsEmbeddings) {
      throw new Error('Embeddings not supported by this model');
    }

    try {
      // Use type assertion since the OpenAI types are not up to date
      const client = this.client as any;
      if (!client.embeddings || typeof client.embeddings.create !== 'function') {
        throw new Error('Embeddings API not available');
      }

      const response = await client.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      });

      if (!response?.data?.[0]?.embedding) {
        throw new Error('Invalid embedding response format');
      }

      return response.data[0].embedding;
    } catch (error) {
      console.error('OpenAI Embedding Error:', error);
      throw new Error('Failed to generate embedding using OpenAI');
    }
  }

  async countTokens(text: string): Promise<number> {
    if (!this.capabilities.supportsTokenCounting) {
      throw new Error('Token counting not supported by this model');
    }

    // OpenAI doesn't provide a direct token counting endpoint
    // This is a rough approximation based on GPT tokenization rules
    // For production use, consider using a proper tokenizer library
    const words = text.trim().split(/\s+/);
    return Math.ceil(words.length * 1.3); // Average tokens per word
  }

  async listAvailableModels(): Promise<string[]> {
    try {
      // Use type assertion since the OpenAI types are not up to date
      const client = this.client as any;
      if (!client.models || typeof client.models.list !== 'function') {
        return this.capabilities.supportedModels;
      }

      const response = await client.models.list();
      if (!Array.isArray(response?.data)) {
        return this.capabilities.supportedModels;
      }

      return response.data
        .filter((model: OpenAIModel) => typeof model.id === 'string')
        .map((model: OpenAIModel) => model.id);
    } catch (error) {
      console.error('Error fetching models:', error);
      return this.capabilities.supportedModels;
    }
  }

  updateConfig(newConfig: Partial<LanguageModelConfig>): void {
    super.updateConfig(newConfig);

    if (newConfig.apiKey || newConfig.organization) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        organization: this.config.organization || undefined
      });
    }
  }
}

