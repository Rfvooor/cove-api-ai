import { EventEmitter } from 'events';

/**
 * Represents a JSON Schema type definition
 */
export interface SchemaType {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  description?: string;
  properties?: Record<string, SchemaType>;
  items?: SchemaType;
  required?: string[];
  enum?: any[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  default?: any;
  examples?: any[];
}

/**
 * Configuration for creating a new tool
 */
export interface ToolConfig<TInput = unknown, TOutput = unknown> {
  name: string;
  description?: string;
  requiredTools?: string[];
  inputSchema?: SchemaType;
  outputSchema?: SchemaType;
  execute: (input: TInput) => Promise<TOutput>;
}

/**
 * Represents a tool's schema information
 */
export type ToolSchemaType = {
  name: string;
  description?: string;
  requiredTools: string[];
  inputSchema?: SchemaType;
  outputSchema?: SchemaType;
};

/**
 * Validation result interface
 */
interface ValidationResult {
  success: boolean;
  errors: string[];
}

export class Tool<TInput = unknown, TOutput = unknown> extends EventEmitter {
  private readonly _name: string;
  private readonly _description: string;
  private readonly _requiredTools: string[];
  private readonly _inputSchema?: SchemaType;
  private readonly _outputSchema?: SchemaType;
  private readonly _executeFunction: (input: TInput) => Promise<TOutput>;

  constructor(config: ToolConfig<TInput, TOutput>) {
    super();
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

  get inputSchema(): SchemaType | undefined {
    return this._inputSchema;
  }

  get outputSchema(): SchemaType | undefined {
    return this._outputSchema;
  }

  /**
   * Executes the tool with the given input
   */
  async execute(input: TInput): Promise<TOutput> {
    try {
      // Validate input if schema exists
      if (this._inputSchema) {
        const validationResult = this.validateAgainstSchema(input, this._inputSchema);
        if (!validationResult.success) {
          throw new Error(`Invalid input: ${validationResult.errors.join(', ')}`);
        }
      }

      const result = await this._executeFunction(input);

      // Validate output if schema exists
      if (this._outputSchema) {
        const validationResult = this.validateAgainstSchema(result, this._outputSchema);
        if (!validationResult.success) {
          throw new Error(`Invalid output: ${validationResult.errors.join(', ')}`);
        }
      }

      return result;
    } catch (error) {
      console.error(`Error executing tool ${this._name}:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Validates input against the schema
   */
  validate(input: unknown): input is TInput {
    if (!this._inputSchema) return true;
    return this.validateAgainstSchema(input, this._inputSchema).success;
  }

  /**
   * Gets a human-readable description of the tool's capabilities
   */
  getCapabilities(): string {
    const capabilities = [
      `Tool: ${this._name}`,
      `Description: ${this._description}`,
      `Required Tools: ${this._requiredTools.join(', ') || 'None'}`
    ];

    if (this._inputSchema) {
      capabilities.push(
        'Input Schema:',
        this.formatSchemaForLLM(this._inputSchema)
      );
    }

    if (this._outputSchema) {
      capabilities.push(
        'Output Schema:',
        this.formatSchemaForLLM(this._outputSchema)
      );
    }

    return capabilities.join('\n');
  }

  /**
   * Creates a new tool instance
   */
  static create<TInput = unknown, TOutput = unknown>(
    config: ToolConfig<TInput, TOutput>
  ): Tool<TInput, TOutput> {
    return new Tool<TInput, TOutput>(config);
  }

  /**
   * Formats a schema in a way that's easily understood by LLMs
   */
  private formatSchemaForLLM(schema: SchemaType, indent: string = ''): string {
    const lines: string[] = [];

    if (schema.description) {
      lines.push(`${indent}Description: ${schema.description}`);
    }

    lines.push(`${indent}Type: ${schema.type}`);

    if (schema.enum) {
      lines.push(`${indent}Allowed Values: ${schema.enum.join(', ')}`);
    }

    if (schema.type === 'object' && schema.properties) {
      lines.push(`${indent}Properties:`);
      for (const [key, prop] of Object.entries(schema.properties)) {
        lines.push(`${indent}  ${key}:`);
        lines.push(this.formatSchemaForLLM(prop, `${indent}    `));
        if (schema.required?.includes(key)) {
          lines.push(`${indent}    Required: true`);
        }
      }
    }

    if (schema.type === 'array' && schema.items) {
      lines.push(`${indent}Array Items:`);
      lines.push(this.formatSchemaForLLM(schema.items, `${indent}  `));
    }

    if (schema.examples?.length) {
      lines.push(`${indent}Examples:`);
      schema.examples.forEach(example => {
        lines.push(`${indent}  ${JSON.stringify(example)}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Validates a value against a schema
   */
  private validateAgainstSchema(value: unknown, schema: SchemaType): ValidationResult {
    const errors: string[] = [];

    // Type validation
    if (!this.validateType(value, schema.type)) {
      errors.push(`Expected type ${schema.type}, got ${typeof value}`);
      return { success: false, errors };
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`Value must be one of: ${schema.enum.join(', ')}`);
    }

    // Number validations
    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`Value must be >= ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`Value must be <= ${schema.maximum}`);
      }
    }

    // String validations
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`String length must be >= ${schema.minLength}`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`String length must be <= ${schema.maxLength}`);
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errors.push(`String must match pattern: ${schema.pattern}`);
      }
    }

    // Object validations
    if (schema.type === 'object' && schema.properties && typeof value === 'object' && value !== null) {
      // Required properties
      if (schema.required) {
        for (const required of schema.required) {
          if (!(required in value)) {
            errors.push(`Missing required property: ${required}`);
          }
        }
      }

      // Validate each property
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (key in value) {
          const propValue = (value as any)[key];
          const propValidation = this.validateAgainstSchema(propValue, prop);
          if (!propValidation.success) {
            errors.push(`Invalid property "${key}": ${propValidation.errors.join(', ')}`);
          }
        }
      }
    }

    // Array validations
    if (schema.type === 'array' && Array.isArray(value) && schema.items) {
      value.forEach((item, index) => {
        const itemValidation = this.validateAgainstSchema(item, schema.items!);
        if (!itemValidation.success) {
          errors.push(`Invalid array item at index ${index}: ${itemValidation.errors.join(', ')}`);
        }
      });
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Validates the basic type of a value
   */
  private validateType(value: unknown, type: SchemaType['type']): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      case 'null':
        return value === null;
      default:
        return false;
    }
  }
}