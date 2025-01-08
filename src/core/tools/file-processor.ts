import { Tool } from '../tool.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface FileProcessorConfig {
  allowedExtensions?: string[];
  maxFileSize?: number; // in bytes
  encoding?: BufferEncoding;
}

interface TransformationConfig {
  field?: string;
  operator?: string;
  value?: any;
  type?: string;
  direction?: 'asc' | 'desc';
  ignoreCase?: boolean;
  reducer?: (acc: any, item: any) => any;
  initialValue?: any;
}

interface Transformation {
  type: 'filter' | 'map' | 'reduce' | 'sort' | 'group';
  config: TransformationConfig;
}

interface FileProcessorInput {
  operation: 'read' | 'write' | 'transform';
  filePath?: string;
  content?: unknown;
  format?: string;
  transformations?: Transformation[];
}

interface FileProcessorOutput {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class FileProcessor extends Tool<unknown, unknown> {
  private config: Required<FileProcessorConfig>;

  constructor(config: FileProcessorConfig = {}) {
    const execute = async <TInput, TOutput>(input: TInput): Promise<TOutput> => {
      const typedInput = input as FileProcessorInput;
      const result = await (async () => {
        try {
          switch (typedInput.operation) {
            case 'read':
              if (!typedInput.filePath) {
                throw new Error('File path is required for read operation');
              }
              const data = await this.readAndParseFile(typedInput.filePath);
              return { success: true, data };

            case 'write':
              if (!typedInput.filePath || typedInput.content === undefined) {
                throw new Error('File path and content are required for write operation');
              }
              await this.writeFile(typedInput.filePath, typedInput.content, typedInput.format);
              return { success: true };

            case 'transform':
              if (!typedInput.content || !typedInput.transformations) {
                throw new Error('Content and transformations are required for transform operation');
              }
              const transformed = await this.transformData(typedInput.content, typedInput.transformations);
              return { success: true, data: transformed };

            default:
              throw new Error(`Unsupported operation: ${(typedInput as any).operation}`);
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          };
        }
      })();
      return result as TOutput;
    };

    super({
      name: 'file-processor',
      description: 'A tool for reading, writing, and transforming data files in various formats',
      execute
    });

    this.config = {
      allowedExtensions: config.allowedExtensions || ['.txt', '.json', '.yaml', '.yml', '.csv'],
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB default
      encoding: config.encoding || 'utf-8'
    };
  }

  async readAndParseFile(filePath: string): Promise<unknown> {
    const ext = path.extname(filePath).toLowerCase();
    
    if (!this.config.allowedExtensions.includes(ext)) {
      throw new Error(`Unsupported file extension: ${ext}`);
    }

    const stats = await fs.stat(filePath);
    if (stats.size > this.config.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
    }

    const content = await fs.readFile(filePath, this.config.encoding);

    switch (ext) {
      case '.json':
        return JSON.parse(content);
      case '.yaml':
      case '.yml': {
        const { load } = await import('js-yaml');
        return load(content);
      }
      case '.csv': {
        const { parse } = await import('csv-parse/sync');
        return parse(content, {
          columns: true,
          skip_empty_lines: true
        });
      }
      default:
        return content;
    }
  }

  async writeFile(filePath: string, content: unknown, format?: string): Promise<void> {
    let outputContent: string;
    const ext = format || path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.json':
        outputContent = JSON.stringify(content, null, 2);
        break;
      case '.yaml':
      case '.yml': {
        const { dump } = await import('js-yaml');
        outputContent = dump(content);
        break;
      }
      case '.csv': {
        if (!Array.isArray(content)) {
          throw new Error('Content must be an array for CSV format');
        }
        const { stringify } = await import('csv-stringify/sync');
        outputContent = stringify(content, {
          header: true
        });
        break;
      }
      default:
        outputContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    }

    await fs.writeFile(filePath, outputContent, this.config.encoding);
  }

  async transformData(data: unknown, transformations: Transformation[]): Promise<unknown> {
    let result = data;

    for (const transformation of transformations) {
      if (!Array.isArray(result)) {
        return result;
      }

      switch (transformation.type) {
        case 'filter':
          result = result.filter(item => this.evaluateCondition(item, transformation.config));
          break;
        case 'map':
          result = result.map(item => this.applyMapping(item, transformation.config));
          break;
        case 'reduce':
          result = result.reduce(
            (acc, item) => this.applyReduction(acc, item, transformation.config),
            transformation.config.initialValue
          );
          break;
        case 'sort':
          result = result.sort((a, b) => this.compareItems(a, b, transformation.config));
          break;
        case 'group':
          result = this.groupItems(result, transformation.config);
          break;
      }
    }

    return result;
  }

