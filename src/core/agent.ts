import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { BaseLanguageModel, PromptInput, GenerateTextResult } from './base-language-model.js';
import { Tool } from './tool.js';
import { Memory, MemoryConfig, MemoryEntry } from './memory.js';
import { Task, TaskStatus, TaskConfig, TaskInput } from './task.js';
import { ImageHandler } from '../utils/image-handler.js';
import { Conversation } from './conversation.js';
import { AgentPlanner } from './agent-planner.js';
import { AgentMetricsTracker } from './agent-metrics.js';
import { AgentMemoryManager } from './agent-memory.js';
import { ConversationManager } from './agent-conversation.js';
import { SchemaProperty, SchemaPropertyType, BasicSchemaType } from './types/schema.js';

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
  type?: 'plan' | 'plan_pending' | 'execution';
  metadata?: {
    type?: string;
    planSteps?: number;
    status?: string;
    [key: string]: any;
  };
}

export interface AgentInterface {
  id: string;
  name: string;
  description: string;
  converse(input: TaskInput): Promise<ConversationResult>;
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

export interface AgentConfig {
  name?: string;
  systemPrompt?: string;
  languageModel?: BaseLanguageModel;
  maxLoops?: number;
  tools?: any[];
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
  private _memory!: Memory;
  private _description: string = 'A general-purpose AI agent';
  private _currentTask?: Task;
  private _isExecuting: boolean = false;
  private _loopCount: number = 0;
  private _taskMemories: Map<string, string[]> = new Map();
  private _conversations: Map<string, Conversation> = new Map();
  private _lastExecutionTime?: number;
  private _temperature: number = 0.7;
  private _maxTokens: number = 1000;
  private _retryAttempts: number = 3;
  private _retryDelay: number = 1000;
  private _autoSave: boolean = false;
  private _contextLength: number = 4096;
  private _metrics: AgentMetrics;
  private _imageHandler: ImageHandler;
  private _planner!: AgentPlanner;

  // Implement AgentInterface getters
  get id(): string { return this._id; }
  get name(): string { return this._name; }
  get description(): string { return this._description; }
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
    this._imageHandler = new ImageHandler();
  }

