import { AgentInterface, TaskExecutionResult } from './types/interfaces.js';
import { Task, TaskResult, TaskStatus } from './task.js';
import { Memory, MemoryEntry } from './memory.js';
import { StaticWorkflow, StaticWorkflowNode, RetryConfig } from './types/workflow.js';
import { EventEmitter } from 'events';

export class WorkflowExecutor extends EventEmitter {
  private _memory: Memory;
  private _orchestrator: AgentInterface;
  private _agents: AgentInterface[];
  private _timeout: number;
  private _retryConfig: Required<RetryConfig>;

  constructor(
    memory: Memory,
    orchestrator: AgentInterface,
    agents: AgentInterface[],
    timeout: number,
    retryConfig: Required<RetryConfig>
  ) {
    super();
    this._memory = memory;
    this._orchestrator = orchestrator;
    this._agents = agents;
    this._timeout = timeout;
    this._retryConfig = retryConfig;
  }

  async executeWorkflow(workflow: StaticWorkflow, taskInput: string, images: string[]): Promise<TaskResult> {
    const task = new Task({
      type: 'swarm',
      executorId: this._orchestrator.id,
      input: { name: taskInput, description: taskInput, prompt: taskInput, images },
      timeout: this._timeout,
      retryConfig: this._retryConfig
    });

    let currentNode = workflow.nodes[workflow.entryNode];
    const results: TaskResult[] = [];

    while (currentNode) {
      // Select agent based on node requirements
      const agent = await this.selectAgentForNode(currentNode);
      if (!agent) {
        const result = await task.execute();
        result.status = TaskStatus.FAILED;
        result.error = `No suitable agent found for node ${currentNode.id}`;
        return result;
      }

      // Execute node
      task.setExecutor(agent);
      const result = await this.executeNode(currentNode, task);
      results.push(result);

      // Handle node result
      if (result.status === TaskStatus.FAILED) {
        if (currentNode.config.fallbackNode) {
          currentNode = workflow.nodes[currentNode.config.fallbackNode];
          continue;
        }
        return result;
      }

      // Determine next node
      if (currentNode.type === 'decision') {
        const nextNodeId = await this.evaluateDecisionNode(currentNode, result, task);
        currentNode = workflow.nodes[nextNodeId];
      } else if (currentNode.next.length > 0) {
        currentNode = workflow.nodes[currentNode.next[0]];
      } else {
        break; // Reached an exit node
      }
    }

    // Synthesize final result
    return this.synthesizeResults(results, task);
  }

  private async selectAgentForNode(node: StaticWorkflowNode): Promise<AgentInterface | undefined> {
    if (!node.agentSelection) {
      return this._orchestrator; // Default to orchestrator if no selection criteria
    }

    // Direct agent selection by ID
    if (node.agentSelection.preferredAgentId) {
      const directAgent = this._agents.find(agent => agent.id === node.agentSelection!.preferredAgentId);
      if (directAgent) return directAgent;
    }

    // Direct agent selection by name
    if (node.agentSelection.preferredAgentName) {
      const directAgent = this._agents.find(agent => agent.name === node.agentSelection!.preferredAgentName);
      if (directAgent) return directAgent;
    }

    // Return first available agent that meets requirements
    return this._agents[0];
  }

  private async executeNode(node: StaticWorkflowNode, task: Task): Promise<TaskResult> {
    const nodeConfig = {
      timeout: node.config.timeout || this._timeout,
      retryStrategy: node.config.retryStrategy || this._retryConfig
    };

    try {
      const result = await task.execute();
      await this.remember(`Executed node ${node.id}`, 'task', {
        nodeId: node.id,
        duration: result.duration,
        status: result.status
      });
      return result;
    } catch (error) {
      console.error(`Error executing node ${node.id}:`, error);
      return this.createFailedTaskResult(
        task,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async evaluateDecisionNode(node: StaticWorkflowNode, result: TaskResult, task: Task): Promise<string> {
    if (node.next.length === 0) {
      throw new Error(`Decision node ${node.id} has no next nodes`);
    }

    const evaluationPrompt = `# Decision Node Evaluation

## Context
### Original Query
${task.toJSON().input.prompt}

### Current Result
\`\`\`json
${JSON.stringify(result.output, null, 2)}
\`\`\`

### Available Paths
${node.next.map(path => `- ${path}`).join('\n')}

## Requirements
- Select exactly one path
- Consider alignment with user intent
- Evaluate current execution state
- Assess path suitability

## Response Format
Your response must contain these sections:

### Selected Path
[PATH]
Chosen path name
[/PATH]

### Decision Reasoning
[REASONING]
- Alignment with user intent
- Current state consideration
- Expected outcome
[/REASONING]

### Validation
[VALIDATION]
- Path exists: [yes/no]
- Path suitable: [yes/no]
- Dependencies met: [yes/no]
[/VALIDATION]

Provide your decision below:`;

    try {
      const decision = await this._orchestrator.getLanguageModel().generateText({ text: evaluationPrompt });
      const selectedPath = node.next.find(path => decision.text.includes(path));
      return selectedPath || node.next[0]; // Default to first path if no match
    } catch (error) {
      console.warn('Decision evaluation failed, using default path:', error);
      return node.next[0];
    }
  }

  private async synthesizeResults(results: TaskResult[], task: Task): Promise<TaskResult> {
    if (results.length === 0) {
      throw new Error('No results to synthesize');
    }

    if (results.length === 1) {
      return results[0];
    }

    const synthesisPrompt = `
    Original user query: ${task.toJSON().input.prompt}
    
    Synthesize the following execution results into a coherent final output that addresses the original query:
    ${results.map((r, i) => `
    Result ${i + 1}:
    ${JSON.stringify(r.output)}
    `).join('\n')}
    
    Ensure the final output directly addresses the user's original intent.
    `;

    try {
      const synthesis = await this._orchestrator.getLanguageModel().generateText({ text: synthesisPrompt });
      const lastResult = results[results.length - 1];
      return {
        ...lastResult,
        output: synthesis.text,
        status: TaskStatus.COMPLETED
      };
    } catch (error) {
      console.error('Failed to synthesize results:', error);
      return results[results.length - 1]; // Return last result as fallback
    }
  }

  private createFailedTaskResult(task: Task, error: string): TaskResult {
    return {
      id: task.id,
      status: TaskStatus.FAILED,
      error,
      output: null,
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 0
    };
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