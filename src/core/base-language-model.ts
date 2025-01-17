export interface PromptInput {
  text: string;
  images?: Array<{
    url?: string;
    base64?: string;
    mimeType?: string;
  }>;
  metadata?: Record<string, any>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateTextOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  timeout?: number;
  retryConfig?: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay?: number;
    maxDelay?: number;
  };
}

export type ErrorType = 'rate_limit' | 'context_length' | 'token_limit' | 'content_filter' | 'timeout' | 'api_error' | 'other';

export interface GenerateTextResult {
  text: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number;
  modelName?: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'timeout' | 'error';
  error?: {
    code: string;
    message: string;
    type: ErrorType;
  };
}

export interface ModelCapabilities {
  supportsEmbeddings: boolean;
  supportsTokenCounting: boolean;
  supportsImages: boolean;
  supportsStreaming: boolean;
  maxContextLength: number;
  supportedModels: string[];
  maxParallelRequests?: number;
  costPerToken?: {
    prompt: number;
    completion: number;
  };
}

export interface ModelConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  organization?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retryConfig?: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay?: number;
    maxDelay?: number;
  };
}

export interface ModelMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
  errorRates: Record<string, number>;
}

export interface BaseLanguageModel {
  generateText(prompt: string | PromptInput, options?: GenerateTextOptions): Promise<GenerateTextResult>;
  generateEmbedding?(text: string): Promise<number[]>;
  countTokens?(text: string): Promise<number>;
  listAvailableModels?(): Promise<string[]>;
  updateConfig?(config: Partial<ModelConfig>): void;
  supportsImages?(): boolean;
  getMetrics?(): ModelMetrics;
  resetMetrics?(): void;
}

export abstract class BaseLanguageModelImpl implements BaseLanguageModel {
  protected capabilities: ModelCapabilities;
  protected config: ModelConfig;
  protected metrics: ModelMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalTokens: 0,
    totalCost: 0,
    averageLatency: 0,
    errorRates: {}
  };

  constructor(capabilities: ModelCapabilities, config: ModelConfig) {
    this.capabilities = capabilities;
    this.config = {
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30000,
      retryConfig: {
        maxAttempts: 3,
        backoffMultiplier: 1.5,
        initialDelay: 1000,
        maxDelay: 30000
      },
      ...config
    };
  }

  abstract generateText(
    prompt: string | PromptInput,
    options?: GenerateTextOptions
  ): Promise<GenerateTextResult>;

  async generateEmbedding?(text: string): Promise<number[]> {
    if (!this.capabilities.supportsEmbeddings) {
      throw new Error('Embeddings not supported by this model');
    }
    throw new Error('Method not implemented');
  }

  async countTokens?(text: string): Promise<number> {
    if (!this.capabilities.supportsTokenCounting) {
      throw new Error('Token counting not supported by this model');
    }
    throw new Error('Method not implemented');
  }

  async listAvailableModels?(): Promise<string[]> {
    return this.capabilities.supportedModels;
  }

  updateConfig?(config: Partial<ModelConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }

  supportsImages(): boolean {
    return this.capabilities.supportsImages;
  }

  getMetrics(): ModelMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      averageLatency: 0,
      errorRates: {}
    };
  }

  protected async updateMetrics(
    startTime: number,
    result: GenerateTextResult,
    error?: Error
  ): Promise<void> {
    const duration = Date.now() - startTime;
    this.metrics.totalRequests++;

    if (error || result.error) {
      this.metrics.failedRequests++;
      const errorType = error?.constructor.name || result.error?.type || 'unknown';
      this.metrics.errorRates[errorType] = (this.metrics.errorRates[errorType] || 0) + 1;
    } else {
      this.metrics.successfulRequests++;
    }

    if (result.tokens) {
      this.metrics.totalTokens += result.tokens.total;
    }

    if (result.cost) {
      this.metrics.totalCost += result.cost;
    }

    // Update average latency using exponential moving average
    const weight = 0.1;
    this.metrics.averageLatency = 
      (1 - weight) * this.metrics.averageLatency + weight * duration;
  }

  protected calculateCost(tokens: { prompt: number; completion: number }): number {
    if (!this.capabilities.costPerToken) return 0;

    return (
      tokens.prompt * (this.capabilities.costPerToken.prompt || 0) +
      tokens.completion * (this.capabilities.costPerToken.completion || 0)
    );
  }

  protected validateMaxLength(text: string, maxLength: number): void {
    if (text.length > maxLength) {
      throw new Error(`Input text exceeds maximum length of ${maxLength} characters`);
    }
  }
}