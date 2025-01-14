import { AgentInterface, TaskExecutionResult } from './types/interfaces.js';
import { Task, TaskResult, TaskStatus } from './task.js';
import { Memory, MemoryEntry } from './memory.js';
import { RetryConfig } from './types/workflow.js';
import { AgentActionPlan, AgentTaskAnalysis, AgentSelectionResult } from './types/agent.js';
import { EventEmitter } from 'events';

export class AgenticExecutor extends EventEmitter {
  private _memory: Memory;
  private _orchestrator: AgentInterface;
  private _agents: AgentInterface[];
  private _maxLoops: number;
  private _collaborationThreshold: number;
  private _timeout: number;
  private _retryConfig: Required<RetryConfig>;
  private _intermediateResults: TaskResult[] = [];
  private _currentPlanStep: number = 0;

  constructor(
    memory: Memory,
    orchestrator: AgentInterface,
    agents: AgentInterface[],
    maxLoops: number,
    collaborationThreshold: number,
    timeout: number,
    retryConfig: Required<RetryConfig>
  ) {
    super();
    this._memory = memory;
    this._orchestrator = orchestrator;
    this._agents = agents;
    this._maxLoops = maxLoops;
    this._collaborationThreshold = collaborationThreshold;
    this._timeout = timeout;
    this._retryConfig = retryConfig;
  }

  async executeAgentic(taskInput: string, images: string[]): Promise<TaskResult> {
    const task = new Task({
      type: 'swarm',
      executorId: this._orchestrator.id,
      input: { name: taskInput, description: taskInput, prompt: taskInput, images },
      timeout: this._timeout,
      retryConfig: this._retryConfig
    });

    let currentLoops = 0;
    let finalResult: TaskResult | undefined;
    this._intermediateResults = [];

    while (currentLoops < this._maxLoops) {
      const selection = await this.selectBestAgentForTask(task, this._intermediateResults);
      if (!selection) {
        const result = await task.execute();
        result.status = TaskStatus.FAILED;
        result.error = 'No suitable agent found';
        result.output = null;
        return result;
      }

      const { agent, actionPlan } = selection;
      task.setExecutor(agent);

      // Execute each step in the action plan
      if (actionPlan) {
        for (const step of actionPlan.steps) {
          const taskConfig = task.toJSON();
          const stepTask = new Task({
            type: taskConfig.type,
            executorId: agent.id,
            input: {
              ...taskConfig.input,
              description: step
            },
            timeout: taskConfig.timeout,
            retryConfig: taskConfig.retryConfig
          });
          
          stepTask.setExecutor(agent);
          const stepResult = await stepTask.execute();
          this._intermediateResults.push(stepResult);

          if (stepResult.status === TaskStatus.FAILED) {
            // Try fallback actions if available
            const fallbackResult = await this.executeFallbackActions(
              agent,
              stepTask,
              actionPlan.fallbacks
            );
            if (fallbackResult.status === TaskStatus.FAILED) {
              return fallbackResult;
            }
            this._intermediateResults.push(fallbackResult);
          }
        }
      } else {
        // Fallback to direct execution if no action plan
        const result = await task.execute();
        this._intermediateResults.push(result);
      }

      const lastResult = this._intermediateResults[this._intermediateResults.length - 1];
      if (lastResult.status === TaskStatus.COMPLETED && this.isTaskComplete(lastResult)) {
        finalResult = lastResult;
        break;
      }

      currentLoops++;
    }

    if (!finalResult) {
      const result = await task.execute();
      result.status = TaskStatus.FAILED;
      result.error = `Task not completed within ${this._maxLoops} loops`;
      result.output = null;
      return result;
    }

    return finalResult;
  }

  private async selectBestAgentForTask(task: Task, context: TaskResult[]): Promise<AgentSelectionResult | undefined> {
    // First, let the orchestrator analyze task requirements
    const taskAnalysis = await this.analyzeTaskRequirements(task);
    
    // Use planning agent for analysis if available
    const planner = this._orchestrator;
    const rankedAgents = await Promise.all(
      this._agents.map(async (agent) => {
        // Calculate base score from capabilities
        const baseScore = await this.calculateAgentScore(agent, taskAnalysis);

        // Get action plan
        const plan = await this.createPlan(agent, task);
        const actionPlan = plan ? {
          steps: plan.steps,
          estimatedSteps: plan.estimatedSteps,
          fallbacks: plan.fallbacks
        } : undefined;

        return {
          agent,
          score: baseScore,
          actionPlan
        };
      })
    );

    // Filter out agents that couldn't create a valid action plan
    const validAgents = rankedAgents.filter(a => a.actionPlan !== undefined);
    
    // Sort by score and get best agent
    const bestMatch = validAgents.sort((a, b) => b.score - a.score)[0];
    if (!bestMatch || bestMatch.score === 0) return undefined;

    return {
      agent: bestMatch.agent,
      actionPlan: bestMatch.actionPlan,
      score: bestMatch.score
    };
  }

