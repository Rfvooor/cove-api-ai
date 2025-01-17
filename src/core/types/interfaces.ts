import { Task } from '../task.js';
import { Tool } from '../tool.js';
import { Memory } from '../memory.js';
import { BaseLanguageModel } from '../base-language-model.js';

export interface TaskExecutionResult {
  success: boolean;
  output: any;
  error?: Error;
  toolsUsed: string[];
  completionTokens: number;
  promptTokens: number;
  memoryIds?: string[];
  lastExecutionTime?: number;
  type?: string;
  stoppedEarly?: boolean;
}

export interface ConversationResult {
  response: string;
  memoryId: string;
  completionTokens: number;
  promptTokens: number;
  lastExecutionTime: number;
  toolsUsed?: string[];
  toolOutputs?: Record<string, any>;
}

export interface AgentConfig {
  name?: string;
  systemPrompt?: string;
  languageModel?: BaseLanguageModel;
  maxLoops?: number;
  tools?: any[];
  description?: string;
  memoryConfig?: any;
  temperature?: number;
  maxTokens?: number;
  retryAttempts?: number;
  retryDelay?: number;
  autoSave?: boolean;
  contextLength?: number;
  languageModelConfig?: {
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    provider?: 'openai' | 'claude' | 'langchain' | 'openrouter' | 'cohere' | 'huggingface';
  };
}

export interface AgentInterface {
  id: string;
  name: string;
  description: string;
  converse(input: any): Promise<ConversationResult>;
  execute(task: Task): Promise<TaskExecutionResult>;
  plan(task: Task): Promise<string[]>;
  getTools(): Tool[];
  findToolForTask(task: string): Promise<Tool | undefined>;
  getLanguageModel(): BaseLanguageModel;
  memory: Memory;
  getConfiguration(): Promise<AgentConfig>;
  initialize(config?: AgentConfig): Promise<void>;
  cleanup(): Promise<void>;
  lastExecutionTime?: number;
}