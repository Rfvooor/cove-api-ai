import { AgentInterface } from './agent.js';
import { Task, TaskPriority } from './task.js';

interface TaskExecutionResult {
  success: boolean;
  output: any;
  error?: Error;
  toolsUsed: string[];
  completionTokens: number;
  promptTokens: number;
  memoryIds?: string[];
  lastExecutionTime?: number;
  type?: string;
}

export interface SwarmRouterConfig {
  name?: string;
  description?: string;
  agents: AgentInterface[];
  swarm_type?: 'SequentialWorkflow' | 'CapabilityBased' | 'LoadBalanced' | 'CollaborativeSolving';
  max_loops?: number;
  collaboration_threshold?: number;
}

export class SwarmRouter {
  private _name: string;
  private _description: string;
  private _agents: AgentInterface[];
  private _swarmType: NonNullable<SwarmRouterConfig['swarm_type']>;
  private _maxLoops: number;
  private _collaborationThreshold: number;
  private _logs: Array<{
    timestamp: number;
    agent: string;
    task: string;
    result: TaskExecutionResult;
    loop: number;
  }> = [];

  private _metrics: {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    averageExecutionTime: number;
    agentPerformance: Record<string, {
      tasksHandled: number;
      successRate: number;
      averageExecutionTime: number;
    }>;
  } = {
    totalTasks: 0,
    successfulTasks: 0,
    failedTasks: 0,
    averageExecutionTime: 0,
    agentPerformance: {}
  };
  private _intermediateResults: any[] = [];

  constructor(config: SwarmRouterConfig) {
    this._name = config.name || 'Unnamed Swarm';
    this._description = config.description || 'A dynamic multi-agent swarm';
    this._agents = config.agents;
    this._swarmType = config.swarm_type || 'SequentialWorkflow';
    this._maxLoops = config.max_loops || 5;
    this._collaborationThreshold = config.collaboration_threshold || 0.7;
  }

  // Getters and Setters
  get name(): string { return this._name; }
  set name(name: string) { this._name = name; }
  get description(): string { return this._description; }
  set description(description: string) { this._description = description; }
  get agents(): AgentInterface[] { return this._agents; }
  set agents(agents: AgentInterface[]) { this._agents = agents; }
  get swarm_type(): string { return this._swarmType; }
  set swarm_type(type: string) { 
    this._swarmType = type as NonNullable<SwarmRouterConfig['swarm_type']>; 
  }
  get max_loops(): number { return this._maxLoops; }
  set max_loops(loops: number) { this._maxLoops = loops; }

  async run(taskInput: string): Promise<any> {
    let currentLoops = 0;
    let result: any;
    this._intermediateResults = [];

    // Create a Task instance from the input
    const task = new Task({
      name: taskInput,
      description: `Execute task: ${taskInput}`,
      priority: TaskPriority.MEDIUM
    });

    while (currentLoops < this._maxLoops) {
      // Select the most appropriate agent based on the task and current context
      const selectedAgent = await this.selectBestAgent(taskInput, currentLoops, this._intermediateResults);

      if (!selectedAgent) {
        throw new Error('No suitable agent found for the task');
      }

      // Execute the task with the selected agent
      const executionResult = await selectedAgent.execute(task);

      // Log the execution
      this._logs.push({
        timestamp: Date.now(),
        agent: selectedAgent.name,
        task: taskInput,
        result: executionResult,
        loop: currentLoops
      });

      // Store intermediate results for collaborative solving
      this._intermediateResults.push(executionResult);

      // Check if the task is complete or needs further processing
      if (executionResult.success && this.isTaskComplete(executionResult)) {
        result = executionResult.output;
        break;
      }

      // Collaborative solving for complex tasks
      if (this._swarmType === 'CollaborativeSolving') {
        const collaborativeResult = await this.collaborativeSolve(taskInput, this._intermediateResults);
        if (this.isTaskComplete(collaborativeResult)) {
          result = collaborativeResult;
          break;
        }
      }

      currentLoops++;
    }

    return result;
  }

  private async selectBestAgent(taskInput: string, currentLoops: number, context: any[]): Promise<AgentInterface | undefined> {
    const task = new Task({
      name: taskInput,
      description: `Execute task: ${taskInput}`,
      priority: TaskPriority.MEDIUM
    });

    switch (this._swarmType) {
      case 'CapabilityBased':
        return this.selectAgentByCapability(task);
      
      case 'LoadBalanced':
        return this.selectLeastLoadedAgent();
      
      case 'CollaborativeSolving':
        return this.selectAgentForCollaboration(task, context);
      
      case 'SequentialWorkflow':
      default:
        return this._agents[currentLoops % this._agents.length];
    }
  }

