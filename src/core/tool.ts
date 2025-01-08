import type { ZodType, ZodError } from 'zod';

export type ToolSchemaType = {
  name: string;
  description?: string;
  requiredTools: string[];
  inputSchema?: ZodType<any>;
  outputSchema?: ZodType<any>;
};

export interface ToolConfig<TInput = unknown, TOutput = unknown> {
  name: string;
  description?: string;
  requiredTools?: string[];
  inputSchema?: ZodType<TInput>;
  outputSchema?: ZodType<TOutput>;
  execute: (input: TInput) => Promise<TOutput>;
}

export class Tool<TInput = unknown, TOutput = unknown> {
  private readonly _name: string;
  private readonly _description: string;
  private readonly _requiredTools: string[];
  private readonly _inputSchema?: ZodType<TInput>;
  private readonly _outputSchema?: ZodType<TOutput>;
  private readonly _executeFunction: (input: TInput) => Promise<TOutput>;

  constructor(config: ToolConfig<TInput, TOutput>) {
    this._name = config.name;
    this._description = config.description || '';
    this._requiredTools = config.requiredTools || [];
    this._inputSchema = config.inputSchema;
    this._outputSchema = config.outputSchema;
    this._executeFunction = config.execute;
  }

  get name(): string {
    return this._name;
  }

  get description(): string {
    return this._description;
  }

  get requiredTools(): string[] {
    return [...this._requiredTools];
  }

  get inputSchema(): ZodType<TInput> | undefined {
    return this._inputSchema;
  }

  get outputSchema(): ZodType<TOutput> | undefined {
    return this._outputSchema;
  }

  async execute(input: TInput): Promise<TOutput> {
    try {
      // Validate input if input schema exists
      if (this._inputSchema) {
        const parseResult = this._inputSchema.safeParse(input);
        if (!parseResult.success) {
          const errorMessage = parseResult.error.errors
            .map((err: ZodError['errors'][number]) => `${err.path.join('.')}: ${err.message}`)
            .join(', ');
          throw new Error(`Invalid input: ${errorMessage}`);
        }
      }

      const result = await this._executeFunction(input);

      // Validate output if output schema exists
      if (this._outputSchema) {
        const parseResult = this._outputSchema.safeParse(result);
        if (!parseResult.success) {
          const errorMessage = parseResult.error.errors
            .map((err: ZodError['errors'][number]) => `${err.path.join('.')}: ${err.message}`)
            .join(', ');
          throw new Error(`Invalid output: ${errorMessage}`);
        }
      }

      return result;
    } catch (error) {
      console.error(`Error executing tool ${this._name}:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  validate(input: unknown): input is TInput {
    if (this._inputSchema) {
      return this._inputSchema.safeParse(input).success;
    }
    return true;
  }

  getCapabilities(): string {
    const capabilities = [
      `Tool: ${this._name}`,
      `Description: ${this._description}`,
      `Required Tools: ${this._requiredTools.join(', ') || 'None'}`
    ];

    if (this._inputSchema) {
      capabilities.push('Input Schema: Available');
    }
    if (this._outputSchema) {
      capabilities.push('Output Schema: Available');
    }

    return capabilities.join('\n');
  }

  static create<TInput = unknown, TOutput = unknown>(
    config: ToolConfig<TInput, TOutput>
  ): Tool<TInput, TOutput> {
    return new Tool<TInput, TOutput>(config);
  }
}