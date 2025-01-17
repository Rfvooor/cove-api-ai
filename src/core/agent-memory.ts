import { Memory, MemoryConfig, MemoryEntry } from './memory.js';
import { TaskResult } from './task.js';

export class AgentMemoryManager {
  private memory: Memory;

  constructor(memory: Memory) {
    this.memory = memory;
  }

  async remember(
    content: string,
    type: MemoryEntry['type'] = 'message',
    metadata?: Record<string, any>
  ): Promise<string> {
    return await this.memory.add({
      content,
      type,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  async storePlan(taskId: string, steps: string[]): Promise<string> {
    return await this.remember(
      `Generated execution plan for task ${taskId}:\n${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`,
      'system',
      {
        type: 'execution_plan',
        taskId,
        plan: steps,
        totalSteps: steps.length
      }
    );
  }

  async storeStepStart(
    taskId: string,
    step: string,
    stepNumber: number,
    totalSteps: number
  ): Promise<string> {
    return await this.remember(
      `Starting step ${stepNumber}/${totalSteps}: ${step}`,
      'system',
      {
        type: 'step_execution',
        taskId,
        step,
        stepNumber,
        totalSteps,
        status: 'started'
      }
    );
  }

  async storeStepCompletion(
    taskId: string,
    step: string,
    stepNumber: number,
    totalSteps: number,
    result: TaskResult
  ): Promise<string> {
    return await this.remember(
      `Step ${stepNumber} completed: ${step}`,
      'task',
      {
        type: 'step_execution',
        taskId,
        step,
        stepNumber,
        totalSteps,
        output: result.output,
        status: result.status,
        metrics: {
          executionTime: result.duration,
          error: result.error
        }
      }
    );
  }

  async storeTaskCompletion(
    taskId: string,
    result: TaskResult,
    summary: Record<string, any>
  ): Promise<string> {
    return await this.remember(
      `Task completed: ${taskId}\n\nExecution Summary:\n${JSON.stringify(summary, null, 2)}`,
      'result',
      {
        type: 'task_completion',
        taskId,
        output: result.output,
        status: result.status,
        summary,
        metrics: {
          executionTime: result.duration,
          error: result.error
        }
      }
    );
  }

  async storeTaskError(
    taskId: string,
    error: Error | string,
    context?: Record<string, any>
  ): Promise<string> {
    return await this.remember(
      `Task failed: ${error instanceof Error ? error.message : error}`,
      'error',
      {
        type: 'task_error',
        taskId,
        error: error instanceof Error ? error.toString() : error,
        context,
        timestamp: new Date().toISOString()
      }
    );
  }

  async clear(): Promise<void> {
    await this.memory.clear();
  }

  async persist(): Promise<void> {
    await this.memory.persist();
  }
}