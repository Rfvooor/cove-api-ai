import { AgentInterface, ConversationResult, TaskExecutionResult } from './agent.js';
import { Task, TaskResult, TaskStatus, TaskInput } from './task.js';
import { Memory, MemoryConfig, MemoryEntry } from './memory.js';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export interface SwarmRouterConfig {
  name?: string;
  description?: string;
  agents: AgentInterface[];
  swarm_type?: 'SequentialWorkflow' | 'CapabilityBased' | 'LoadBalanced' | 'CollaborativeSolving';
  max_loops?: number;
  collaboration_threshold?: number;
  timeout?: number;
  planning_mode?: 'Complete' | 'JIT';
  steps_per_plan?: number;  // Number of steps to plan ahead in JIT mode
  retryConfig?: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay?: number;
    maxDelay?: number;
  };
}

interface SwarmMetrics {
  efficiency: {
    taskCompletionRate: number;
    resourceUtilization: number;
    loadBalance: number;
  };
  collaboration: {
    agentInteractions: number;
    informationSharing: number;
    consensusRate: number;
  };
  health: {
    activeAgents: number;
    failureRate: number;
    recoveryTime: number;
    retryRate: number;
    timeoutRate: number;
  };
}

export class SwarmRouter extends EventEmitter {
  private readonly _id: string = randomUUID();
  private _name: string = '';
  private _description: string;
  private _agents: AgentInterface[];
  private _swarmType: NonNullable<SwarmRouterConfig['swarm_type']>;
  private _maxLoops: number;
  private _collaborationThreshold: number;
  private _timeout: number;
  private _planningMode: NonNullable<SwarmRouterConfig['planning_mode']>;
  private _stepsPerPlan: number;
  private _retryConfig: Required<NonNullable<SwarmRouterConfig['retryConfig']>>;
  private _memory!: Memory;
  private _intermediateResults: TaskResult[] = [];
  private _currentPlanStep: number = 0;

  private _metrics: SwarmMetrics = {
    efficiency: {
      taskCompletionRate: 0,
      resourceUtilization: 0,
      loadBalance: 0
    },
    collaboration: {
      agentInteractions: 0,
      informationSharing: 0,
      consensusRate: 0
    },
    health: {
      activeAgents: 0,
      failureRate: 0,
      recoveryTime: 0,
      retryRate: 0,
      timeoutRate: 0
    }
  };

  private _agentPerformance: Record<string, {
    tasksHandled: number;
    successRate: number;
    averageExecutionTime: number;
    retryCount: number;
    timeoutCount: number;
    lastInteraction: number;
  }> = {};

  constructor(config: SwarmRouterConfig) {
    super();
    this._description = config.description || 'A dynamic multi-agent swarm';
    this._agents = config.agents;
    this._swarmType = config.swarm_type || 'SequentialWorkflow';
    this._maxLoops = config.max_loops || 5;
    this._collaborationThreshold = config.collaboration_threshold || 0.7;
    this._timeout = config.timeout || 30000;
    this._planningMode = config.planning_mode || 'Complete';
    this._stepsPerPlan = config.steps_per_plan || 2;
    this._retryConfig = {
      maxAttempts: config.retryConfig?.maxAttempts ?? 3,
      backoffMultiplier: config.retryConfig?.backoffMultiplier ?? 1.5,
      initialDelay: config.retryConfig?.initialDelay ?? 1000,
      maxDelay: config.retryConfig?.maxDelay ?? 30000
    };

    // Initialize metrics for each agent
    this._agents.forEach(agent => {
      this._agentPerformance[agent.name] = {
        tasksHandled: 0,
        successRate: 1.0,
        averageExecutionTime: 0,
        retryCount: 0,
        timeoutCount: 0,
        lastInteraction: Date.now()
      };
    });
    
    // Initialize memory system asynchronously
    this.initializeMemory().catch(console.error);
  }

