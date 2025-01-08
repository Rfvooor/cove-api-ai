declare module '@anthropic-ai/sdk' {
  export interface AnthropicOptions {
    apiKey: string;
  }

  export interface MessageCreateParams {
    model: string;
    max_tokens: number;
    temperature?: number;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
  }

  export interface MessageResponse {
    content: Array<{
      text?: string;
      type: string;
    }>;
    model: string;
    stop_reason: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  }

  export class Anthropic {
    constructor(options: AnthropicOptions);

    messages: {
      create: (params: MessageCreateParams) => Promise<MessageResponse>;
    };
  }

  export default Anthropic;
}