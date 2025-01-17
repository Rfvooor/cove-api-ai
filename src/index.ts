/**
 * @file Main entry point for the Cove API AI framework
 * @description Exports core functionality, integrations, and types for building AI agents and swarms
 */

// Core imports
import { Agent, AgentInterface, type AgentConfig } from './core/agent.js';
import { Task, type TaskConfig, type TaskStatus, type TaskResult } from './core/task.js';
import { Memory, type MemoryConfig, type MemoryEntry, type MemorySearchResult } from './core/memory.js';
import { Tool, type ToolConfig, type ToolSchemaType } from './core/tool.js';
import { SwarmRouter, type SwarmRouterConfig } from './core/swarm-router.js';

// Language model integrations
import { OpenRouterIntegration, type OpenRouterConfig } from './integrations/language-models/openrouter.js';
import { ClaudeIntegration, type ClaudeConfig } from './integrations/language-models/claude.js';
import { LangchainIntegration, type LangchainConfig } from './integrations/language-models/langchain.js';
import { CohereIntegration, type CohereConfig } from './integrations/language-models/cohere.js';
import { HuggingFaceIntegration, type HuggingFaceConfig } from './integrations/language-models/huggingface.js';

// Core functionality exports
export {
  Agent,
  type AgentInterface,
  type AgentConfig
} from './core/agent.js';

// Tools exports
export {
  SolanaTokenTool,
  type TokenStats,
  type TokenStatsResponse,
  type TokenStatsOptions,
  type SolanaTokenToolConfig,
} from './core/tools/solana-token-tool.js';

export {
  SolanaTokenResolver,
  type TokenResolverResponse,
  type TokenResolverConfig,
} from './core/tools/solana-token-resolver.js';

// Blockchain tools exports
export {
  BirdeyeTool,
  type BirdeyeToolConfig,
  type BirdeyeToolInput,
  type BirdeyeTokenData,
  type BirdeyeResponse,
  type ChainType,
  CoinGeckoTool,
  type CoinGeckoToolConfig,
  type CoinGeckoToolInput,
  type CoinGeckoTokenData,
  type CoinGeckoMarketData,
  type CoinGeckoResponse,
  type VsCurrency
} from './core/tools/blockchain/index.js';

// Dexscreener tools
export {
  DexScreenerTool,
} from './core/tools/dexscreener-tool.js';

// Twitter tools
export {
  TwitterSearchTool,
  type TwitterSearchConfig,
} from './core/tools/twitter-search-tool.js';

// Task exports
export {
  Task,
  type TaskConfig,
  type TaskStatus,
  type TaskResult
} from './core/task.js';

export {
  Memory,
  type MemoryConfig,
  type MemoryEntry,
  type MemorySearchResult
} from './core/memory.js';

export {
  Tool,
  type ToolConfig,
  type ToolSchemaType
} from './core/tool.js';

export {
  SwarmRouter,
  type SwarmRouterConfig
} from './core/swarm-router.js';

// Language model integrations
export {
  OpenRouterIntegration,
  type OpenRouterConfig
} from './integrations/language-models/openrouter.js';

export {
  ClaudeIntegration,
  type ClaudeConfig
} from './integrations/language-models/claude.js';

export {
  LangchainIntegration,
  type LangchainConfig
} from './integrations/language-models/langchain.js';

export {
  CohereIntegration,
  type CohereConfig
} from './integrations/language-models/cohere.js';

export {
  HuggingFaceIntegration,
  type HuggingFaceConfig
} from './integrations/language-models/huggingface.js';

// Types
export interface SwarmConfig {
  enabled: boolean;
  minAgents?: number;
  maxAgents?: number;
  scaleUpThreshold?: number;
  scaleDownThreshold?: number;
  loadBalancingStrategy?: 'round-robin' | 'least-loaded' | 'capability-based';
  taskSequencing?: 'sequential' | 'parallel' | 'hybrid';
  taskBuilderEnabled?: boolean;
  taskValidation?: boolean;
  maxConcurrentTasks?: number;
  taskTimeout?: number;
  retryStrategy?: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
}