  private async initializeMemory(): Promise<void> {
    const memoryConfig: MemoryConfig = {
      maxShortTermItems: 100,
      maxTokenSize: 4096,
      autoArchive: true,
      archiveThreshold: 0.8,
      indexStrategy: 'semantic',
      metadata: {
        swarmId: this._id,
        swarmName: this._name,
        swarmType: this._swarmType
      }
    };

    this._memory = await Memory.create(memoryConfig);
    this.emit('memoryInitialized', { swarmId: this._id });
  }

  private async remember(
    content: string,
    type: MemoryEntry['type'] = 'task',
    metadata?: Record<string, any>
  ): Promise<string> {
    return await this._memory.add({
      content,
      type,
      metadata: {
        ...metadata,
        swarmId: this._id,
        swarmType: this._swarmType,
        timestamp: new Date().toISOString()
      }
    });
  }

  private async generateSwarmPlan(task: Task, previousSteps: TaskResult[] = []): Promise<string[]> {
    const taskJson = task.toJSON();
    
    // Dynamic step calculation for JIT mode
    const maxStepsToGenerate = this._planningMode === 'JIT'
      ? this.calculateOptimalStepCount(previousSteps)
      : this._maxLoops;
    
    if (maxStepsToGenerate <= 0) {
      return [];
    }

    let planningPrompt = `YOU MUST NOT GENERATE A PLAN ABOVE ${maxStepsToGenerate} STEPS\n`;
    
    // Enhanced context for JIT mode
    if (this._planningMode === 'JIT') {
      const contextAnalysis = this.analyzeExecutionContext(previousSteps);
      planningPrompt += `
Current Execution Context:
- Progress: ${contextAnalysis.progress}%
- Success Rate: ${contextAnalysis.successRate}%
- Complexity Level: ${contextAnalysis.complexity}
- Identified Challenges: ${contextAnalysis.challenges.join(', ')}

${previousSteps.length > 0 ? `Previous Steps Analysis:
${previousSteps.map((step, index) => `
Step ${index + 1}:
Output: ${JSON.stringify(step.output)}
Status: ${step.status}
Impact: ${this.analyzeStepImpact(step)}
Dependencies: ${this.identifyDependencies(step, previousSteps)}
`).join('\n')}

Based on this analysis, generate the next ${maxStepsToGenerate} strategic step(s) that:
1. Address identified challenges
2. Build upon successful outcomes
3. Maintain task coherence
4. Optimize for the current context\n` : ''}`;
    }

    switch (this._swarmType) {
      case 'SequentialWorkflow':
        planningPrompt += `
Task: ${taskJson.name}
Description: ${taskJson.input.description || 'No description provided'}
Available Agents: ${this._agents.map(a => `${a.name} (${a.description})`).join(', ')}

Create a sequential workflow plan where each step builds on the previous one.
Consider:
1. Dependencies between steps
2. Information flow between agents
3. Validation points
4. Error handling and recovery steps

Provide a step-by-step plan that maximizes the sequential nature of the workflow.`;
        break;

      case 'CapabilityBased':
        planningPrompt += `
Task: ${taskJson.name}
Description: ${taskJson.input.description || 'No description provided'}
Available Agents and Their Tools:
${this._agents.map(a => `${a.name}:
  - ${a.getTools().map(t => t.name).join('\n  - ')}`).join('\n')}

Create a capability-focused plan that:
1. Matches steps to agent capabilities
2. Optimizes for specialized skills
3. Includes fallback options
4. Considers tool combinations

Provide a step-by-step plan that leverages each agent's unique capabilities.`;
        break;

      case 'LoadBalanced':
        planningPrompt += `
Task: ${taskJson.name}
Description: ${taskJson.input.description || 'No description provided'}
Agent Performance Metrics:
${Object.entries(this._agentPerformance).map(([name, metrics]) =>
  `${name}:
   - Success Rate: ${metrics.successRate.toFixed(2)}
   - Average Time: ${metrics.averageExecutionTime}ms
   - Tasks Handled: ${metrics.tasksHandled}`
).join('\n')}

Create a load-balanced execution plan that:
1. Distributes work based on agent performance
2. Considers current agent loads
3. Includes parallel execution opportunities
4. Provides load redistribution triggers

Provide a step-by-step plan optimized for balanced resource utilization.`;
        break;

      case 'CollaborativeSolving':
        planningPrompt += `
Task: ${taskJson.name}
Description: ${taskJson.input.description || 'No description provided'}
Available Agents: ${this._agents.map(a => `${a.name} (${a.description})`).join(', ')}
Collaboration Threshold: ${this._collaborationThreshold}

Create a collaborative problem-solving plan that:
1. Identifies subtasks for parallel solving
2. Defines collaboration points
3. Establishes consensus mechanisms
4. Includes synthesis steps

Provide a step-by-step plan that maximizes agent collaboration and knowledge sharing.`;
        break;

      default:
        planningPrompt += `
Task: ${taskJson.name}
Description: ${taskJson.input.description || 'No description provided'}
Available Agents: ${this._agents.map(a => a.name).join(', ')}

Create a general execution plan that:
1. Breaks down the task into clear steps
2. Assigns appropriate agents
3. Includes validation points
4. Defines success criteria

Provide a step-by-step plan for task completion.`;
    }

    // Add output schema to the prompt
    planningPrompt += `

## Output Schema
{
  "type": "array",
  "description": "Array of execution steps for the swarm task",
  "items": {
    "type": "string",
    "description": "Individual step description with format: '[Action] using [Tool/Agent] with [Parameters]'",
    "pattern": "^[A-Z][a-zA-Z0-9\\s]+ using [A-Za-z]+ with \\{.*\\}$"
  },
  "maxItems": ${this._maxLoops},
  "minItems": 1
}

## Response Format Rules
1. Each step must follow the pattern: "[Action] using [Tool/Agent] with [Parameters]"
2. Actions should be clear and specific
3. Tool/Agent names must match available resources
4. Parameters should be provided in JSON format
5. Maximum ${this._maxLoops} steps allowed
6. Steps must be logically sequential
7. No numbering or prefixes needed

## Example Response
[
  "Fetch market data using DataTool with {\\"symbol\\": \\"BTC\\", \\"timeframe\\": \\"1h\\"}",
  "Analyze trends using AnalysisTool with {\\"method\\": \\"momentum\\", \\"period\\": 14}",
  "Generate report using ReportTool with {\\"format\\": \\"json\\", \\"sections\\": [\\"summary\\", \\"details\\"]}"
]

Response:`;

    // Use the first agent's language model for plan generation
    const planningAgent = this._agents[0];
    if (!planningAgent) {
      throw new Error('No agents available for plan generation');
    }

    try {
      const planResult = await planningAgent.getLanguageModel().generateText({
        text: planningPrompt
      });

      // Parse the response as JSON if possible
      try {
        const jsonMatch = planResult.text.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : planResult.text;
        const steps = JSON.parse(jsonStr);
        
        if (Array.isArray(steps) && steps.every(step => typeof step === 'string')) {
          return steps;
        }
      } catch (parseError) {
        console.warn('Failed to parse JSON response, falling back to text parsing');
      }

      // Fallback to text parsing if JSON parsing fails
      return planResult.text
        .split('\n')
        .map(step => step.trim())
        .filter(step => step.length > 0 && !step.startsWith('#') && !step.startsWith('Step'));
    } catch (error) {
      return [`Execute task: ${taskJson.name}`];
    }
  }

