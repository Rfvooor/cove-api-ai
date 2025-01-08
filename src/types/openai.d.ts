declare module 'openai' {
  export interface OpenAIOptions {
    apiKey: string;
    organization?: string | null;
    baseURL?: string;
    defaultHeaders?: Record<string, string>;
    defaultQuery?: Record<string, string>;
  }

  export class OpenAI {
    constructor(options: OpenAIOptions);

    chat: {
      completions: {
        create: (params: {
          model: string;
          messages: Array<{ role: string; content: string }>;
          temperature?: number;
          max_tokens?: number;
        }) => Promise<{
          choices: Array<{
            message?: {
              content?: string;
            }
          }>;
        }>;
      }
    };

    models: {
      list: () => Promise<{
        data: Array<{
          id: string;
        }>;
      }>;
    };
  }

  export default OpenAI;
}