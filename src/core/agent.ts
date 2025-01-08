import { EventEmitter } from 'events';
import { BaseLanguageModel } from './base-language-model.js';
import { Conversation } from './conversation.js';
import { Tool } from './tool.js';
import { Memory, MemoryConfig, MemoryEntry } from './memory.js';
import { Task, TaskStatus } from './task.js';

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

export interface AgentInterface {
  id: string;
  name: string;
  description: string;
  execute(task: Task): Promise<TaskExecutionResult>;
  plan(task: Task): Promise<string[]>;
  getTools(): Tool[];
  findToolForTask(task: string): Promise<Tool | undefined>;
  getLanguageModel(): BaseLanguageModel;
  conversation: Conversation;
  memory: Memory;
  getConfiguration(): Promise<AgentConfig>;
  initialize(config?: AgentConfig): Promise<void>;
  cleanup(): Promise<void>;
  lastExecutionTime?: number;
}

export interface AgentConfig {
  name?: string;
  systemPrompt?: string;
  languageModel?: BaseLanguageModel;
  maxLoops?: number;
  tools?: Tool[];
  agent_name?: string;
  description?: string;
  memoryConfig?: MemoryConfig;
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

export interface AgentMetrics {
  taskCount: number;
  successRate: number;
  averageExecutionTime: number;
  lastExecutionTime?: number;
  capabilities: AgentCapability[];
}

export interface AgentCapability {
  name: string;
  score: number;
  metadata?: Record<string, any>;
}

export class Agent extends EventEmitter implements AgentInterface {
  private readonly _id: string;
  private _name: string = 'Unnamed Agent';
  private _systemPrompt: string = 'You are a helpful AI assistant';
  private _languageModel!: BaseLanguageModel;
  private _maxLoops: number = 5;
  private _tools: Map<string, Tool>;
  private _conversation!: Conversation;
  private _memory!: Memory;
  private _description: string = 'A general-purpose AI agent';
  private _currentTask?: Task;
  private _isExecuting: boolean = false;
  private _loopCount: number = 0;
  private _taskMemories: Map<string, string[]> = new Map();
  private _lastExecutionTime?: number;
  private _temperature: number = 0.7;
  private _maxTokens: number = 1000;
  private _retryAttempts: number = 3;
  private _retryDelay: number = 1000;
  private _autoSave: boolean = false;
  private _contextLength: number = 4096;
  private _metrics: AgentMetrics;

  // Implement AgentInterface getters
  get id(): string { return this._id; }
  get name(): string { return this._name; }
  get description(): string { return this._description; }
  get conversation(): Conversation { return this._conversation; }
  get memory(): Memory { return this._memory; }
  get lastExecutionTime(): number | undefined { return this._lastExecutionTime; }
  get metrics(): AgentMetrics { return this._metrics; }

  static async create(config: AgentConfig): Promise<Agent> {
    const agent = new Agent();
    await agent.initialize(config);
    return agent;
  }

  private constructor() {
    super();
    this._id = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this._tools = new Map();
    this._taskMemories = new Map();
    this._metrics = {
      taskCount: 0,
      successRate: 1.0,
      averageExecutionTime: 0,
      capabilities: []
    };
  }

  async initialize(config?: AgentConfig): Promise<void> {
    if (!config) return;

    // Basic configuration
    this._name = config.name || config.agent_name || 'Unnamed Agent';
    this._description = config.description || 'A general-purpose AI agent';
    this._systemPrompt = config.systemPrompt || 'You are a helpful AI assistant';
    this._maxLoops = config.maxLoops || 5;
    this._temperature = config.temperature || 0.7;
    this._maxTokens = config.maxTokens || 1000;
    this._retryAttempts = config.retryAttempts || 3;
    this._retryDelay = config.retryDelay || 1000;
    this._autoSave = config.autoSave || false;
    this._contextLength = config.contextLength || 4096;

    // Initialize conversation
    this._conversation = new Conversation(this._systemPrompt);

    // Initialize memory system
    this._memory = await Memory.create({
      ...config.memoryConfig,
      maxShortTermItems: config.memoryConfig?.maxShortTermItems || 100,
      maxTokenSize: config.memoryConfig?.maxTokenSize || 4096,
      autoArchive: config.memoryConfig?.autoArchive ?? true,
      archiveThreshold: config.memoryConfig?.archiveThreshold || 0.8,
      indexStrategy: 'semantic',
      metadata: {
        agentId: this._id,
        agentName: this._name,
        ...config.memoryConfig?.metadata
      }
    });

    // Initialize tools
    if (config.tools) {
      config.tools.forEach(tool => this.addTool(tool));
    }

    // Initialize language model
    if (config.languageModel) {
      this._languageModel = config.languageModel;
    } else {
      this._languageModel = await this.createLanguageModel(config.languageModelConfig);
    }

    // Initialize capabilities
    this._metrics.capabilities = this.inferCapabilities();
  }

