import Anthropic, { MessageCreateParams, MessageResponse } from '@anthropic-ai/sdk';
import {
  ModelCapabilities,
  PromptInput,
  GenerateTextResult,
  ErrorType
} from '../../core/base-language-model.js';
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
      supportsImages: false,
      supportsStreaming: false,
      maxContextLength: config.maxTokens || 100000,
      supportedModels: [
        'claude-3-opus-20240229',
        'claude-3-5-sonnet-20240620',
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

  async generateText(prompt: string | PromptInput, options: Partial<LanguageModelConfig> = {}): Promise<GenerateTextResult> {
    const startTime = Date.now();
    try {
      const {
        temperature = this.config.temperature,
        maxTokens = this.config.maxTokens,
        model = this.config.model
      } = options;

      const promptText = typeof prompt === 'string' ? prompt : prompt.text;
      this.validateMaxLength(promptText, this.capabilities.maxContextLength);

      const params: MessageCreateParams = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: promptText }]
      };

      const response = await this.createMessage(params);

      // Null check for the response
      if (!response?.content?.[0]?.text) {
        throw new Error('Invalid response format');
      }

      const result: GenerateTextResult = {
        text: response.content[0].text,
        tokens: {
          prompt: 0, // Claude doesn't provide token counts
          completion: 0,
          total: 0
        },
        modelName: model,
        finishReason: 'stop'
      };

      await this.updateMetrics(startTime, result);
      return result;
    } catch (error) {
      const errorResult: GenerateTextResult = {
        text: '',
        tokens: { prompt: 0, completion: 0, total: 0 },
        modelName: this.config.model,
        finishReason: 'error',
        error: {
          code: error instanceof Error ? error.constructor.name : 'unknown',
          message: error instanceof Error ? error.message : String(error),
          type: 'api_error'
        }
      };

      await this.updateMetrics(startTime, errorResult, error instanceof Error ? error : undefined);
      throw error;
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