  async initialize(config?: AgentConfig): Promise<void> {
    if (!config) return;

    // Basic configuration
    this._name = config.name || 'Unnamed Agent';
    this._description = config.description || 'A general-purpose AI agent';
    const newSystemPrompt = config.systemPrompt || 'You are a helpful AI assistant';
    if (newSystemPrompt !== this._systemPrompt) {
      this._systemPrompt = newSystemPrompt;
      this.updateConversationSystemPrompts();
    }
    this._maxLoops = config.maxLoops || 5;
    this._temperature = config.temperature || 0.7;
    this._maxTokens = config.maxTokens || 1000;
    this._retryAttempts = config.retryAttempts || 3;
    this._retryDelay = config.retryDelay || 1000;
    this._autoSave = config.autoSave || false;
    this._contextLength = config.contextLength || 4096;

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

  async converse(input: TaskInput): Promise<ConversationResult> {
    const startTime = Date.now();
    this._loopCount = 0;
    let currentResponse = '';
    let completionTokens = 0;
    let promptTokens = 0;
    const toolsUsed: string[] = [];
    const toolOutputs: Record<string, any> = {};

    // Get or create conversation for this chat
    const conversation = this.getOrCreateConversation(input.metadata?.chatId);

    try {
      // Process input with images if present
      const processedInput = await this.processPromptWithImages(input);

      // Add user message to conversation
      conversation.add({
        role: 'user',
        content: input.prompt,
        timestamp: Date.now(),
        metadata: {
          tokens: input.prompt.length,
          ...Object.entries(input.metadata || {})
            .filter(([key]) => ['model', 'cost', 'tokens'].includes(key))
            .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
        }
      });

      // Generate plan
      const task = new Task({
        type: 'agent',
        executorId: this.id,
        input: {
          name: 'Plan Generation',
          description: 'Generate execution plan',
          prompt: input.prompt,
          metadata: input.metadata
        }
      });

      const plan = await this.plan(task);
      if (plan.length === 0) {
        throw new Error('Failed to generate execution plan');
      }

      // Handle plan visibility and confirmation
      if (input.metadata?.showPlan) {
        const planMessage = `Here's my plan:\n\n${plan.map((step, i) => `${i + 1}. ${step}`).join('\n')}`;
        
        // Add plan to conversation
        conversation.add({
          role: 'assistant',
          content: planMessage,
          timestamp: Date.now(),
          metadata: {
            type: 'plan',
            planSteps: plan.length
          }
        });

        // Store plan in memory
        const planMemoryId = await this.remember(planMessage, 'system', {
          type: 'execution_plan',
          taskId: task.id,
          plan
        });

        // Return early if this is just a plan request
        if (input.metadata?.planOnly) {
          return {
            response: planMessage,
            memoryId: planMemoryId,
            completionTokens: 0,
            promptTokens: 0,
            lastExecutionTime: Date.now() - startTime,
            type: 'plan'
          };
        }

        // Wait for confirmation if required
        if (input.metadata?.requirePlanConfirmation) {
          await this.remember('Waiting for plan confirmation', 'system', {
            type: 'plan_confirmation',
            taskId: task.id,
            status: 'pending'
          });

          return {
            response: `${planMessage}\n\nPlease confirm if you want to proceed with this plan.`,
            memoryId: planMemoryId,
            completionTokens: 0,
            promptTokens: 0,
            lastExecutionTime: Date.now() - startTime,
            type: 'plan_pending'
          };
        }
      }

      // Execute plan step by step
      for (const step of plan) {
        if (this._loopCount >= this._maxLoops) {
          currentResponse += `\n\nReached maximum number of steps (${this._maxLoops}). Stopping execution.`;
          break;
        }

        // Get conversation history
        const history = conversation.getHistory({ maxMessages: 5 });
        const toolContext = this.getTools()
          .map(tool => `${tool.name}: ${tool.description}`)
          .join('\n');

        const enhancedInput = {
          ...processedInput,
          text: `
Current Step (${this._loopCount + 1}/${plan.length}): ${step}

Available Tools:
${toolContext}

Conversation History:
${typeof history === 'string' ? history : history.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}
Assistant: Let me execute this step carefully.`
        };

        // Generate response for current step
        const response = await this._languageModel.generateText(enhancedInput);
        completionTokens += response.tokens?.completion || 0;
        promptTokens += response.tokens?.prompt || 0;

        // Update current response
        const stepResponse = response.text;
        currentResponse = stepResponse;

        // Check for tool usage in response
        const identifiedTools = await this.identifyToolUsage(stepResponse);
        if (identifiedTools.length > 0) {
          // Execute identified tools
          const outputs = await this.executeIdentifiedTools(identifiedTools);
          Object.assign(toolOutputs, outputs);
          
          // Add tool names to tracking
          identifiedTools.forEach(tool => {
            if (!toolsUsed.includes(tool.toolName)) {
              toolsUsed.push(tool.toolName);
            }
          });

          // Add tool results to context
          const toolResults = Object.entries(outputs)
            .map(([name, output]) => `${name} result: ${JSON.stringify(output)}`)
            .join('\n');

          currentResponse += `\n\nTool Results:\n${toolResults}`;
          
          // Add step completion to conversation
          conversation.add({
            role: 'assistant',
            content: `Step ${this._loopCount + 1} completed:\n${currentResponse}`,
            timestamp: Date.now(),
            metadata: {
              completionTokens,
              promptTokens,
              toolCalls: identifiedTools.map(t => t.toolName),
              model: this._languageModel.constructor.name,
              tokens: input.prompt.length
            }
          });

          // Store execution progress in memory instead
          await this.remember(`Execution progress: Step ${this._loopCount + 1} of ${plan.length}`, 'system', {
            type: 'execution_progress',
            currentStep: this._loopCount + 1,
            totalSteps: plan.length,
            taskId: task.id
          });
        }

        this._loopCount++;
      }

      // Add assistant's response to conversation
      conversation.add({
        role: 'assistant',
        content: currentResponse,
        metadata: {
          completionTokens,
          promptTokens,
          toolCalls: toolsUsed,
          model: this._languageModel.constructor.name
        }
      });

      // Generate execution summary
      const executionTime = Date.now() - startTime;
      const summary = {
        loopCount: this._loopCount,
        toolsUsed: Array.from(new Set(toolsUsed)),
        totalTokens: completionTokens + promptTokens,
        executionTime,
        averageStepTime: executionTime / this._loopCount,
        performance: {
          tokensPerStep: (completionTokens + promptTokens) / this._loopCount,
          timePerStep: executionTime / this._loopCount
        }
      };

      // Store final result with summary
      const memoryId = await this.remember(
        `Task completed successfully:\n\nUser: ${input.prompt}\nAssistant: ${currentResponse}\n\nExecution Summary:\n${JSON.stringify(summary, null, 2)}`,
        'conversation',
        {
          type: 'conversation',
          userInput: input.prompt,
          hasImages: !!input.images?.length,
          chatId: input.metadata?.chatId,
          loopCount: this._loopCount,
          toolsUsed,
          status: 'completed',
          summary,
          metadata: {
            ...input.metadata,
            completionTokens,
            promptTokens,
            toolOutputs,
            executionTime,
            averageStepTime: executionTime / this._loopCount,
            successRate: 1.0 // All steps completed successfully if we reached this point
          }
        }
      );

      this._lastExecutionTime = executionTime;
      this.updateMetrics(true, executionTime);

      return {
        response: currentResponse,
        memoryId,
        completionTokens,
        promptTokens,
        lastExecutionTime: executionTime,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        toolOutputs: Object.keys(toolOutputs).length > 0 ? toolOutputs : undefined,
        type: 'execution',
        metadata: {
          summary,
          status: 'completed'
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorMemoryId = await this.remember(
        `Conversation error: ${errorMessage}`,
        'error',
        {
          type: 'conversation_error',
          error: errorMessage,
          chatId: input.metadata?.chatId,
          toolsUsed,
          toolOutputs,
          metadata: {
            ...input.metadata,
            completionTokens,
            promptTokens
          }
        }
      );

      this._lastExecutionTime = Date.now() - startTime;
      this.updateMetrics(false, this._lastExecutionTime);

      return {
        response: `I encountered an error: ${errorMessage}`,
        memoryId: errorMemoryId,
        completionTokens,
        promptTokens,
        lastExecutionTime: this._lastExecutionTime,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        toolOutputs: Object.keys(toolOutputs).length > 0 ? toolOutputs : undefined
      };
    }
  }

  private isResponseComplete(response: string): boolean {
    // Check if response appears complete based on content markers
    const completionMarkers = [
      '.',
      '!',
      '?',
      '\n\n',
      'In conclusion',
      'To summarize',
      'Finally'
    ];
    
    return completionMarkers.some(marker =>
      response.trim().toLowerCase().endsWith(marker.toLowerCase()) ||
      response.trim().toLowerCase().includes(marker.toLowerCase())
    );
  }

  private async identifyToolUsage(response: string): Promise<{ toolName: string; input: any }[]> {
    const tools = this.getTools();
    
    // Convert Zod schemas to JSON Schema format for better readability
    const toolContext = tools.map(tool => {
      let schemaDescription = 'No input schema defined';
      
      if (tool.inputSchema) {
        try {
          // Extract schema description from Zod
          const zodSchema = tool.inputSchema;
          
          const extractZodSchema = (schema: any): any => {
            if (!schema || !schema._def) return null;
            
            const def = schema._def;
            
            // Handle object schemas
            if (def.typeName === 'ZodObject') {
              const properties: Record<string, any> = {};
              const required: string[] = [];
              
              Object.entries(def.shape()).forEach(([key, value]: [string, any]) => {
                const fieldSchema = extractZodSchema(value);
                if (fieldSchema) {
                  properties[key] = fieldSchema;
                  
                  // Check if field is required
                  if (!value._def.isOptional) {
                    required.push(key);
                  }
                }
              });
              
              return {
                type: 'object',
                properties,
                required: required.length > 0 ? required : undefined
              };
            }
            
            // Handle array schemas
            if (def.typeName === 'ZodArray') {
              return {
                type: 'array',
                items: extractZodSchema(def.type),
                description: def.description
              };
            }
            
            // Handle primitive types
            const typeMap: Record<string, string> = {
              ZodString: 'string',
              ZodNumber: 'number',
              ZodBoolean: 'boolean',
              ZodDate: 'string',
              ZodEnum: 'string',
              ZodNull: 'null',
              ZodUndefined: 'undefined'
            };
            
            const type = typeMap[def.typeName];
            if (type) {
              const schema: any = { type };
              
              if (def.description) {
                schema.description = def.description;
              }
              
              // Handle enums
              if (def.typeName === 'ZodEnum') {
                schema.enum = def.values;
              }
              
              return schema;
            }
            
            return null;
          };
          
          const extractedSchema = extractZodSchema(zodSchema);
          if (extractedSchema) {
            schemaDescription = JSON.stringify(extractedSchema, null, 2);
          }
        } catch (error) {
          console.warn(`Failed to extract schema for tool ${tool.name}:`, error);
        }
      }
      
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: schemaDescription
      };
    });

    // Structured prompt for accurate tool identification
    const toolIdentificationPrompt = {
      text: `# Tool Identification Analysis

## Response to Analyze
\`\`\`
${response.trim()}
\`\`\`

## Available Tools
${toolContext.map(tool => `
### ${tool.name}
- Description: ${tool.description}
- Schema:
\`\`\`json
${tool.inputSchema}
\`\`\`
`).join('\n')}

## Requirements
- Only select explicitly needed tools
- Parameters must match schema exactly
- Return empty list if no tools needed
- Parameters must be derived from context

## Response Format
Your response must contain these sections:

### Tool Selection
[TOOLS]
[
  {
    "toolName": "exact tool name",
    "input": {
      // parameters matching schema
    }
  }
]
[/TOOLS]

### Validation
[VALIDATION]
- Tools required: [list]
- Parameters verified: [yes/no]
- Schema compatibility: [yes/no]
[/VALIDATION]

### Reasoning
[REASONING]
Explain tool selection and parameter choices
[/REASONING]

Provide your analysis below:
`
    };
        try {
      const toolIdentification = await this._languageModel.generateText(toolIdentificationPrompt);
      let parsedTools: any[] = [];
      try {
        // More robust JSON extraction and parsing
        const jsonContent = toolIdentification.text.replace(/^[\s\S]*?(\[{.*}])/m, '$1');
        parsedTools = JSON.parse(jsonContent);
      } catch (parseError) {
        // Attempt alternate parsing strategies
        try {
          const matches = toolIdentification.text.match(/\[[\s\S]*?\]/g);
          if (matches && matches.length > 0) {
            parsedTools = JSON.parse(matches[0]);
          }
        } catch {
          console.warn('Failed to parse tool identification response');
          return [];
        }
      }

      if (!Array.isArray(parsedTools)) {
        console.warn('Tool identification response is not an array');
        return [];
      }

      // Enhanced validation with schema checking
      return parsedTools.filter(tool => {
        if (!tool?.toolName || typeof tool.toolName !== 'string') {
          return false;
        }

        const actualTool = tools.find(t => t.name === tool.toolName);
        if (!actualTool) {
          console.warn(`Tool not found: ${tool.toolName}`);
          return false;
        }

        if (!this.validateToolInput(actualTool, tool.input)) {
          console.warn(`Invalid input for tool ${tool.toolName}`);
          return false;
        }

        return true;
      });
    } catch (error) {
      console.error('Error in tool identification:', error);
      return [];
    }
  }

  private validateToolInput(tool: Tool, input: any): boolean {
    if (!tool.inputSchema) {
      return true; // No schema validation required
    }

    if (!input || typeof input !== 'object') {
      return false;
    }

    // Use the tool's built-in validation
    return tool.validate(input);
  }

  private async executeIdentifiedTools(
    tools: { toolName: string; input: any }[]
  ): Promise<Record<string, any>> {
    const outputs: Record<string, any> = {};
    
    for (const { toolName, input } of tools) {
      const tool = this.getTools().find(t => t.name === toolName);
      if (tool) {
        try {
          outputs[toolName] = await tool.execute(input);
        } catch (error) {
          console.error(`Error executing tool ${toolName}:`, error);
          outputs[toolName] = { error: error instanceof Error ? error.message : String(error) };
        }
      }
    }
    
    return outputs;
  }

  private async processPromptWithImages(input: TaskInput): Promise<PromptInput> {
    if (!input.images || input.images.length === 0) {
      return { text: input.prompt };
    }

    const processedImages = await Promise.all(
      input.images.map(async (image) => {
        if (image.startsWith('http')) {
          // Download and process remote image
          const imagePath = await this._imageHandler.downloadImage(image);
          const processedPath = await this._imageHandler.processImage(imagePath);
          const base64 = await fs.readFile(processedPath, 'base64');
          return {
            url: image,
            base64,
            mimeType: image.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
          };
        } else {
          // Local file path
          const processedPath = await this._imageHandler.processImage(image);
          const base64 = await fs.readFile(processedPath, 'base64');
          return {
            base64,
            mimeType: image.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
          };
        }
      })
    );

    return {
      text: input.prompt,
      images: processedImages,
      metadata: input.metadata
    };
  }


  private inferCapabilities(): AgentCapability[] {
    return this.getTools().map(tool => ({
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

  getTools(): any[] {
    return Array.from(this._tools.values())
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
      const taskMemoryId = await this.remember(`Starting task: ${task.toJSON().name}`, 'task', {
        taskId: task.id,
        status: TaskStatus.RUNNING
      });

      // Generate and validate plan
      const steps = await this.plan(task);
      if (steps.length === 0) {
        throw new Error('Failed to generate a valid execution plan');
      }

      // Store plan in memory
      await this.remember(`Generated execution plan for task ${task.id}:
${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`, 'system', {
        type: 'execution_plan',
        taskId: task.id,
        plan: steps,
        totalSteps: steps.length
      });

      // Initialize execution tracking
      const toolsUsed: string[] = [];
      let currentOutput: any = null;
      let completionTokens = 0;
      let promptTokens = 0;
      
      // Execute each step with proper tracking
      for (const step of steps) {
        if (this._loopCount >= this._maxLoops) {
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

        // Track step start
        await this.remember(`Starting step ${this._loopCount + 1}/${steps.length}: ${step}`, 'system', {
          type: 'step_execution',
          taskId: task.id,
          step,
          stepNumber: this._loopCount + 1,
          totalSteps: steps.length,
          status: 'started'
        });

        // Prepare step execution with context
        const stepInput: TaskInput = {
          prompt: `
Execute step ${this._loopCount + 1} of ${steps.length}:
${step}

Current Context:
${currentOutput ? JSON.stringify(currentOutput, null, 2) : 'No previous output'}

Requirements:
1. Follow the step exactly as specified
2. Use the exact tool mentioned
3. Handle any errors gracefully
4. Validate outputs before proceeding

Proceed with execution.`,
          metadata: {
            taskId: task.id,
            step,
            stepNumber: this._loopCount + 1,
            totalSteps: steps.length,
            previousOutput: currentOutput
          }
        };

        // Execute step and validate result
        const stepResult = await this.converse(stepInput);
        completionTokens += stepResult.completionTokens;
        promptTokens += stepResult.promptTokens;

        // Validate step result
        if (!stepResult.response || stepResult.response.includes('error')) {
          await this.remember(`Step ${this._loopCount + 1} failed: ${stepResult.response}`, 'error', {
            type: 'step_execution',
            taskId: task.id,
            step,
            stepNumber: this._loopCount + 1,
            totalSteps: steps.length,
            error: stepResult.response,
            status: 'failed'
          });
          throw new Error(`Step ${this._loopCount + 1} failed: ${stepResult.response}`);
        }

        // Update tracking with successful result
        if (stepResult.toolsUsed) {
          toolsUsed.push(...stepResult.toolsUsed);
        }
        
        if (stepResult.toolOutputs) {
          currentOutput = stepResult.toolOutputs;
        }

        // Record successful step completion
        await this.remember(`Step ${this._loopCount + 1} completed successfully`, 'task', {
          type: 'step_execution',
          taskId: task.id,
          step,
          stepNumber: this._loopCount + 1,
          totalSteps: steps.length,
          toolsUsed: stepResult.toolsUsed,
          toolOutputs: stepResult.toolOutputs,
          output: currentOutput,
          status: 'completed',
          metrics: {
            completionTokens: stepResult.completionTokens,
            promptTokens: stepResult.promptTokens,
            executionTime: stepResult.lastExecutionTime
          }
        });

        this._loopCount++;
      }

      const finalMemoryId = await this.remember(`Task completed: ${task.toJSON().name}`, 'result', {
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

  private getOrCreateConversation(chatId?: string): Conversation {
    const conversationId = chatId || 'default';
    let conversation = this._conversations.get(conversationId);
    
    if (!conversation) {
      conversation = new Conversation(this._systemPrompt);
      this._conversations.set(conversationId, conversation);
    }
    
    return conversation;
  }

  async plan(task: Task): Promise<string[]> {
    try {
      const taskJson = task.toJSON();
      let promptInput: PromptInput = {
        text: `
Task: ${taskJson.name}
Description: ${taskJson.input.description || 'No description provided'}

Available Tools:
${this.getTools().map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

Create a focused 3-step plan that:
1. Each step must:
   - Use a specific tool
   - Have clear success criteria
   - Include error handling
2. Format: "[Action] using [Tool] with {params}"
3. Example:
   "Validate input using ValidationTool with {data: input, rules: ['required']}"

Remember:
- Maximum 3 steps
- Each step must be self-contained
- Include validation in each step
- Handle errors gracefully

Your plan (3 steps max):`
      };
      
      // Handle image processing if task has input with images
      if (taskJson.input.images?.length) {
        const processedInput = await this.processPromptWithImages({
          prompt: promptInput.text,
          images: taskJson.input.images,
          metadata: taskJson.input.metadata
        });
        
        // If model doesn't support images, extract text
        if (!this._languageModel.supportsImages?.()) {
          const extractedText = await Promise.all(
            taskJson.input.images.map(async (image: string) => {
              if (image.startsWith('http')) {
                const imagePath = await this._imageHandler.downloadImage(image);
                return await this._imageHandler.extractText(imagePath);
              }
              return await this._imageHandler.extractText(image);
            })
          );
          
          promptInput.text += `\n\nImage Content:\n${extractedText.join('\n\n')}`;
        } else {
          promptInput = processedInput;
        }
      }

      const response = await this._languageModel.generateText(promptInput);
      const steps = response.text
        .split('\n')
        .map(step => step.trim())
        .filter(step =>
          step.length > 0 &&
          !step.startsWith('#') &&
          !step.startsWith('Step') &&
          step.includes(' using ') &&
          step.includes(' with {')
        );

      // Enforce 3-step limit and validate format
      const validSteps = steps
        .slice(0, 3)
        .map(step => {
          // Ensure proper format: "[Action] using [Tool] with {params}"
          const match = step.match(/^(.+) using ([A-Za-z]+) with ({.+})$/);
          if (!match) {
            console.warn(`Invalid step format: ${step}`);
            return null;
          }

          const [_, action, tool, params] = match;
          try {
            // Validate that params is valid JSON
            JSON.parse(params);
            return step;
          } catch (e) {
            console.warn(`Invalid params JSON in step: ${step}`);
            return null;
          }
        })
        .filter((step): step is string => step !== null);

      if (validSteps.length === 0) {
        console.warn('No valid steps generated, falling back to default');
        return [`Execute task: ${task.toJSON().name}`];
      }

      return validSteps;
    } catch (error) {
      console.error('Error generating task plan:', error);
      return [`Execute task: ${task.toJSON().name}`];
    }
  }

  async findToolForTask(step: string): Promise<Tool | undefined> {
    const prompt = `
    Step: ${step}
    Available Tools: ${this.getTools().map(tool =>
      `${tool.name} - ${tool.description}`
    ).join('\n')}

    Which tool would be most appropriate for this step? Respond with just the tool name.
    `;

    try {
      const response = await this._languageModel.generateText(prompt);
      const toolName = response.text.trim();
      return this.getTools().find(tool => tool.name === toolName);
    } catch (error) {
      console.error('Error selecting tool:', error);
      return this.getTools()[0];
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
    this._conversations.clear();
  }

  private updateConversationSystemPrompts(): void {
    for (const conversation of this._conversations.values()) {
      conversation.setSystemPrompt(this._systemPrompt);
    }
  }
}