  private async analyzeTaskRequirements(task: Task): Promise<AgentTaskAnalysis> {
    const analysisPrompt = `# Task Analysis System

## Task Information
Original Query: ${task.toJSON().input.prompt}

## Analysis Requirements
Provide a detailed breakdown of task requirements and complexity.

## Response Format
Your response must contain these sections:

### Required Capabilities
[CAPABILITIES]
List of specific abilities needed, one per line
[/CAPABILITIES]

### Task Complexity
[COMPLEXITY]
Score (0-1) with justification
[/COMPLEXITY]

### Required Specializations
[SPECIALIZATIONS]
List of domain expertise needed, one per line
[/SPECIALIZATIONS]

### Required Actions
[ACTIONS]
List of concrete steps/operations, one per line
[/ACTIONS]

### Context Dependencies
[DEPENDENCIES]
List of required contextual information, one per line
[/DEPENDENCIES]

### Validation
[VALIDATION]
- Analysis complete: [yes/no]
- Requirements clear: [yes/no]
- Dependencies identified: [yes/no]
[/VALIDATION]

Provide your analysis below:`;

    try {
      const analysis = await this._orchestrator.getLanguageModel().generateText({ text: analysisPrompt });
      const [capabilities, complexity, specialization, actions, context] = analysis.text.split('\n');

      return {
        capabilities: capabilities.split(',').map(c => c.trim()),
        complexity: parseFloat(complexity) || 0,
        specialization: specialization.split(',').map(s => s.trim()),
        requiredActions: actions.split(',').map(a => a.trim()),
        contextDependencies: context.split(',').map(c => c.trim())
      };
    } catch (error) {
      console.warn('Task analysis failed:', error);
      return {
        capabilities: [],
        complexity: 0,
        specialization: [],
        requiredActions: [],
        contextDependencies: []
      };
    }
  }

  private async calculateAgentScore(agent: AgentInterface, requirements: AgentTaskAnalysis): Promise<number> {
    // Get agent's tools and capabilities
    const tools = agent.getTools();
    const toolNames = tools.map(t => t.name);
    
    // Capability match score (40%)
    const capabilityScore = requirements.capabilities.reduce((score, req) => {
      return score + (toolNames.some(tool => 
        tool.toLowerCase().includes(req.toLowerCase())
      ) ? 1 : 0);
    }, 0) / Math.max(1, requirements.capabilities.length);

    // Performance score (30%)
    const config = await agent.getConfiguration();
    const performanceScore = config.maxTokens ? config.maxTokens / 4096 : 0.5;

    // Specialization match score (30%)
    const specializationScore = requirements.specialization.reduce((score, req) => {
      return score + (config.description?.toLowerCase().includes(req.toLowerCase()) ? 1 : 0);
    }, 0) / Math.max(1, requirements.specialization.length);

    return (
      capabilityScore * 0.4 +
      performanceScore * 0.3 +
      specializationScore * 0.3
    );
  }

  private async createPlan(agent: AgentInterface, task: Task): Promise<AgentActionPlan | undefined> {
    const planningPrompt = `# Task Planning System

## Task Information
${task.toJSON().input.prompt}

## Available Tools
${agent.getTools().map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

## Planning Requirements
- Break down task into concrete steps
- Use available tools effectively
- Include error handling
- Consider fallback options

## Response Format
Your response must contain these sections:

### Execution Steps
[STEPS]
List steps one per line, using format:
"[Action] using [Tool] with {parameters}"
[/STEPS]

### Step Count
[COUNT]
Total number of steps
[/COUNT]

### Fallback Actions
[FALLBACKS]
List of fallback actions, one per line
[/FALLBACKS]

### Validation
[VALIDATION]
- Steps valid: [yes/no]
- Tools available: [yes/no]
- Fallbacks defined: [yes/no]
[/VALIDATION]

Provide your plan below:`;

    try {
      const planResult = await agent.getLanguageModel().generateText({ text: planningPrompt });
      
      // Extract sections using regex
      const stepsMatch = planResult.text.match(/\[STEPS\]([\s\S]*?)\[\/STEPS\]/);
      const countMatch = planResult.text.match(/\[COUNT\]([\s\S]*?)\[\/COUNT\]/);
      const fallbacksMatch = planResult.text.match(/\[FALLBACKS\]([\s\S]*?)\[\/FALLBACKS\]/);
      const validationMatch = planResult.text.match(/\[VALIDATION\]([\s\S]*?)\[\/VALIDATION\]/);

      // Validate plan
      const validationPassed = validationMatch &&
        validationMatch[1].includes('Steps valid: yes') &&
        validationMatch[1].includes('Tools available: yes');

      if (!validationPassed) {
        console.warn('Plan validation warnings detected');
      }

      // Parse sections
      const steps = stepsMatch
        ? stepsMatch[1].split('\n').map(s => s.trim()).filter(Boolean)
        : [];

      const estimatedSteps = countMatch
        ? parseInt(countMatch[1].trim()) || 1
        : 1;

      const fallbacks = fallbacksMatch
        ? fallbacksMatch[1].split('\n').map(f => f.trim()).filter(Boolean)
        : [];

      return {
        steps,
        estimatedSteps,
        fallbacks
      };
    } catch (error) {
      console.warn('Planning failed:', error);
      return undefined;
    }
  }

  private async executeFallbackActions(
    agent: AgentInterface,
    task: Task,
    fallbacks: string[]
  ): Promise<TaskResult> {
    for (const fallback of fallbacks) {
      const taskConfig = task.toJSON();
      const fallbackTask = new Task({
        type: taskConfig.type,
        executorId: agent.id,
        input: {
          ...taskConfig.input,
          description: fallback
        },
        timeout: taskConfig.timeout,
        retryConfig: taskConfig.retryConfig
      });

      fallbackTask.setExecutor(agent);
      const result = await fallbackTask.execute();
      
      if (result.status === TaskStatus.COMPLETED) {
        return result;
      }
    }

    return {
      id: task.id,
      status: TaskStatus.FAILED,
      error: 'All fallback actions failed',
      output: null,
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 0
    };
  }

  private isTaskComplete(result: TaskResult): boolean {
    return result.status === TaskStatus.COMPLETED && result.output !== null;
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
        timestamp: new Date().toISOString()
      }
    });
  }
}