  private inferCapabilities(): AgentCapability[] {
    return Array.from(this._tools.values()).map(tool => ({
      name: tool.name,
      score: 1.0,
      metadata: {
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema
      }
    }));
  }

  async createLanguageModel(config?: AgentConfig['languageModelConfig']): Promise<BaseLanguageModel> {
    try {
      const {
        apiKey = process.env.OPENAI_API_KEY || '',
        model = 'gpt-3.5-turbo',
        temperature = this._temperature,
        maxTokens = this._maxTokens,
        provider = 'openai'
      } = config || {};

      let ModelClass;
      switch (provider) {
        case 'claude':
          const { ClaudeIntegration } = await import('../integrations/language-models/claude.js');
          ModelClass = ClaudeIntegration;
          break;
        case 'langchain':
          const { LangchainIntegration } = await import('../integrations/language-models/langchain.js');
          ModelClass = LangchainIntegration;
          break;
        case 'openai':
        default:
          const { OpenAIIntegration } = await import('../integrations/language-models/openai.js');
          ModelClass = OpenAIIntegration;
      }

      return new ModelClass({ 
        apiKey, 
        model, 
        temperature, 
        maxTokens 
      });
    } catch (error) {
      console.error('Error creating language model:', error);
      throw new Error('Failed to initialize language model');
    }
  }

  getLanguageModel(): BaseLanguageModel {
    return this._languageModel;
  }

  getTools(): Tool[] {
    return Array.from(this._tools.values());
  }
  

  addTool(tool: Tool): void {
    this._tools.set(tool.name, tool);
    this.remember(`Added tool: ${tool.name}`, 'system', {
      type: 'tool_management',
      toolName: tool.name
    });
  }

  private async remember(
    content: string, 
    type: MemoryEntry['type'] = 'message', 
    metadata?: Record<string, any>
  ): Promise<string> {
    return await this._memory.add({
      content,
      type,
      metadata: {
        ...metadata,
        agentId: this._id,
        timestamp: new Date().toISOString()
      }
    });
  }

  async execute(task: Task): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this._isExecuting = true;
    this._currentTask = task;
    this._loopCount = 0;

