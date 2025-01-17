import { Agent as AgentModel, AgentModel as AgentInstance, AgentAttributes } from '../models/sequelize/agent.model.js';
import { Agent as CoreAgent } from '../../src/core/agent.js';
import { AgentConfig, AgentMetrics } from '../models/types.js';
import { Tool } from '../../src/core/tool.js';
import { BaseLanguageModel, GenerateTextResult } from '../../src/core/base-language-model.js';
import { Memory } from '../../src/core/memory.js';
import { Task, TaskConfig, TaskStatus } from '../../src/core/task.js';

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  order?: [string, 'ASC' | 'DESC'][];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ExtendedAgentMetrics extends AgentMetrics {
  tokenUsage: {
    total: number;
    prompt: number;
    completion: number;
  };
  costs: {
    total: number;
    average: number;
  };
  modelMetrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    errorRates: Record<string, number>;
  };
}

export class AgentBusiness {
  private model: typeof AgentModel;
  private coreAgent?: CoreAgent;
  private languageModel?: BaseLanguageModel;

  constructor() {
    this.model = AgentModel;
  }

  async create(config: AgentConfig): Promise<AgentInstance> {
    // Create database record
    const agent = await this.model.create({
      name: config.name,
      description: config.description,
      config: config,
      metrics: this.initializeMetrics(),
      status: 'idle'
    } as AgentAttributes);

    // Initialize core agent
    await this.initializeCoreAgent(agent);

    return agent;
  }

  async findById(id: string): Promise<AgentInstance> {
    const agent = await this.model.findByPk(id);
    if (!agent) {
      throw new Error('Agent not found');
    }
    return agent;
  }

  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<AgentInstance>> {
    const {
      limit = 10,
      offset = 0,
      order = [['createdAt', 'DESC']]
    } = options;

    const result = await this.model.findAndCountAll({
      limit,
      offset,
      order,
    });

    return {
      items: result.rows as AgentInstance[],
      total: result.count,
      limit,
      offset,
    };
  }

  async update(id: string, updates: Partial<AgentConfig>): Promise<AgentInstance> {
    const agent = await this.findById(id);
    
    // Update config
    const updatedConfig = { ...agent.config, ...updates };
    await agent.update({ config: updatedConfig } as Partial<AgentAttributes>);

    // Reinitialize core agent with new config
    await this.initializeCoreAgent(agent);

    return agent;
  }

  async delete(id: string): Promise<void> {
    const agent = await this.findById(id);
    await agent.destroy();
  }