  async run(taskInput: string, images: string[]): Promise<TaskResult> {
    let currentLoops = 0;
    let finalResult: TaskResult | undefined;
    this._intermediateResults = [];
    const startTime = Date.now();


    // Create a Task instance from the input
    const task = new Task({
      type: 'swarm',
      executorId: this._id,
      input: {
        name: taskInput,
        description: `Execute task: ${taskInput}`,
        prompt: taskInput,
        images: images
      },
      timeout: this._timeout,
      retryConfig: this._retryConfig
    });

    try {
      // Reset plan step counter
      this._currentPlanStep = 0;
      let executionPlan: string[] = [];
      
      while (currentLoops < this._maxLoops) {
        // Generate or update plan based on planning mode
        if (this._planningMode === 'JIT') {
          if (executionPlan.length === 0) {
            executionPlan = await this.generateSwarmPlan(task, this._intermediateResults);
            
            if (executionPlan.length === 0) {
              break; // No more steps to execute
            }

            await this.remember(`Generated JIT execution plan for task: ${taskInput}`, 'system', {
              taskId: task.id,
              plan: executionPlan,
              planStep: this._currentPlanStep,
              swarmType: this._swarmType
            });
          }
        } else if (currentLoops === 0) {
          // Generate complete plan upfront for non-JIT mode
          executionPlan = await this.generateSwarmPlan(task);
          
          await this.remember(`Generated complete execution plan for task: ${taskInput}`, 'system', {
            taskId: task.id,
            plan: executionPlan,
            swarmType: this._swarmType
          });
        }

        // Select the most appropriate agent based on the task and current context
        const selectedAgent = await this.selectBestAgent(taskInput, currentLoops, this._intermediateResults);

        if (!selectedAgent) {
          throw new Error('No suitable agent found for the task');
        }


        // Update collaboration metrics
        this._metrics.collaboration.agentInteractions++;
        this._agentPerformance[selectedAgent.name].lastInteraction = Date.now();

        // Set the executor for the task
        task.setExecutor(selectedAgent);

        // Execute the task with the selected agent
        const executionResult = await task.execute();

        // Update metrics
        this.updateMetrics(selectedAgent.name, executionResult, startTime);

        // Store intermediate results for collaborative solving
        this._intermediateResults.push(executionResult);

        // Check if the task is complete or needs further processing
        if (executionResult.status === TaskStatus.COMPLETED && this.isTaskComplete(executionResult)) {
          finalResult = executionResult;
          break;
        }

        // Collaborative solving for complex tasks
        if (this._swarmType === 'CollaborativeSolving') {
          const collaborativeResult = await this.collaborativeSolve(taskInput, this._intermediateResults);
          if (this.isTaskComplete(collaborativeResult)) {
            finalResult = collaborativeResult;
            break;
          }
        }

        currentLoops++;
      }

      if (!finalResult) {
        throw new Error(`Task not completed within ${this._maxLoops} loops`);
      }

      // Update final metrics
      this.updateFinalMetrics(finalResult, startTime);

      return finalResult;
    } catch (error) {
      // Update failure metrics
      this._metrics.health.failureRate = (this._metrics.health.failureRate * this._metrics.health.activeAgents + 1) /
        (this._metrics.health.activeAgents + 1);

      throw error;
    }
  }

