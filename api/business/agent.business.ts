import { Agent as AgentModel, AgentModel as AgentInstance, AgentAttributes } from '../models/sequelize/agent.model.js';
import { Agent as CoreAgent } from '../../src/core/agent.js';
import { AgentConfig, AgentMetrics } from '../models/types.js';
import { Tool } from '../../src/core/tool.js';
import { BaseLanguageModel } from '../../src/core/base-language-model.js';
import { Memory } from '../../src/core/memory.js';
import { Task, TaskStatus } from '../../src/core/task.js';

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

export class AgentBusiness {
  private model: typeof AgentModel;
  private coreAgent?: CoreAgent;

  constructor() {
    this.model = AgentModel;
  }

  async create(config: AgentConfig): Promise<AgentInstance> {
    // Create database record
    const agent = await this.model.create({
      name: config.name,
      description: config.description,
      config: config,
    });

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

    const { rows, count } = await this.model.findAndCountAll({
      limit,
      offset,
      order,
    });

    return {
      items: rows,
      total: count,
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

    const task: Task = {
      id: agent.id,
      name: input,
      status: TaskStatus.PENDING,
      input: {
        prompt: input,
        metadata: context
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const startTime = Date.now();
    try {
      const result = await this.coreAgent!.execute(task);
      await this.updateMetrics(agent, true, Date.now() - startTime);
      return result;
    } catch (error) {
      await this.updateMetrics(agent, false, Date.now() - startTime);
      throw error;
    }
  }

  private async initializeCoreAgent(agent: AgentInstance): Promise<void> {
    // Initialize language model
    const model = await this.initializeLanguageModel(agent.config);

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
      languageModel: model,
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

  private async updateMetrics(agent: AgentInstance, success: boolean, duration: number): Promise<void> {
    const oldMetrics = agent.metrics;
    const totalTasks = oldMetrics.totalTasks + 1;
    const successfulTasks = success ? oldMetrics.successfulTasks + 1 : oldMetrics.successfulTasks;
    const failedTasks = success ? oldMetrics.failedTasks : oldMetrics.failedTasks + 1;
    
    // Calculate new average response time
    const oldTotal = oldMetrics.averageResponseTime * (totalTasks - 1);
    const averageResponseTime = (oldTotal + duration) / totalTasks;

    const newMetrics: AgentMetrics = {
      totalTasks,
      successfulTasks,
      failedTasks,
      averageResponseTime,
      lastExecutionTime: new Date().toISOString()
    };

    await agent.update({ metrics: newMetrics } as Partial<AgentAttributes>);
  }
}