  async executeTask(id: string, input: string, context?: Record<string, any>): Promise<any> {
    const agent = await this.findById(id);
    
    // Initialize core agent if not already initialized
    if (!this.coreAgent) {
      await this.initializeCoreAgent(agent);
    }

    const taskConfig: TaskConfig = {
      type: 'agent',
      executorId: agent.id,
      input: {
        name: `Task for ${agent.name}`,
        description: `Execute task: ${input}`,
        prompt: input,
        metadata: context
      },
      context,
      timeout: agent.config.timeout || 30000,
      retryConfig: {
        maxAttempts: agent.config.retryAttempts || 3,
        backoffMultiplier: 1.5,
        initialDelay: 1000,
        maxDelay: 30000
      }
    };

    const task = new Task(taskConfig);

    const startTime = Date.now();
    try {
      // Set executor
      task.setExecutor(this.coreAgent!);

      // Execute task
      const result = await task.execute();
      
      // Update metrics with language model results if available
      if (this.languageModel?.getMetrics) {
        const modelMetrics = this.languageModel.getMetrics();
        await this.updateMetrics(agent, {
          success: result.status === TaskStatus.COMPLETED,
          duration: Date.now() - startTime,
          modelMetrics,
          result
        });
      } else {
        await this.updateMetrics(agent, {
          success: result.status === TaskStatus.COMPLETED,
          duration: Date.now() - startTime,
          result
        });
      }

      return result;
    } catch (error) {
      await this.updateMetrics(agent, {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }

  private async initializeCoreAgent(agent: AgentInstance): Promise<void> {
    // Initialize language model
    this.languageModel = await this.initializeLanguageModel(agent.config);

    // Initialize memory if configured
    const memory = await Memory.create({
      maxShortTermItems: 100,
      maxTokenSize: 4096,
      autoArchive: true,
      archiveThreshold: 0.8,
      indexStrategy: 'semantic',
      metadata: {
        agentId: agent.id,
        agentName: agent.config.name,
      }
    });

    // Initialize tools
    const tools = await this.initializeTools(agent.config);

    // Create core agent instance
    this.coreAgent = await CoreAgent.create({
      name: agent.config.name,
      description: agent.config.description,
      languageModel: this.languageModel,
      tools,
      memoryConfig: {
        maxShortTermItems: 100,
        maxTokenSize: 4096,
        autoArchive: true,
        archiveThreshold: 0.8,
        indexStrategy: 'semantic',
        metadata: {
          agentId: agent.id,
          agentName: agent.config.name,
        }
      }
    });
  }

  private async initializeLanguageModel(config: AgentConfig): Promise<BaseLanguageModel> {
    // Map model name to provider if not specified
    const provider = config.provider || (() => {
      if (config.model.startsWith('gpt')) return 'openai';
      if (config.model.startsWith('claude')) return 'claude';
      if (config.model.startsWith('cohere')) return 'cohere';
      if (config.model.startsWith('hf-')) return 'huggingface';
      if (config.model.startsWith('openrouter')) return 'openrouter';
      return 'langchain';
    })();

    const { createLanguageModel } = await import('../../src/integrations/language-models/index.js');
    return createLanguageModel(provider, {
      apiKey: config.apiKey || process.env[`${provider.toUpperCase()}_API_KEY`] || '',
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      model: config.model,
    });
  }

  private async initializeTools(config: AgentConfig): Promise<Tool[]> {
    const tools: Tool[] = [];
    for (const toolName of config.tools) {
      try {
        // Import and initialize each specified tool
        const toolModule = await import(`../../src/core/tools/${toolName}.js`);
        const tool = new toolModule.default();
        tools.push(tool);
      } catch (error) {
        console.error(`Failed to initialize tool ${toolName}:`, error);
      }
    }
    return tools;
  }

  private initializeMetrics(): ExtendedAgentMetrics {
    return {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      averageResponseTime: 0,
      lastExecutionTime: new Date().toISOString(),
      tokenUsage: {
        total: 0,
        prompt: 0,
        completion: 0
      },
      costs: {
        total: 0,
        average: 0
      },
      modelMetrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
        errorRates: {}
      }
    };
  }

  private async updateMetrics(
    agent: AgentInstance,
    data: {
      success: boolean;
      duration: number;
      modelMetrics?: {
        totalRequests: number;
        successfulRequests: number;
        failedRequests: number;
        averageLatency: number;
        errorRates: Record<string, number>;
      };
      result?: any;
      error?: Error;
    }
  ): Promise<void> {
    const metrics = agent.metrics as ExtendedAgentMetrics;
    const weight = 0.1; // Weight for exponential moving average

    // Update basic metrics
    metrics.totalTasks++;
    if (data.success) {
      metrics.successfulTasks++;
    } else {
      metrics.failedTasks++;
    }

    // Update response time
    metrics.averageResponseTime = 
      (1 - weight) * metrics.averageResponseTime + weight * data.duration;
    metrics.lastExecutionTime = new Date().toISOString();

    // Update token usage and costs if result contains that information
    if (data.result?.metrics) {
      const { tokens, cost } = data.result.metrics;
      if (tokens) {
        metrics.tokenUsage.prompt += tokens.prompt || 0;
        metrics.tokenUsage.completion += tokens.completion || 0;
        metrics.tokenUsage.total += tokens.total || 0;
      }
      if (cost) {
        metrics.costs.total += cost;
        metrics.costs.average = metrics.costs.total / metrics.totalTasks;
      }
    }

    // Update model metrics if available
    if (data.modelMetrics) {
      metrics.modelMetrics = {
        ...metrics.modelMetrics,
        ...data.modelMetrics
      };
    }

    // Update error rates if there was an error
    if (data.error) {
      const errorType = data.error.constructor.name;
      metrics.modelMetrics.errorRates[errorType] = 
        (metrics.modelMetrics.errorRates[errorType] || 0) + 1;
    }

    await agent.update({ metrics } as Partial<AgentAttributes>);
  }
}