  private async selectBestAgent(taskInput: string, currentLoops: number, context: TaskResult[]): Promise<AgentInterface | undefined> {
    const task = new Task({
      type: 'swarm',
      executorId: this._id,
      input: {
        name: 'Agent Selection',
        description: `Select best agent for: ${taskInput}`,
        prompt: taskInput
      },
      timeout: this._timeout,
      retryConfig: this._retryConfig
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
# Agent Capability Analysis System
You are a specialized system for matching agent capabilities to task requirements.

## Task Context
Name: ${task.toJSON().name}
Description: ${task.toJSON().input.description || 'No description provided'}

## Agent Profile
Name: ${agent.name}
Description: ${agent.description}
Available Tools: ${tools.map(t => `
- ${t.name}: ${t.description}`).join('')}

## Historical Performance
Success Rate: ${this._agentPerformance[agent.name].successRate.toFixed(2)}
Average Execution Time: ${this._agentPerformance[agent.name].averageExecutionTime}ms
Tasks Completed: ${this._agentPerformance[agent.name].tasksHandled}

## Evaluation Criteria
1. Tool Capability Match (70%)
   - Direct tool relevance to task
   - Tool sophistication level
   - Coverage of task requirements

2. Historical Performance (10%)
   - Success rate in similar tasks
   - Execution efficiency
   - Error handling history

3. Expertise Alignment (20%)
   - Domain knowledge match
   - Task complexity fit
   - Specialization relevance

## Scoring Guidelines
- Score Range: 0.0 to 1.0
- 0.0-0.3: Poor match
- 0.4-0.6: Moderate match
- 0.7-0.8: Good match
- 0.9-1.0: Excellent match

## Required Response
Provide a single decimal number between 0 and 1 representing the agent's capability match score.
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
      const leastMetrics = this._agentPerformance[least.name];
      const currentMetrics = this._agentPerformance[current.name];
      return currentMetrics.tasksHandled < leastMetrics.tasksHandled ? current : least;
    }, this._agents[0]);
  }

