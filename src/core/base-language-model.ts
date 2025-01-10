export interface PromptInput {
  text: string;
  images?: Array<{
    url?: string;
    base64?: string;
    mimeType?: string;
  }>;
  metadata?: Record<string, any>;
}

export interface BaseLanguageModel {
  generateText(prompt: string | PromptInput, options?: any): Promise<string>;
  generateEmbedding?(text: string): Promise<number[]>;
  countTokens?(text: string): Promise<number>;
  listAvailableModels?(): Promise<string[]>;
  updateConfig?(config: any): void;
  supportsImages?(): boolean;
}

export interface ModelCapabilities {
  supportsEmbeddings: boolean;
  supportsTokenCounting: boolean;
  supportsImages: boolean;
  maxContextLength: number;
  supportedModels: string[]; 
}

export abstract class BaseLanguageModelImpl implements BaseLanguageModel {
  protected capabilities: ModelCapabilities;

  constructor(capabilities: ModelCapabilities) {
    this.capabilities = capabilities;
  }

  abstract generateText(prompt: string | PromptInput, options?: any): Promise<string>;

  async generateEmbedding?(text: string): Promise<number[]> {
    throw new Error('Embeddings not supported by this model');
  }

  async countTokens?(text: string): Promise<number> {
    throw new Error('Token counting not supported by this model');
  }

  async listAvailableModels?(): Promise<string[]> {
    return this.capabilities.supportedModels;
  }

  updateConfig?(config: any): void {
    // Optional configuration update
  }

  supportsImages(): boolean {
    return this.capabilities.supportsImages;
  }

  getCapabilities(): ModelCapabilities {
    return { ...this.capabilities };
  }

  protected validateMaxLength(text: string, maxLength: number): void {
    if (text.length > maxLength) {
      throw new Error(`Input text exceeds maximum length of ${maxLength} characters`);
    }
  }
}