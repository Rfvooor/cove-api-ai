import Anthropic, { MessageCreateParams, MessageResponse } from '@anthropic-ai/sdk';
import { ModelCapabilities } from '../../core/base-language-model.js';
import { BaseLanguageModelIntegration, LanguageModelConfig } from './base.js';

export interface ClaudeConfig extends Omit<LanguageModelConfig, 'organization'> {
  organization?: string;
}

export class ClaudeIntegration extends BaseLanguageModelIntegration {
  private anthropicClient: Anthropic;

  constructor(config: ClaudeConfig) {
    const capabilities: ModelCapabilities = {
      supportsEmbeddings: false,
      supportsTokenCounting: false,
      maxContextLength: config.maxTokens || 100000,
      supportedModels: [
        'claude-2.1',
        'claude-2.0',
        'claude-instant-1.2',
        'claude-instant-1.1'
      ]
    };

    // Convert ClaudeConfig to LanguageModelConfig
    const baseConfig: LanguageModelConfig = {
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      organization: config.organization || ''
    };

    super(baseConfig, capabilities);

    this.anthropicClient = new Anthropic({
      apiKey: this.config.apiKey
    });
  }

  private async createMessage(params: MessageCreateParams): Promise<MessageResponse> {
    const client = this.anthropicClient as any;
    if (!client?.messages?.create) {
      throw new Error('Messages API not available');
    }

    // Create a wrapper function that maintains the correct 'this' context
    const wrappedCreate = async (messageParams: MessageCreateParams): Promise<MessageResponse> => {
      const messages = client.messages;
      if (!messages) {
        throw new Error('Messages API not available');
      }

      // Create a new function that's bound to the messages object
      const createFn = messages.create;
      if (typeof createFn !== 'function') {
        throw new Error('Create method not available');
      }

      // Call the function directly with the messages object as 'this'
      const result = await Promise.resolve().then(() => createFn.call(messages, messageParams));
      if (!result) {
        throw new Error('No response from API');
      }
      return result;
    };

    return wrappedCreate(params);
  }

  async generateText(prompt: string, options: Partial<LanguageModelConfig> = {}): Promise<string> {
    try {
      const {
        temperature = this.config.temperature,
        maxTokens = this.config.maxTokens,
        model = this.config.model
      } = options;

      this.validateMaxLength(prompt, this.capabilities.maxContextLength);

      const params: MessageCreateParams = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }]
      };

      const response = await this.createMessage(params);

      // Null check for the response
      if (!response?.content?.[0]?.text) {
        throw new Error('Invalid response format');
      }

      return response.content[0].text;
    } catch (error) {
      console.error('Claude API Error:', error);
      throw new Error('Failed to generate text using Claude');
    }
  }

  async listAvailableModels(): Promise<string[]> {
    // Claude SDK doesn't provide a direct method to list models
    return this.capabilities.supportedModels;
  }

  updateConfig(newConfig: Partial<LanguageModelConfig>): void {
    super.updateConfig!(newConfig);

    if (newConfig.apiKey) {
      this.anthropicClient = new Anthropic({
        apiKey: this.config.apiKey
      });
    }
  }
}