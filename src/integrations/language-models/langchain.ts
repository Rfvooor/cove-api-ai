import { OpenAI as LangchainOpenAI } from 'langchain/llms/openai';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { PromptTemplate } from 'langchain/prompts';
import { LLMChain } from 'langchain/chains';
import { BaseLanguageModelIntegration, LanguageModelConfig } from './base.js';
import { ModelCapabilities } from '../../core/base-language-model.js';

export interface LangchainConfig extends LanguageModelConfig {
  // Langchain-specific config options can be added here
}

const LANGCHAIN_CAPABILITIES: Required<ModelCapabilities> = {
  supportsEmbeddings: true,
  supportsTokenCounting: true,
  maxContextLength: 16384, // Using GPT-4's context window as default
  supportedModels: [
    'gpt-4',
    'gpt-4-32k',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
    'text-embedding-ada-002'
  ]
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

  async generateText(prompt: string, options: Partial<LangchainConfig> = {}): Promise<string> {
    try {
      this.validateMaxLength(prompt, this.capabilities.maxContextLength);

      const {
        temperature = this.config.temperature, 
        maxTokens = this.config.maxTokens,
        model = this.config.model
      } = options;

      // Create a prompt template
      const promptTemplate = new PromptTemplate({
        template: "{input}",
        inputVariables: ["input"]
      });

      // Create an LLM chain
      const chain = new LLMChain({
        llm: this.openAIModel,
        prompt: promptTemplate
      });

      // Run the chain
      const response = await chain.call({ input: prompt });
      if (!response.text) {
        throw new Error('No content received from Langchain');
      }

      return response.text;
    } catch (error) {
      console.error('Langchain API Error:', error);
      throw new Error('Failed to generate text using Langchain');
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
    return new PromptTemplate({
      template,
      inputVariables
    });
  }

  async createChain(promptTemplate: PromptTemplate): Promise<LLMChain> {
    return new LLMChain({
      llm: this.openAIModel,
      prompt: promptTemplate
    });
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