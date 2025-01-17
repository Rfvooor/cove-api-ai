import { Agent, AgentConfig, TaskExecutionResult } from './agent.js';
import { Task, TaskStatus } from './task.js';
import { Tool, ToolConfig } from './tool.js';
import { Memory, MemoryConfig } from './memory.js';
import { SwarmRouterConfig } from './swarm-router.js';

export interface PlanningAgentConfig extends AgentConfig {
  swarmConfig?: Partial<SwarmRouterConfig>;
  planningStrategies?: {
    defaultStrategy: 'sequential' | 'capability' | 'loadBalanced' | 'collaborative';
    adaptiveReplanning: boolean;
    maxPlanningDepth: number;
    optimizationThreshold: number;
  };
  orchestrationRules?: {
    agentSelectionCriteria: string[];
    loadBalancingThreshold: number;
    collaborationTriggers: string[];
    failoverStrategies: string[];
  };
}

interface PlanningMetrics {
  planSuccessRate: number;
  averagePlanningTime: number;
  planAdaptations: number;
  resourceUtilization: number;
}

interface ComplexityAnalysisInput {
  task: string;
  context?: any;
}

interface ComplexityAnalysisOutput {
  complexity: number;
  recommendedStrategy: string;
}

interface ResourceOptimizationInput {
  resources: Array<{
    id: string;
    capacity?: number;
    currentLoad?: number;
  }>;
  constraints: {
    maxLoad: number;
    minAgents: number;
  };
}

interface ResourceOptimizationOutput {
  allocation: Array<{
    id: string;
    capacity?: number;
    currentLoad?: number;
    optimizedLoad: number;
  }>;
  recommendations: {
    scaling: boolean;
    rebalancing: boolean;
  };
}

interface PlanGenerationInput {
  task: string;
  strategy: string;
  context: {
    swarmConfig: any;
    complexity?: number;
    previousPlans: string[][];
  };
}

interface PlanGenerationOutput {
  steps: string[];
  metadata: {
    strategy: string;
    estimatedComplexity: number;
    recommendedAgents: string[];
  };
}

interface SwarmAgent {
  name: string;
  capabilities?: string[];
  performance?: {
    successRate?: number;
  };
}

export class PlanningAgent {
  private _planningConfig: Required<NonNullable<PlanningAgentConfig['planningStrategies']>>;
  private _orchestrationRules: Required<NonNullable<PlanningAgentConfig['orchestrationRules']>>;
  private _swarmConfig: Partial<SwarmRouterConfig>;
  private _planningMetrics: PlanningMetrics = {
    planSuccessRate: 1.0,
    averagePlanningTime: 0,
    planAdaptations: 0,
    resourceUtilization: 0
  };
  private _currentPlan: string[] = [];
  private _planRevisions: Map<string, string[]> = new Map();
  private _agent: Agent;

  static async create(config: PlanningAgentConfig): Promise<PlanningAgent> {
    const agent = await Agent.create({
      ...config,
      name: config.name || 'Planning Agent',
      description: config.description || 'Specialized agent for swarm planning and orchestration',
      systemPrompt: config.systemPrompt || PlanningAgent.getDefaultSystemPrompt()
    });

    const planningAgent = new PlanningAgent(agent);
    await planningAgent.initialize(config);
    return planningAgent;
  }

  private constructor(agent: Agent) {
    this._agent = agent;
    this._planningConfig = {
      defaultStrategy: 'sequential',
      adaptiveReplanning: true,
      maxPlanningDepth: 5,
      optimizationThreshold: 0.8
    };
    this._orchestrationRules = {
      agentSelectionCriteria: ['capability', 'performance', 'availability'],
      loadBalancingThreshold: 0.7,
      collaborationTriggers: ['complexity', 'interdependency', 'specialization'],
      failoverStrategies: ['retry', 'reassign', 'decompose']
    };
    this._swarmConfig = {};
  }

  private static getDefaultSystemPrompt(): string {
    return `You are a specialized planning agent responsible for orchestrating swarm operations.
Your primary functions include:
1. Analyzing tasks and generating optimal execution plans
2. Managing resource allocation and agent selection
3. Adapting plans based on real-time feedback
4. Ensuring efficient collaboration between agents
5. Maintaining operational metrics and optimization

Always consider:
- Resource efficiency and load balancing
- Task dependencies and optimal sequencing
- Error handling and recovery strategies
- Performance optimization opportunities`;
  }

