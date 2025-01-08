declare module 'langchain/llms/openai' {
  export interface OpenAIInput {
    openAIApiKey?: string;
    modelName?: string;
    temperature?: number;
    maxTokens?: number;
  }

  export class OpenAI {
    constructor(input: OpenAIInput);
    call(prompt: string): Promise<string>;
  }

  export default OpenAI;
}

declare module 'langchain/chat_models/openai' {
  export interface ChatOpenAIInput {
    openAIApiKey?: string;
    modelName?: string;
    temperature?: number;
    maxTokens?: number;
  }

  export class ChatOpenAI {
    constructor(input: ChatOpenAIInput);
    call(messages: any[]): Promise<any>;
  }

  export default ChatOpenAI;
}

declare module 'langchain/prompts' {
  export interface PromptTemplateInput {
    template: string;
    inputVariables: string[];
  }

  export class PromptTemplate {
    constructor(input: PromptTemplateInput);
    format(values: Record<string, any>): Promise<string>;
  }
}

declare module 'langchain/chains' {
  export interface LLMChainInput {
    llm: any;
    prompt: any;
  }

  export class LLMChain {
    constructor(input: LLMChainInput);
    call(values: Record<string, any>): Promise<{ text: string }>;
  }
}