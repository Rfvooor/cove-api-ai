import OpenAI from 'openai';
import { BaseLanguageModelIntegration, LanguageModelConfig } from './base.js';
import { ModelCapabilities, PromptInput, GenerateTextResult } from '../../core/base-language-model.js';

export interface OpenRouterConfig extends LanguageModelConfig {
  baseURL?: string;
}

const OPENROUTER_CAPABILITIES: Required<ModelCapabilities> = {
  supportsEmbeddings: false,
  supportsTokenCounting: false,
  supportsImages: false,
  supportsStreaming: false,
  maxContextLength: 32768, // Using Claude-2's context window as default
  supportedModels: [
    'anthropic/claude-2',
    'anthropic/claude-instant-v1',
    'google/palm-2-chat-bison',
    'meta-llama/llama-2-70b-chat',
    'meta-llama/llama-2-13b-chat',
    'openai/gpt-4',
    'openai/gpt-3.5-turbo'
  ],
  maxParallelRequests: 5,
  costPerToken: {
    prompt: 0.0001,
    completion: 0.0002
  }
};

export class OpenRouterIntegration extends BaseLanguageModelIntegration {
  private client: OpenAI;
  private readonly baseURL: string;

  constructor(config: OpenRouterConfig) {
    const defaultConfig = {
      ...config,
      model: config.model || 'anthropic/claude-2',
      baseURL: config.baseURL || 'https://openrouter.ai/api/v1'
    };
    super(defaultConfig, OPENROUTER_CAPABILITIES);

    this.baseURL = defaultConfig.baseURL;
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.baseURL,
      defaultHeaders: {
        'HTTP-Referer': 'https://coveapi.ai',
        'X-Title': 'Cove API AI'
      },
      defaultQuery: {
        'model': this.config.model
      }
    });
  }

  async generateText(
    prompt: string | PromptInput,
    options: Partial<OpenRouterConfig> = {}
  ): Promise<GenerateTextResult> {
    return this.wrapGenerateText(
      async (promptText: string, opts?: Partial<OpenRouterConfig>) => {
        this.validateMaxLength(promptText, this.capabilities.maxContextLength);

        const {
          temperature = this.config.temperature,
          maxTokens = this.config.maxTokens,
          model = this.config.model
        } = opts || {};

        const response = await this.client.chat.completions.create({
          model: model,
          messages: [{ role: 'user', content: promptText }],
          temperature: temperature,
          max_tokens: maxTokens,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content received from OpenRouter API');
        }

        return content;
      },
      prompt,
      options
    );
  }

  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://coveapi.ai',
          'X-Title': 'Cove API AI'
        }
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data = await response.json() as { data: Array<{ id: string }> };
      const supportedModels = new Set(OPENROUTER_CAPABILITIES.supportedModels);
      
      return data.data
        .map(model => model.id)
        .filter(id => supportedModels.has(id));
    } catch (error) {
      console.error('Error fetching models:', error);
      return OPENROUTER_CAPABILITIES.supportedModels;
    }
  }

  override updateConfig(newConfig: Partial<OpenRouterConfig>): void {
    super.updateConfig!(newConfig);

    // Reinitialize client if API key or base URL changes
    if (newConfig.apiKey || newConfig.baseURL) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: newConfig.baseURL || this.baseURL,
        defaultHeaders: {
          'HTTP-Referer': 'https://coveapi.ai',
          'X-Title': 'Cove API AI'
        },
        defaultQuery: {
          'model': newConfig.model || this.config.model
        }
      });
    }
  }
}