  async initialize(config: PlanningAgentConfig): Promise<void> {
    // Initialize planning-specific configurations
    if (config.planningStrategies) {
      this._planningConfig = {
        ...this._planningConfig,
        ...config.planningStrategies
      };
    }

    if (config.orchestrationRules) {
      this._orchestrationRules = {
        ...this._orchestrationRules,
        ...config.orchestrationRules
      };
    }

    if (config.swarmConfig) {
      this._swarmConfig = {
        ...this._swarmConfig,
        ...config.swarmConfig
      };
    }

    // Add planning-specific tools
    await this.addPlanningTools();
  }

  private async addPlanningTools(): Promise<void> {
    // Create tools with explicit typing
    const tools: Tool[] = [
      new Tool({
        name: 'analyze_task_complexity',
        description: 'Analyzes task complexity and resource requirements',
        execute: async (input: any) => {
          const typedInput = input as ComplexityAnalysisInput;
          const complexityScore = await this.calculateTaskComplexity(typedInput.task, typedInput.context);
          return {
            complexity: complexityScore,
            recommendedStrategy: this.determineStrategy(complexityScore)
          };
        }
      }),
      new Tool({
        name: 'optimize_resource_allocation',
        description: 'Optimizes resource allocation based on current swarm state',
        execute: async (input: any) => {
          const typedInput = input as ResourceOptimizationInput;
          return await this.optimizeResources(typedInput.resources, typedInput.constraints);
        }
      }),
      new Tool({
        name: 'generate_execution_plan',
        description: 'Generates detailed execution plan for given task',
        execute: async (input: any) => {
          const typedInput = input as PlanGenerationInput;
          return await this.generateDetailedPlan(typedInput.task, typedInput.strategy, typedInput.context);
        }
      })
    ];

    // Add tools to agent
    tools.forEach(tool => this._agent.addTool(tool));
  }

  async plan(task: Task): Promise<string[]> {
    const startTime = Date.now();
    try {
      // Analyze task complexity
      const complexityTool = this._agent.getTools().find(t => t.name === 'analyze_task_complexity');
      if (!complexityTool) throw new Error('Complexity analysis tool not found');

      const analysis = await complexityTool.execute({
        task: task.toJSON().input.description || task.toJSON().name,
        context: this._swarmConfig
      }) as ComplexityAnalysisOutput;

      // Generate initial plan
      const planTool = this._agent.getTools().find(t => t.name === 'generate_execution_plan');
      if (!planTool) throw new Error('Plan generation tool not found');

      const executionPlan = await planTool.execute({
        task: task.toJSON().name,
        strategy: analysis.recommendedStrategy || this._planningConfig.defaultStrategy,
        context: {
          swarmConfig: this._swarmConfig,
          complexity: analysis.complexity,
          previousPlans: Array.from(this._planRevisions.values())
        }
      }) as PlanGenerationOutput;

      // Store the generated plan
      this._currentPlan = executionPlan.steps;
      this._planRevisions.set(task.id, this._currentPlan);

      // Update metrics
      const planningTime = Date.now() - startTime;
      this.updatePlanningMetrics(true, planningTime);

      return this._currentPlan;
    } catch (error) {
      console.error('Planning error:', error);
      this.updatePlanningMetrics(false, Date.now() - startTime);
      return [`Execute task: ${task.toJSON().name}`];
    }
  }

