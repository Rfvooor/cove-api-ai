import { SchemaDefinition } from './schema.js';

// Core type definitions
export type BasicNodeCategory = 'datetime' | 'text' | 'data' | 'custom';
export type WorkflowNodeCategory = 'processing' | 'control' | 'input' | 'output';
export type NodeCategory = BasicNodeCategory | WorkflowNodeCategory;
export type NodeType = 'basic' | 'task' | 'decision' | 'parallel' | 'merge' | 'subflow';

// Operation interfaces
export interface BaseOperation {
  name: string;
  description: string;
  implementation: string;
  category: BasicNodeCategory | WorkflowNodeCategory;
  inputSchema: SchemaDefinition;
  outputSchema: SchemaDefinition;
}

export interface BasicOperation extends BaseOperation {
  category: BasicNodeCategory;
}

export interface WorkflowOperation extends BaseOperation {
  category: WorkflowNodeCategory;
}

// Node configuration
export interface NodeConfig {
  timeout?: number;
  retryStrategy?: RetryConfig;
  inputSchema?: SchemaDefinition;
  outputSchema?: SchemaDefinition;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay?: number;
  maxDelay?: number;
}

export interface NodeMetadata {
  version: string;
  tags: string[];
  author?: string;
  created: string;
  updated: string;
}

export interface NodeTemplate {
  id: string;
  name: string;
  description: string;
  type: NodeType;
  category: NodeCategory;
  defaultConfig: NodeConfig;
  metadata: NodeMetadata;
  operation: BasicOperation | WorkflowOperation;
}

// Common operation types
export interface DateTimeOperation extends BaseOperation {
  category: 'datetime';
  inputSchema: {
    type: 'object';
    properties: {
      datetime: { type: 'string' };
      format: { type: 'string' };
    };
    required: ['datetime', 'format'];
  };
  outputSchema: {
    type: 'object';
    properties: {
      result: { type: 'string' };
    };
  };
}

export interface TextOperation extends BasicOperation {
  category: 'text';
  inputSchema: {
    type: 'object';
    properties: {
      text: { type: 'string' };
      operation: { type: 'string'; enum: ['uppercase', 'lowercase', 'trim'] };
    };
    required: ['text', 'operation'];
  };
  outputSchema: {
    type: 'object';
    properties: {
      result: { type: 'string' };
    };
  };
}

export interface DataOperation extends BasicOperation {
  category: 'data';
  inputSchema: {
    type: 'object';
    properties: {
      data: { type: 'array'; items: { type: 'string' } };
      operation: { type: 'string'; enum: ['sort', 'reverse', 'unique'] };
    };
    required: ['data', 'operation'];
  };
  outputSchema: {
    type: 'object';
    properties: {
      result: { type: 'array'; items: { type: 'string' } };
    };
  };
}