  private evaluateCondition(item: unknown, condition: TransformationConfig): boolean {
    if (typeof item !== 'object' || item === null) {
      return false;
    }

    // Support for complex conditions with AND, OR, NOT operators
    if (condition.type === 'AND' && Array.isArray(condition.value)) {
      return condition.value.every((c: TransformationConfig) => this.evaluateCondition(item, c));
    }
    if (condition.type === 'OR' && Array.isArray(condition.value)) {
      return condition.value.some((c: TransformationConfig) => this.evaluateCondition(item, c));
    }
    if (condition.type === 'NOT') {
      return !this.evaluateCondition(item, condition.value as TransformationConfig);
    }

    // Simple condition evaluation
    const { field, operator, value } = condition;
    if (!field || !operator) return false;

    const itemValue = this.getNestedValue(item, field);

    switch (operator) {
      case 'eq': return itemValue === value;
      case 'ne': return itemValue !== value;
      case 'gt': return typeof itemValue === 'number' && typeof value === 'number' && itemValue > value;
      case 'gte': return typeof itemValue === 'number' && typeof value === 'number' && itemValue >= value;
      case 'lt': return typeof itemValue === 'number' && typeof value === 'number' && itemValue < value;
      case 'lte': return typeof itemValue === 'number' && typeof value === 'number' && itemValue <= value;
      case 'contains': return typeof itemValue === 'string' && typeof value === 'string' && itemValue.includes(value);
      case 'startsWith': return typeof itemValue === 'string' && typeof value === 'string' && itemValue.startsWith(value);
      case 'endsWith': return typeof itemValue === 'string' && typeof value === 'string' && itemValue.endsWith(value);
      case 'in': return Array.isArray(value) && value.includes(itemValue);
      default: return false;
    }
  }

  private applyMapping(item: unknown, mapping: TransformationConfig): unknown {
    if (!mapping || typeof item !== 'object' || item === null) {
      return item;
    }

    if (typeof mapping.reducer === 'function') {
      return mapping.reducer(item, mapping);
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(mapping)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        result[key] = this.getNestedValue(item, value.slice(1));
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.applyMapping(item, value as TransformationConfig);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private applyReduction(accumulator: unknown, item: unknown, config: TransformationConfig): unknown {
    if (typeof config.reducer === 'function') {
      return config.reducer(accumulator, item);
    }

    if (!config.type || typeof item !== 'object' || item === null) {
      return accumulator;
    }

    // Built-in reducers
    switch (config.type) {
      case 'sum': {
        const value = config.field ? this.getNestedValue(item, config.field) : item;
        return typeof accumulator === 'number' && typeof value === 'number'
          ? accumulator + value
          : accumulator;
      }
      case 'count':
        return typeof accumulator === 'number' ? accumulator + 1 : 1;
      case 'avg': {
        if (typeof accumulator !== 'object' || accumulator === null) {
          accumulator = { sum: 0, count: 0 };
        }
        const value = config.field ? this.getNestedValue(item, config.field) : item;
        return {
          sum: (accumulator as { sum: number }).sum + (typeof value === 'number' ? value : 0),
          count: (accumulator as { count: number }).count + 1
        };
      }
      case 'concat':
        return Array.isArray(accumulator) ? accumulator.concat([item]) : [item];
      default:
        return accumulator;
    }
  }

  private compareItems(a: unknown, b: unknown, config: TransformationConfig): number {
    if (!config.field) return 0;

    const getValue = (item: unknown): unknown => {
      const value = this.getNestedValue(item, config.field!);
      return config.ignoreCase && typeof value === 'string'
        ? value.toLowerCase()
        : value;
    };

    const aValue = getValue(a);
    const bValue = getValue(b);

    if (aValue === bValue) return 0;
    if (aValue === undefined || aValue === null) return 1;
    if (bValue === undefined || bValue === null) return -1;

    const result = aValue < bValue ? -1 : 1;
    return config.direction === 'desc' ? -result : result;
  }

  private groupItems(items: unknown[], config: TransformationConfig): Record<string, unknown[]> {
    if (!config.field) return { default: items };

    return items.reduce((groups: Record<string, unknown[]>, item) => {
      const key = this.getNestedValue(item, config.field!);
      const groupKey = String(key ?? 'undefined');
      groups[groupKey] = groups[groupKey] || [];
      groups[groupKey].push(item);
      return groups;
    }, {});
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return undefined;
    }

    return path.split('.').reduce((current: unknown, key: string) => {
      return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
    }, obj);
  }

  getCapabilities(): string {
    return [
      'Read and parse files in various formats (JSON, YAML, CSV, TXT)',
      'Write data to files in various formats',
      'Transform data using filters, maps, reducers, sorting, and grouping',
      'Support for complex data transformations with nested operations',
      'Handle large files with configurable size limits',
      'Extensible format support'
    ].join('\n');
  }
}