  private async selectAgentByCapability(task: Task): Promise<AgentInterface | undefined> {
    const capabilityScores = await Promise.all(
      this._agents.map(async (agent) => {
        const tools = agent.getTools();
        const relevancePrompt = `
        Task: ${task.name}
        Description: ${task.description || 'No description provided'}
        Available Tools: ${tools.map(t => t.name).join(', ')}

        Analyze how well the agent's tools match the task requirements.
        Consider:
        1. Tool capabilities vs task needs
        2. Agent's historical performance
        3. Task complexity and agent expertise

        Provide a relevance score between 0 and 1.
        `;

        try {
          const scoreStr = await this.generateTextWithAgent(this._agents[0], relevancePrompt);
          const score = parseFloat(scoreStr);
          return { agent, score: isNaN(score) ? 0 : score };
        } catch {
          return { agent, score: 0 };
        }
      })
    );

    return capabilityScores.reduce((best, current) =>
      current.score > best.score ? current : best
    ).agent;
  }

  private selectLeastLoadedAgent(): AgentInterface | undefined {
    return this._agents.reduce((least, current) => {
      const leastLoaded = this._logs.filter(log => log.agent === least.name).length;
      const currentLoaded = this._logs.filter(log => log.agent === current.name).length;
      return currentLoaded < leastLoaded ? current : least;
    }, this._agents[0]);
  }

  private async selectAgentForCollaboration(task: Task, context: any[]): Promise<AgentInterface | undefined> {
    const contextStr = JSON.stringify(context);
    const collaborationPrompt = `
    Task: ${task.name}
    Description: ${task.description || 'No description provided'}
    Current Context: ${contextStr}

    Analyze the current progress and determine which agent would be most suitable
    to advance the solution. Consider:
    1. Complementary skills needed
    2. Potential to break current roadblocks
    3. Unique perspective or expertise required
    4. Previous contributions and success rate

    Respond with a description of the most appropriate agent's capabilities.
    `;

    const collaborationHint = await this.generateTextWithAgent(this._agents[0], collaborationPrompt);
    
    // Create a task for agent selection
    const selectionTask = new Task({
      name: 'Select Collaborative Agent',
      description: collaborationHint,
      priority: TaskPriority.HIGH
    });
    
    return this.selectAgentByCapability(selectionTask);
  }

  // TODO: Improve collaborative solving
  private async collaborativeSolve(taskInput: string, intermediateResults: any[]): Promise<any> {
    const task = new Task({
      name: 'Collaborative Solution',
      description: `Synthesize solution for: ${taskInput}`,
      priority: TaskPriority.HIGH
    });

    const collaborationPrompt = `
    Task: ${task.name}
    Description: ${task.description}
    Intermediate Results: ${JSON.stringify(intermediateResults)}

    Analyze the current progress and synthesize a comprehensive solution.
    Consider:
    1. Integration of successful approaches
    2. Resolution of conflicts or inconsistencies
    3. Optimization opportunities
    4. Validation of combined solution

    Provide a structured solution that builds on the collective results.
    `;

    const synthesizedResult = await this.generateTextWithAgent(this._agents[0], collaborationPrompt);
    
    try {
      return JSON.parse(synthesizedResult);
    } catch {
      return synthesizedResult;
    }
  }

  // Helper method to generate text using an agent's language model
  private async generateTextWithAgent(agent: AgentInterface, prompt: string): Promise<string> {
    if (!agent) {
      throw new Error('No agent available for text generation');
    }

    try {
      // Create a task for text generation
      const task = new Task({
        name: 'Generate Text',
        description: prompt,
        priority: TaskPriority.MEDIUM,
        metadata: {
          type: 'text_generation',
          prompt
        }
      });

      // Execute the task
      const result = await agent.execute(task);
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Text generation failed');
      }

      return typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
    } catch (error) {
      console.warn('Failed to generate text:', error);
      return this.fallbackTextGeneration(prompt);
    }
  }

  private fallbackTextGeneration(prompt: string): string {
    // Simple fallback that extracts key information from the prompt
    const lines = prompt.split('\n');
    const keyPoints = lines
      .filter(line => line.trim().length > 0)
      .map(line => line.trim())
      .slice(0, 3)
      .join(' ');
    
    return `Generated response based on: ${keyPoints}`;
  }

  private isTaskComplete(result: TaskExecutionResult | any): boolean {
    if (result === null || result === undefined) return false;

    // Check TaskExecutionResult format first
    if ('success' in result && 'output' in result) {
      return result.success && result.output !== null && result.output !== undefined;
    }

    // Check for task-specific completion criteria
    if (result.type === 'text_generation') {
      return typeof result.output === 'string' && result.output.length > 0;
    }

    // More sophisticated completion checking for other result types
    if (typeof result === 'object') {
      return (
        result.status === 'complete' ||
        result.success === true ||
        (result.output && Object.keys(result.output).length > 0)
      );
    }

    return true;
  }

  get_logs(): Array<{
    timestamp: number;
    agent: string;
    task: string;
    result: any;
    loop: number;
  }> {
    return this._logs;
  }

  // Method to add a new agent to the swarm dynamically
  addAgent(agent: AgentInterface): void {
    this._agents.push(agent);
  }

  // Method to remove an agent from the swarm
  removeAgent(agentName: string): void {
    this._agents = this._agents.filter(agent => agent.name !== agentName);
  }
}