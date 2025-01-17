import { OpenAI as LangchainOpenAI, ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseLanguageModelIntegration, LanguageModelConfig } from './base.js';
import {
  ModelCapabilities,
  PromptInput,
  GenerateTextResult,
  GenerateTextOptions
} from '../../core/base-language-model.js';
import { classifyError } from '../../utils/error-utils.js';

export interface LangchainConfig extends LanguageModelConfig {
  // Langchain-specific config options can be added here
}

const LANGCHAIN_CAPABILITIES: Required<ModelCapabilities> = {
  supportsEmbeddings: true,
  supportsTokenCounting: true,
  supportsImages: false,
  supportsStreaming: true,
  maxContextLength: 16384, // Using GPT-4's context window as default
  supportedModels: [
    'gpt-4',
    'gpt-4-32k',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
    'text-embedding-ada-002'
  ],
  maxParallelRequests: 5,
  costPerToken: {
    prompt: 0.0015,    // Using GPT-3.5 rates as default
    completion: 0.002
  }
};

export class LangchainIntegration extends BaseLanguageModelIntegration {
  private openAIModel: LangchainOpenAI | ChatOpenAI;

  constructor(config: LangchainConfig) {
    const defaultConfig = {
      ...config,
      model: config.model || 'gpt-3.5-turbo'
    };
    super(defaultConfig, LANGCHAIN_CAPABILITIES);

    // Determine whether to use chat or completion model based on model name
    this.openAIModel = defaultConfig.model.includes('gpt-3.5-turbo') || defaultConfig.model.includes('gpt-4')
      ? new ChatOpenAI({
          openAIApiKey: defaultConfig.apiKey,
          modelName: defaultConfig.model,
          temperature: defaultConfig.temperature,
          maxTokens: defaultConfig.maxTokens
        })
      : new LangchainOpenAI({
          openAIApiKey: defaultConfig.apiKey,
          modelName: defaultConfig.model,
          temperature: defaultConfig.temperature,
          maxTokens: defaultConfig.maxTokens
        });
  }

  async generateText(prompt: string | PromptInput, options: GenerateTextOptions = {}): Promise<GenerateTextResult> {
    const startTime = Date.now();
    try {
      const promptText = typeof prompt === 'string' ? prompt : prompt.text;
      this.validateMaxLength(promptText, this.capabilities.maxContextLength);

      const {
        temperature = this.config.temperature,
        maxTokens = this.config.maxTokens
      } = options;

      // Create a prompt template
      const promptTemplate = new PromptTemplate({
        template: "{input}",
        inputVariables: ["input"]
      });

      // Create and run a sequence with output parsing
      const chain = RunnableSequence.from([
        promptTemplate,
        this.openAIModel,
        new StringOutputParser()
      ]);

      const response = await chain.invoke({ input: promptText });
      if (!response) {
        throw new Error('No content received from Langchain');
      }

      // Estimate token counts
      const promptTokens = await this.countTokens(promptText);
      const completionTokens = await this.countTokens(response);

      const result: GenerateTextResult = {
        text: response,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens
        },
        modelName: this.config.model,
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
          type: classifyError(error)
        }
      };

      await this.updateMetrics(startTime, errorResult, error instanceof Error ? error : undefined);
      return errorResult;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.capabilities.supportsEmbeddings) {
      throw new Error('Embeddings not supported by this model');
    }

    try {
      // Use OpenAI's embedding endpoint since Langchain doesn't expose embeddings directly
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: text
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const result = await response.json() as {
        data: Array<{ embedding: number[] }>;
      };

      if (!result.data || result.data.length === 0 || !result.data[0].embedding) {
        throw new Error('Invalid embedding data received from OpenAI API');
      }

      return result.data[0].embedding;
    } catch (error) {
      console.error('Embedding Error:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  async countTokens(text: string): Promise<number> {
    if (!this.capabilities.supportsTokenCounting) {
      throw new Error('Token counting not supported by this model');
    }

    // Use OpenAI's tokenizer since Langchain doesn't expose token counting
    // This is a rough estimation based on GPT tokenization rules
    return Math.ceil(text.length / 4);
  }

  async listAvailableModels(): Promise<string[]> {
    return LANGCHAIN_CAPABILITIES.supportedModels;
  }

  async createPromptTemplate(template: string, inputVariables: string[]): Promise<PromptTemplate> {
    return PromptTemplate.fromTemplate(template);
  }

  async createChain(promptTemplate: PromptTemplate): Promise<RunnableSequence<any, string>> {
    return RunnableSequence.from([
      promptTemplate,
      this.openAIModel,
      new StringOutputParser()
    ]);
  }

  override updateConfig(newConfig: Partial<LangchainConfig>): void {
    super.updateConfig!(newConfig);

    // Reinitialize the model with new configuration
    this.openAIModel = this.config.model.includes('gpt-3.5-turbo') || this.config.model.includes('gpt-4')
      ? new ChatOpenAI({
          openAIApiKey: this.config.apiKey,
          modelName: this.config.model,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens
        })
      : new LangchainOpenAI({
          openAIApiKey: this.config.apiKey,
          modelName: this.config.model,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens
        });
  }
}