    try {
      // Track task start in memory
      const taskMemoryId = await this.remember(`Starting task: ${task.name}`, 'task', {
        taskId: task.id,
        status: TaskStatus.RUNNING
      });

      // Create and execute task plan
      const steps = await this.plan(task);
      const toolsUsed: string[] = [];
      let currentOutput: any = null;
      let completionTokens = 0;
      let promptTokens = 0;

      for (const step of steps) {
        if (this._loopCount >= this._maxLoops) {
          // Log early return due to max steps
          const maxStepsMemoryId = await this.remember(
            `Task stopped early: Maximum steps (${this._maxLoops}) reached`, 
            'system',
            {
              taskId: task.id,
              maxSteps: this._maxLoops,
              completedSteps: this._loopCount,
              status: TaskStatus.COMPLETED
            }
          );

          this._lastExecutionTime = Date.now() - startTime;
          this.updateMetrics(true, this._lastExecutionTime);

          return {
            success: true,
            output: currentOutput,
            toolsUsed,
            completionTokens,
            promptTokens,
            memoryIds: [taskMemoryId, maxStepsMemoryId],
            lastExecutionTime: this._lastExecutionTime,
            stoppedEarly: true
          };
        }

        const tool = await this.findToolForTask(step);
        if (tool) {
          currentOutput = await tool.execute({ step, context: currentOutput });
          toolsUsed.push(tool.name);

          await this.remember(`Step completed: ${step}`, 'task', {
            taskId: task.id,
            step,
            toolUsed: tool.name,
            output: currentOutput,
            status: 'in_progress'
          });
        }

        this._loopCount++;
      }

      const finalMemoryId = await this.remember(`Task completed: ${task.name}`, 'result', {
        taskId: task.id,
        output: currentOutput,
        status: TaskStatus.COMPLETED
      });

      this._lastExecutionTime = Date.now() - startTime;
      this.updateMetrics(true, this._lastExecutionTime);

      return {
        success: true,
        output: currentOutput,
        toolsUsed,
        completionTokens,
        promptTokens,
        memoryIds: [taskMemoryId, finalMemoryId],
        lastExecutionTime: this._lastExecutionTime
      };
    } catch (error) {
      const errorMemoryId = await this.remember(`Task failed: ${error instanceof Error ? error.message : String(error)}`, 'error', {
        taskId: task.id,
        error: error instanceof Error ? error.toString() : String(error),
        status: TaskStatus.FAILED
      });

      this._lastExecutionTime = Date.now() - startTime;
      this.updateMetrics(false, this._lastExecutionTime);

      return {
        success: false,
        output: null,
        error: error instanceof Error ? error : new Error(String(error)),
        toolsUsed: [],
        completionTokens: 0,
        promptTokens: 0,
        memoryIds: [errorMemoryId],
        lastExecutionTime: this._lastExecutionTime
      };
    } finally {
      this._isExecuting = false;
      this._currentTask = undefined;
      if (this._autoSave) {
        await this.save();
      }
    }
  }

  private updateMetrics(success: boolean, executionTime: number): void {
    const weight = 0.1; // Weight for exponential moving average
    this._metrics.taskCount++;
    this._metrics.successRate = this._metrics.successRate * (1 - weight) + (success ? 1 : 0) * weight;
    this._metrics.averageExecutionTime = this._metrics.averageExecutionTime * (1 - weight) + executionTime * weight;
    this._metrics.lastExecutionTime = executionTime;
  }

  async plan(task: Task): Promise<string[]> {
    const prompt = `
Task: ${task.name}
Description: ${task.description || 'No description provided'}
Available Tools: ${Array.from(this._tools.keys()).join(', ')}

Create a step-by-step plan to accomplish this task.
Each step should be clear and actionable.
Consider the available tools and their capabilities.
`;

    try {
      const response = await this._languageModel.generateText(prompt);
      const steps = response
        .split('\n')
        .map(step => step.trim())
        .filter(step => step.length > 0);
      
      return steps;
    } catch (error) {
      console.error('Error generating task plan:', error);
      return [`Execute task: ${task.name}`];
    }
  }

  async findToolForTask(step: string): Promise<Tool | undefined> {
    const prompt = `
Step: ${step}
Available Tools: ${Array.from(this._tools.entries()).map(([name, tool]) =>
  `${name} - ${tool.description}`
).join('\n')}

Which tool would be most appropriate for this step? Respond with just the tool name.
`;

    try {
      const toolName = await this._languageModel.generateText(prompt);
      return this._tools.get(toolName.trim());
    } catch (error) {
      console.error('Error selecting tool:', error);
      return Array.from(this._tools.values())[0];
    }
  }

  async getConfiguration(): Promise<AgentConfig> {
    return {
      name: this._name,
      description: this._description,
      systemPrompt: this._systemPrompt,
      maxLoops: this._maxLoops,
      tools: Array.from(this._tools.values()),
      languageModel: this._languageModel,
      temperature: this._temperature,
      maxTokens: this._maxTokens,
      retryAttempts: this._retryAttempts,
      retryDelay: this._retryDelay,
      autoSave: this._autoSave,
      contextLength: this._contextLength
    };
  }

  async save(): Promise<void> {
    await this._memory.persist();
  }

  async currentTask(): Promise<Task | undefined> {
    if (this._isExecuting) {
      return this._currentTask;
    }
    return undefined;
  }

  async cleanup(): Promise<void> {
    if (this._autoSave) {
      await this.save();
    }
    await this._memory.clear();
    this._tools.clear();
    this._taskMemories.clear();
    this._conversation.clear();
  }
}