export interface AgentCapability {
  name: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface AgentMetrics {
  taskCount: number;
  successRate: number;
  averageExecutionTime: number;
  lastExecutionTime?: number;
  capabilities: AgentCapability[];
}

export interface TaskExecutionConfig {
  type: 'agent' | 'swarm';
  executorId: string;
  input: any;
  context?: Record<string, any>;
  attachments?: Array<{
    name: string;
    content: string;
    type: string;
  }>;
  timeout?: number;
  priority?: 'low' | 'medium' | 'high';
  retryConfig?: {
    maxAttempts: number;
    backoffMultiplier: number;
  };
}

// Version
export const version = '1.0.0';

// Default configurations
export const defaultConfigs = {
  agent: {
    maxLoops: 1,
    temperature: 0.7,
    maxTokens: 1000,
    retryAttempts: 3,
    retryDelay: 1000,
    autoSave: false,
    contextLength: 4096
  },
  memory: {
    maxShortTermItems: 100,
    maxTokenSize: 4096,
    autoArchive: true,
    archiveThreshold: 0.8,
    indexStrategy: 'semantic' as const,
    compressionEnabled: false,
    deduplicationEnabled: true
  },
  openrouter: {
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1000,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000
  },
  task: {
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    priority: 'medium' as const,
    validation: true,
    maxConcurrent: 5
  }
};

/**
 * Factory functions for creating framework components
 */

/**
 * Creates a new Agent instance with the specified configuration
 * @param config - Agent configuration options
 * @returns Promise resolving to the created Agent
 * @throws {Error} If required configuration is missing or invalid
 */
export async function createAgent(
  config: Partial<AgentConfig> & {
    name: string;
    systemPrompt: string;
  }
): Promise<Agent> {
  if (!config.name || !config.systemPrompt) {
    throw new Error('Agent name and system prompt are required');
  }

  try {
    return await Agent.create({
      ...defaultConfigs.agent,
      ...config
    });
  } catch (error) {
    throw new Error(`Failed to create agent: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates a new OpenRouter integration instance
 * @param config - OpenRouter configuration options
 * @returns New OpenRouterIntegration instance
 * @throws {Error} If required configuration is missing or invalid
 */
export function createOpenrouterIntegration(
  config: Partial<OpenRouterConfig> & {
    apiKey: string;
    model?: string;
    temperature?: number;
  }
): OpenRouterIntegration {
  if (!config.apiKey) {
    throw new Error('OpenRouter API key is required');
  }

  try {
    return new OpenRouterIntegration({
      ...defaultConfigs.openrouter,
      ...config
    });
  } catch (error) {
    throw new Error(`Failed to create OpenRouter integration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates a new task execution instance
 * @param config - Task execution configuration
 * @returns Promise resolving to the task result
 * @throws {Error} If required configuration is missing or invalid
 */
export async function executeTask(config: TaskExecutionConfig): Promise<TaskResult> {
  if (!config.executorId || !config.type) {
    throw new Error('Executor ID and type are required');
  }

  try {
    const task = new Task({
      ...defaultConfigs.task,
      ...config
    });

    return await task.execute();
  } catch (error) {
    throw new Error(`Failed to execute task: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates a new swarm instance with the specified configuration
 * @param config - Swarm configuration options
 * @returns Promise resolving to the created SwarmRouter
 * @throws {Error} If required configuration is missing or invalid
 */
export async function createSwarm(
  config: Partial<SwarmConfig> & {
    name: string;
    agents: AgentInterface[];
  }
): Promise<SwarmRouter> {
  if (!config.name || !config.agents?.length) {
    throw new Error('Swarm name and at least one agent are required');
  }

  try {
    return new SwarmRouter({
      enabled: true,
      taskSequencing: 'sequential',
      taskBuilderEnabled: true,
      taskValidation: true,
      maxConcurrentTasks: 5,
      taskTimeout: 30000,
      retryStrategy: {
        maxAttempts: 3,
        backoffMultiplier: 1.5,
        initialDelay: 1000
      },
      ...config
    });
  } catch (error) {
    throw new Error(`Failed to create swarm: ${error instanceof Error ? error.message : String(error)}`);
  }
}