  private async selectAgentForCollaboration(task: Task, context: TaskResult[]): Promise<AgentInterface | undefined> {
    const contextStr = JSON.stringify(context.map(r => ({ output: r.output, status: r.status })));
    const collaborationPrompt = `
    Task: ${task.toJSON().name}
    Description: ${task.toJSON().input.description || 'No description provided'}
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
      type: 'swarm',
      executorId: this._id,
      input: {
        name: 'Select Collaborative Agent',
        description: collaborationHint,
        prompt: collaborationHint
      },
      timeout: this._timeout,
      retryConfig: this._retryConfig
    });
    
    return this.selectAgentByCapability(selectionTask);
  }

  private calculateOptimalStepCount(previousSteps: TaskResult[]): number {
    // Base step count from configuration
    let optimalCount = Math.min(this._stepsPerPlan, this._maxLoops - this._currentPlanStep);
    
    if (previousSteps.length === 0) {
      return optimalCount; // Use default for initial planning
    }

    // Analyze previous execution patterns
    const recentSteps = previousSteps.slice(-3);
    const successRate = recentSteps.filter(step => step.status === TaskStatus.COMPLETED).length / recentSteps.length;
    const hasErrors = recentSteps.some(step => step.status === TaskStatus.FAILED);
    const hasTimeouts = recentSteps.some(step => step.status === TaskStatus.TIMEOUT);

    // Adjust step count based on execution patterns
    if (successRate < 0.5 || hasErrors) {
      optimalCount = Math.max(1, Math.floor(optimalCount * 0.5)); // Reduce steps on low success
    } else if (successRate > 0.8 && !hasTimeouts) {
      optimalCount = Math.min(this._maxLoops - this._currentPlanStep, optimalCount + 1); // Increase on high success
    }

    return optimalCount;
  }

  private analyzeExecutionContext(previousSteps: TaskResult[]): {
    progress: number;
    successRate: number;
    complexity: 'Low' | 'Medium' | 'High';
    challenges: string[];
  } {
    if (previousSteps.length === 0) {
      return {
        progress: 0,
        successRate: 100,
        complexity: 'Low',
        challenges: []
      };
    }

    const totalSteps = this._maxLoops;
    const completedSteps = previousSteps.length;
    const successfulSteps = previousSteps.filter(step => step.status === TaskStatus.COMPLETED).length;
    
    const challenges: string[] = [];
    const recentSteps = previousSteps.slice(-3);
    
    // Identify patterns and challenges
    if (recentSteps.some(step => step.status === TaskStatus.FAILED)) {
      challenges.push('Recent execution failures');
    }
    if (recentSteps.some(step => step.status === TaskStatus.TIMEOUT)) {
      challenges.push('Performance bottlenecks');
    }
    if (recentSteps.every(step => step.status === TaskStatus.COMPLETED && step.duration && step.duration > this._timeout * 0.8)) {
      challenges.push('Approaching timeout thresholds');
    }

    // Determine complexity based on patterns
    let complexity: 'Low' | 'Medium' | 'High' = 'Low';
    if (challenges.length > 0 || successfulSteps / completedSteps < 0.7) {
      complexity = 'High';
    } else if (challenges.length > 0 || successfulSteps / completedSteps < 0.85) {
      complexity = 'Medium';
    }

    return {
      progress: Math.round((completedSteps / totalSteps) * 100),
      successRate: Math.round((successfulSteps / completedSteps) * 100),
      complexity,
      challenges
    };
  }

  private analyzeStepImpact(step: TaskResult): string {
    if (step.status !== TaskStatus.COMPLETED) {
      return 'No positive impact - step failed';
    }

    const output = typeof step.output === 'string' ? step.output : JSON.stringify(step.output);
    const impactIndicators = {
      dataGeneration: output.includes('generated') || output.includes('created'),
      transformation: output.includes('transformed') || output.includes('converted'),
      analysis: output.includes('analyzed') || output.includes('evaluated'),
      decision: output.includes('decided') || output.includes('selected')
    };

    const impacts = Object.entries(impactIndicators)
      .filter(([_, value]) => value)
      .map(([key]) => key);

    return impacts.length > 0
      ? `Positive impact in: ${impacts.join(', ')}`
      : 'Minimal impact - maintenance step';
  }

  private identifyDependencies(step: TaskResult, allSteps: TaskResult[]): string {
    const stepIndex = allSteps.indexOf(step);
    if (stepIndex <= 0) return 'No dependencies';

    const previousSteps = allSteps.slice(0, stepIndex);
    const dependencies: string[] = [];

    // Analyze output patterns for dependencies
    const output = typeof step.output === 'string' ? step.output : JSON.stringify(step.output);
    previousSteps.forEach((prevStep, index) => {
      const prevStepOutput = typeof prevStep.output === 'string' ? prevStep.output : JSON.stringify(prevStep.output);
      if (output.includes(prevStepOutput) || this.hasDataDependency(output, prevStepOutput)) {
        dependencies.push(`Step ${index + 1}`);
      }
    });

    return dependencies.length > 0
      ? `Depends on: ${dependencies.join(', ')}`
      : 'Independent step';
  }

  private hasDataDependency(current: string, previous: string): boolean {
    // Simple heuristic for data dependency detection
    const previousData = previous.match(/"[^"]+"|'[^']+'|\b\w+\b/g) || [];
    return previousData.some(data =>
      current.includes(data) &&
      data.length > 3 && // Ignore common short words
      !['the', 'and', 'for', 'with'].includes(data.toLowerCase())
    );
  }

  private async collaborativeSolve(taskInput: string, intermediateResults: TaskResult[]): Promise<TaskResult> {
    const task = new Task({
      type: 'swarm',
      executorId: this._id,
      input: {
        name: 'Collaborative Solution',
        description: `Synthesize solution for: ${taskInput}`,
        prompt: `
# Collaborative Solution Synthesis System
You are a specialized system for synthesizing solutions from multiple agent contributions.

## Task Context
Primary Task: ${taskInput}
Number of Contributors: ${intermediateResults.length}
Current Progress Stage: ${intermediateResults.length} iterations completed

## Intermediate Results
${intermediateResults.map((r, i) => `
Agent ${i + 1} Output:
${JSON.stringify(r.output, null, 2)}
Status: ${r.status}
`).join('\n')}

## Synthesis Requirements
1. Solution Integration (40%)
 - Combine successful approaches
 - Identify common patterns
 - Leverage complementary insights
 - Maintain solution coherence

2. Conflict Resolution (30%)
 - Identify contradictions
 - Resolve inconsistencies
 - Harmonize different approaches
 - Establish consensus points

3. Optimization (30%)
 - Identify efficiency gains
 - Remove redundancies
 - Enhance effectiveness
 - Streamline solution

## Validation Criteria
1. Completeness
 - All key aspects addressed
 - No critical gaps
 - Comprehensive coverage

2. Consistency
 - Internal logic sound
 - No contradictions
 - Unified approach

3. Effectiveness
 - Meets original objectives
 - Improves upon individual solutions
 - Practical and implementable

## Response Format
Provide a structured solution with:
1. Executive Summary
2. Integrated Approach
3. Key Improvements
4. Implementation Steps
5. Validation Points

Begin your synthesis:
      `
      },
      timeout: this._timeout,
      retryConfig: this._retryConfig
    });

    const selectedAgent = await this.selectAgentByCapability(task);
    if (!selectedAgent) {
      throw new Error('No agent available for collaborative solving');
    }

    // Update collaboration metrics
    this._metrics.collaboration.informationSharing++;

    task.setExecutor(selectedAgent);
    const result = await task.execute();

    // Update consensus metrics
    if (result.status === TaskStatus.COMPLETED) {
      this._metrics.collaboration.consensusRate = 
        (this._metrics.collaboration.consensusRate * this._metrics.collaboration.agentInteractions + 1) /
        (this._metrics.collaboration.agentInteractions + 1);
    }

    return result;
  }

  private async generateTextWithAgent(agent: AgentInterface, prompt: string): Promise<string> {
    if (!agent) {
      throw new Error('No agent available for text generation');
    }

    try {
      const task = new Task({
        type: 'agent',
        executorId: agent.id,
        input: {
          name: 'Generate Text',
          description: 'Generate text based on prompt',
          prompt: prompt
        },
        timeout: this._timeout,
        retryConfig: this._retryConfig
      });

      task.setExecutor(agent);
      const result = await task.execute();
      
      if (result.status !== TaskStatus.COMPLETED) {
        throw new Error(result.error || 'Text generation failed');
      }

      return typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
    } catch (error) {
      return this.fallbackTextGeneration(prompt);
    }
  }

  private fallbackTextGeneration(prompt: string): string {
    const lines = prompt.split('\n');
    const keyPoints = lines
      .filter(line => line.trim().length > 0)
      .map(line => line.trim())
      .slice(0, 3)
      .join(' ');
    
    return `Generated response based on: ${keyPoints}`;
  }

  private isTaskComplete(result: TaskResult): boolean {
    if (!result) return false;
    if (result.status !== TaskStatus.COMPLETED) return false;
    return result.output !== null && result.output !== undefined;
  }

  private updateMetrics(agentName: string, result: TaskResult, startTime: number): void {
    const agentMetrics = this._agentPerformance[agentName];
    if (!agentMetrics) return;

    // Update agent-specific metrics
    agentMetrics.tasksHandled++;
    
    if (result.status === TaskStatus.COMPLETED) {
      agentMetrics.successRate = (agentMetrics.successRate * (agentMetrics.tasksHandled - 1) + 1) / agentMetrics.tasksHandled;
    } else {
      agentMetrics.successRate = (agentMetrics.successRate * (agentMetrics.tasksHandled - 1)) / agentMetrics.tasksHandled;
    }

    if (result.duration) {
      const weight = 0.1;
      agentMetrics.averageExecutionTime = (1 - weight) * agentMetrics.averageExecutionTime + weight * result.duration;
    }

    if (result.metrics?.retryCount) {
      agentMetrics.retryCount += result.metrics.retryCount;
      this._metrics.health.retryRate = this.calculateRetryRate();
    }

    if (result.status === TaskStatus.TIMEOUT) {
      agentMetrics.timeoutCount++;
      this._metrics.health.timeoutRate = this.calculateTimeoutRate();
    }

    // Update swarm-wide metrics
    this._metrics.efficiency.taskCompletionRate = this.calculateTaskCompletionRate();
    this._metrics.efficiency.resourceUtilization = this.calculateResourceUtilization();
    this._metrics.efficiency.loadBalance = this.calculateLoadBalance();
    this._metrics.health.activeAgents = this.calculateActiveAgents();
  }

  private updateFinalMetrics(result: TaskResult, startTime: number): void {
    const duration = Date.now() - startTime;
    
    // Update recovery time if there were retries
    if (result.metrics?.retryCount) {
      this._metrics.health.recoveryTime = 
        (this._metrics.health.recoveryTime * this._metrics.health.retryRate + duration) /
        (this._metrics.health.retryRate + 1);
    }

    this.emit('metricsUpdated', this._metrics);
  }

  private calculateTaskCompletionRate(): number {
    const totalTasks = Object.values(this._agentPerformance)
      .reduce((sum, metrics) => sum + metrics.tasksHandled, 0);
    
    const successfulTasks = Object.values(this._agentPerformance)
      .reduce((sum, metrics) => sum + metrics.tasksHandled * metrics.successRate, 0);
    
    return totalTasks > 0 ? successfulTasks / totalTasks : 1;
  }

  private calculateResourceUtilization(): number {
    const now = Date.now();
    const recentThreshold = 5 * 60 * 1000; // 5 minutes
    
    const activeAgents = Object.values(this._agentPerformance)
      .filter(metrics => now - metrics.lastInteraction < recentThreshold).length;
    
    return activeAgents / this._agents.length;
  }

  private calculateLoadBalance(): number {
    const tasksHandled = Object.values(this._agentPerformance)
      .map(metrics => metrics.tasksHandled);
    
    if (tasksHandled.length === 0) return 1;
    
    const average = tasksHandled.reduce((sum, count) => sum + count, 0) / tasksHandled.length;
    const variance = tasksHandled.reduce((sum, count) => sum + Math.pow(count - average, 2), 0) / tasksHandled.length;
    
    return 1 / (1 + Math.sqrt(variance));
  }

  private calculateActiveAgents(): number {
    const now = Date.now();
    const recentThreshold = 5 * 60 * 1000; // 5 minutes
    
    return Object.values(this._agentPerformance)
      .filter(metrics => now - metrics.lastInteraction < recentThreshold).length;
  }

  private calculateRetryRate(): number {
    const totalTasks = Object.values(this._agentPerformance)
      .reduce((sum, metrics) => sum + metrics.tasksHandled, 0);
    
    const totalRetries = Object.values(this._agentPerformance)
      .reduce((sum, metrics) => sum + metrics.retryCount, 0);
    
    return totalTasks > 0 ? totalRetries / totalTasks : 0;
  }

  private calculateTimeoutRate(): number {
    const totalTasks = Object.values(this._agentPerformance)
      .reduce((sum, metrics) => sum + metrics.tasksHandled, 0);
    
    const totalTimeouts = Object.values(this._agentPerformance)
      .reduce((sum, metrics) => sum + metrics.timeoutCount, 0);
    
    return totalTasks > 0 ? totalTimeouts / totalTasks : 0;
  }

  // Public API
  get metrics(): SwarmMetrics {
    return { ...this._metrics };
  }

  get agentPerformance(): typeof this._agentPerformance {
    return { ...this._agentPerformance };
  }

  addAgent(agent: AgentInterface): void {
    this._agents.push(agent);
    this._agentPerformance[agent.name] = {
      tasksHandled: 0,
      successRate: 1.0,
      averageExecutionTime: 0,
      retryCount: 0,
      timeoutCount: 0,
      lastInteraction: Date.now()
    };
    this.emit('agentAdded', { agentId: agent.id, agentName: agent.name });
  }

  removeAgent(agentName: string): void {
    this._agents = this._agents.filter(agent => agent.name !== agentName);
    // Keep the metrics for historical reference
    this.emit('agentRemoved', { agentName });
  }

  async optimize(): Promise<void> {
    // Implement swarm optimization logic here
    // This could include:
    // 1. Rebalancing agent workloads
    // 2. Adjusting collaboration thresholds
    // 3. Updating routing strategies
    // 4. Pruning underperforming agents
    this.emit('optimizationCompleted', this._metrics);
  }
}