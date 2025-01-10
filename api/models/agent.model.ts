import { v4 as uuidv4 } from 'uuid';
import { AgentConfig, AgentMetrics } from './types';
import { Agent } from '../../src/core/agent';
import { Tool } from '../../src/core/tool';
import { BaseLanguageModel } from '../../src/core/base-language-model';
import { Memory } from '../../src/core/memory';
import { Task, TaskStatus } from '../../src/core/task';

export class AgentModel {
  private id: string;
  private config: AgentConfig;
  private agent: Agent;
  private metrics: AgentMetrics;
  private lastUpdated: Date;

  constructor(config: AgentConfig) {
    this.id = uuidv4();
    this.config = config;
    this.metrics = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      averageResponseTime: 0,
    };
    this.lastUpdated = new Date();
  }

  async initialize(): Promise<void> {
    // Initialize language model
    const model = await this.initializeLanguageModel();

    // Initialize memory if configured
    const memory = await Memory.create({
      maxShortTermItems: 100,
      maxTokenSize: 4096,
      autoArchive: true,
      archiveThreshold: 0.8,
      indexStrategy: 'semantic',
      metadata: {
        agentId: this.id,
        agentName: this.config.name,
      }
    });

    // Initialize tools
    const tools = await this.initializeTools();

    // Create agent instance
    this.agent = await Agent.create({
      name: this.config.name,
      description: this.config.description,
      languageModel: model,
      tools,
      memoryConfig: {
        maxShortTermItems: 100,
        maxTokenSize: 4096,
        autoArchive: true,
        archiveThreshold: 0.8,
        indexStrategy: 'semantic',
        metadata: {
          agentId: this.id,
          agentName: this.config.name,
        }
      }
    });
  }

  async executeTask(input: string, context?: Record<string, any>): Promise<any> {
    const task: Task = {
      id: uuidv4(),
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
      const result = await this.agent.execute(task);
      this.updateMetrics(result.success, Date.now() - startTime);
      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      throw error;
    }
  }

  getId(): string {
    return this.id;
  }

  getConfig(): AgentConfig {
    return this.config;
  }

  getMetrics(): AgentMetrics {
    return this.metrics;
  }

  getLastUpdated(): Date {
    return this.lastUpdated;
  }

  private async initializeLanguageModel(): Promise<BaseLanguageModel> {
    // Map model name to provider if not specified
    const provider = this.config.provider || (() => {
      if (this.config.model.startsWith('gpt')) return 'openai';
      if (this.config.model.startsWith('claude')) return 'claude';
      if (this.config.model.startsWith('cohere')) return 'cohere';
      if (this.config.model.startsWith('hf-')) return 'huggingface';
      if (this.config.model.startsWith('openrouter')) return 'openrouter';
      return 'langchain';
    })();

    const { createLanguageModel } = await import('../../src/integrations/language-models/index');
    return createLanguageModel(provider, {
      apiKey: this.config.apiKey || process.env[`${provider.toUpperCase()}_API_KEY`] || '',
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      model: this.config.model,
    });
  }

  private async initializeTools(): Promise<Tool[]> {
    const tools: Tool[] = [];
    for (const toolName of this.config.tools) {
      try {
        // Import and initialize each specified tool
        const toolModule = await import(`../../src/core/tools/${toolName}`);
        const tool = new toolModule.default();
        tools.push(tool);
      } catch (error) {
        console.error(`Failed to initialize tool ${toolName}:`, error);
      }
    }
    return tools;
  }

  private updateMetrics(success: boolean, duration: number): void {
    this.metrics.totalTasks++;
    if (success) {
      this.metrics.successfulTasks++;
    } else {
      this.metrics.failedTasks++;
    }

    // Update average response time using rolling average
    const oldTotal = this.metrics.averageResponseTime * (this.metrics.totalTasks - 1);
    this.metrics.averageResponseTime = (oldTotal + duration) / this.metrics.totalTasks;
    this.metrics.lastExecutionTime = new Date().toISOString();
    this.lastUpdated = new Date();
  }
}