  async execute(task: Task): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    try {
      // Generate or retrieve plan
      const plan = await this.plan(task);
      
      // Execute the plan using agent's execute logic
      const result = await this._agent.execute(task);

      // Analyze execution results for plan optimization
      if (result.success && this._planningConfig.adaptiveReplanning) {
        await this.analyzePlanEffectiveness(task, result);
      }

      return result;
    } catch (error) {
      console.error('Execution error:', error);
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error : new Error(String(error)),
        toolsUsed: [],
        completionTokens: 0,
        promptTokens: 0,
        lastExecutionTime: Date.now() - startTime
      };
    }
  }

  private async calculateTaskComplexity(task: string, context: any): Promise<number> {
    const factors = {
      length: task.length / 100,
      dependencies: (context?.agents?.length || 1) - 1,
      toolRequirements: this._agent.getTools().length,
      dataComplexity: context?.data ? Object.keys(context.data).length / 10 : 0
    };

    return Object.values(factors).reduce((sum, factor) => sum + factor, 0) / Object.keys(factors).length;
  }

  private determineStrategy(complexityScore: number): string {
    if (complexityScore > 0.8) return 'collaborative';
    if (complexityScore > 0.6) return 'capability';
    if (complexityScore > 0.4) return 'loadBalanced';
    return 'sequential';
  }

  private async optimizeResources(
    resources: ResourceOptimizationInput['resources'],
    constraints: ResourceOptimizationInput['constraints']
  ): Promise<ResourceOptimizationOutput> {
    return {
      allocation: resources.map(resource => ({
        ...resource,
        optimizedLoad: Math.min(resource.capacity || 1, constraints.maxLoad)
      })),
      recommendations: {
        scaling: resources.length < constraints.minAgents,
        rebalancing: this._planningMetrics.resourceUtilization > this._orchestrationRules.loadBalancingThreshold
      }
    };
  }

  private async generateDetailedPlan(
    task: string,
    strategy: string,
    context: PlanGenerationInput['context']
  ): Promise<PlanGenerationOutput> {
    const baseTask = new Task({
      type: 'agent',
      executorId: this._agent.id,
      input: {
        name: task,
        description: `Generate ${strategy} plan for: ${task}`,
        prompt: task
      }
    });

    const baseSteps = await this._agent.plan(baseTask);

    return {
      steps: baseSteps,
      metadata: {
        strategy,
        estimatedComplexity: context.complexity || 0,
        recommendedAgents: this.recommendAgents(strategy, context)
      }
    };
  }

  private recommendAgents(strategy: string, context: PlanGenerationInput['context']): string[] {
    const availableAgents = (context.swarmConfig?.agents || []) as SwarmAgent[];
    
    return availableAgents.filter(agent => {
      switch (strategy) {
        case 'collaborative':
          return agent.capabilities?.some(cap => 
            this._orchestrationRules.collaborationTriggers.includes(cap)
          ) ?? false;
        case 'capability':
          return (agent.performance?.successRate ?? 0) > this._planningConfig.optimizationThreshold;
        default:
          return true;
      }
    }).map(agent => agent.name);
  }

  private async analyzePlanEffectiveness(task: Task, result: TaskExecutionResult): Promise<void> {
    if (!result.success || !this._currentPlan) return;

    const effectiveness = {
      completionTime: result.lastExecutionTime || 0,
      resourceUsage: result.toolsUsed.length / this._agent.getTools().length,
      successRate: result.success ? 1 : 0
    };

    if (effectiveness.completionTime > this._planningMetrics.averagePlanningTime * 1.5 ||
        effectiveness.resourceUsage > this._orchestrationRules.loadBalancingThreshold) {
      this._planRevisions.set(task.id, this._currentPlan);
      this._planningMetrics.planAdaptations++;
    }
  }

  private updatePlanningMetrics(success: boolean, planningTime: number): void {
    const weight = 0.1;
    this._planningMetrics.planSuccessRate = 
      this._planningMetrics.planSuccessRate * (1 - weight) + (success ? 1 : 0) * weight;
    this._planningMetrics.averagePlanningTime = 
      this._planningMetrics.averagePlanningTime * (1 - weight) + planningTime * weight;
    this._planningMetrics.resourceUtilization = 
      this.calculateResourceUtilization();
  }

  private calculateResourceUtilization(): number {
    const tools = this._agent.getTools();
    if (tools.length === 0) return 0;

    const activeTools = tools.filter(tool => 
      (tool as any).lastUsed && Date.now() - (tool as any).lastUsed < 5 * 60 * 1000
    ).length;

    return activeTools / tools.length;
  }

  // Public API
  getPlanningMetrics(): PlanningMetrics {
    return { ...this._planningMetrics };
  }

  getCurrentPlan(): string[] {
    return [...this._currentPlan];
  }

  getPlanHistory(taskId: string): string[] | undefined {
    return this._planRevisions.get(taskId);
  }

  getAgent(): Agent {
    return this._agent;
  }
}