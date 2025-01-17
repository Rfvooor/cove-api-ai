import { BaseLanguageModelIntegration } from './base.js';
import { LanguageModelConfig } from './base.js';
import { GenerateTextResult, GenerateTextOptions, PromptInput, ModelCapabilities } from '../../core/base-language-model.js';
import { OpenAI } from 'openai';
import type { ChatCompletionCreateParams } from 'openai/resources/chat/completions';

export interface OpenAIConfig extends LanguageModelConfig {
  organization?: string;
}

export class OpenAIIntegration extends BaseLanguageModelIntegration {
  private client: OpenAI;

  constructor(config: OpenAIConfig) {
    const capabilities: ModelCapabilities = {
      supportsEmbeddings: true,
      supportsTokenCounting: true,
      supportsImages: true,
      supportsStreaming: true,
      maxContextLength: 4096,
      supportedModels: [
        'gpt-4',
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-32k',
        'gpt-3.5-turbo',
        'text-davinci-003',
        'text-embedding-ada-002'
      ],
      costPerToken: {
        prompt: 0.00003,
        completion: 0.00006
      }
    };

    super(config, capabilities);

    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization
    });
  }

  async generateText(
    prompt: string | PromptInput,
    options?: GenerateTextOptions
  ): Promise<GenerateTextResult> {
    return this.wrapGenerateText(
      async (promptText: string, opts?: GenerateTextOptions) => {
        const params = {
          model: this.config.model,
          messages: [{ 
            role: 'user' as const, 
            content: promptText 
          }],
          temperature: opts?.temperature ?? this.config.temperature,
          max_tokens: opts?.maxTokens ?? this.config.maxTokens,
          presence_penalty: opts?.presencePenalty,
          frequency_penalty: opts?.frequencyPenalty,
          stream: opts?.stream
        } satisfies ChatCompletionCreateParams;

        const response = await this.client.chat.completions.create(params);
        const content = response.choices[0].message?.content;
        if (!content) {
          throw new Error('No content in response');
        }
        return content;
      },
      prompt,
      options
    );
  }

  async createEmbeddings({ token, model, input }: { token: string, model: string, input: string }) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      method: 'POST',
      body: JSON.stringify({ input, model }),
    });
  
    const { error, data, usage } = await response.json();
  
    return data;
  };

  async generateEmbedding(text: string): Promise<number[]> {
    const data = await this.createEmbeddings({
      token: this.config.apiKey,
      model: 'text-embedding-ada-002',
      input: text
    });

    return data[0].embedding;
  }

  async countTokens(text: string): Promise<number> {
    // Use tiktoken or similar for accurate token counting
    return Math.ceil(text.length / 4);
  }

  async listAvailableModels(): Promise<string[]> {
    const response = await this.client.models.list();
    return response.data.map(model => model.id);
  }
}
