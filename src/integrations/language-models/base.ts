import { BaseLanguageModelImpl, ModelCapabilities, GenerateTextResult, GenerateTextOptions, PromptInput, ErrorType } from '../../core/base-language-model.js';
import { classifyError } from '../../utils/error-utils.js';

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
    super(capabilities, {
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens
    });
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'default',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096,
      organization: config.organization || ''
    };
  }

  abstract generateText(
    prompt: string | PromptInput,
    options?: GenerateTextOptions
  ): Promise<GenerateTextResult>;

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

  protected async wrapGenerateText(
    generateFn: (prompt: string, options?: any) => Promise<string>,
    prompt: string | PromptInput,
    options?: GenerateTextOptions
  ): Promise<GenerateTextResult> {
    const startTime = Date.now();
    let promptText: string;
    let promptTokens = 0;

    try {
      // Handle prompt input
      if (typeof prompt === 'string') {
        promptText = prompt;
      } else {
        promptText = prompt.text;
        if (prompt.images && !this.capabilities.supportsImages) {
          throw new Error('Images not supported by this model');
        }
      }

      // Count tokens if supported
      if (this.capabilities.supportsTokenCounting && this.countTokens) {
        promptTokens = await this.countTokens(promptText);
      }

      // Generate text
      const text = await generateFn(promptText, options);

      // Count completion tokens if supported
      let completionTokens = 0;
      if (this.capabilities.supportsTokenCounting && this.countTokens) {
        completionTokens = await this.countTokens(text);
      }

      // Calculate cost if available
      const cost = this.calculateCost({
        prompt: promptTokens,
        completion: completionTokens
      });

      const result: GenerateTextResult = {
        text,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens
        },
        cost,
        modelName: this.config.model,
        finishReason: 'stop'
      };

      // Update metrics
      await this.updateMetrics(startTime, result);

      return result;
    } catch (error) {
      const errorResult: GenerateTextResult = {
        text: '',
        tokens: {
          prompt: promptTokens,
          completion: 0,
          total: promptTokens
        },
        modelName: this.config.model,
        finishReason: 'error',
        error: {
          code: error instanceof Error ? error.constructor.name : 'unknown',
          message: error instanceof Error ? error.message : String(error),
          type: classifyError(error)
        }
      };

      // Update metrics
      await this.updateMetrics(startTime, errorResult, error instanceof Error ? error : undefined);

      return errorResult;
    }
  }

  protected validateMaxLength(text: string, maxLength: number): void {
    if (text.length > maxLength) {
      throw new Error(`Input text exceeds maximum length of ${maxLength} characters`);
    }
  }
}
