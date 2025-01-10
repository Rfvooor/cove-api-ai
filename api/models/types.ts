import { z } from 'zod';

// Base schemas for validation
export const agentConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  model: z.string(),
  apiKey: z.string().optional(),
  temperature: z.number().min(0).max(1).default(0.7),
  maxTokens: z.number().positive().default(2048),
  tools: z.array(z.string()).default([]),
  memory: z.object({
    type: z.enum(['none', 'buffer', 'summary', 'vector']),
    config: z.record(z.any()).optional(),
  }).default({ type: 'none' }),
  provider: z.enum(['openai', 'claude', 'langchain', 'openrouter', 'cohere', 'huggingface']).optional(),
});

export const swarmConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  agents: z.array(z.string()),
  topology: z.enum(['sequential', 'parallel', 'hierarchical', 'mesh']),
  routingStrategy: z.enum(['roundRobin', 'leastBusy', 'weighted', 'custom']).default('roundRobin'),
  maxConcurrency: z.number().positive().default(5),
  timeout: z.number().positive().default(30000),
});

// Response types
export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type SwarmConfig = z.infer<typeof swarmConfigSchema>;

// API request/response types
export interface CreateAgentRequest {
  config: AgentConfig;
}

export interface CreateSwarmRequest {
  config: SwarmConfig;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// Task execution types
export interface TaskExecutionRequest {
  input: string;
  context?: Record<string, any>;
  options?: {
    timeout?: number;
    maxRetries?: number;
    callbackUrl?: string;
  };
}

export interface TaskExecutionResponse {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startTime: string;
  endTime?: string;
}

// Monitoring and metrics types
export interface AgentMetrics {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  averageResponseTime: number;
  lastExecutionTime?: string;
}

export interface SwarmMetrics extends AgentMetrics {
  activeAgents: number;
  totalAgents: number;
  taskDistribution: Record<string, number>;
}