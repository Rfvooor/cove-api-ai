import { AgentInterface } from './agent.js';
import { ToolSchemaType } from './tool.js';
import { randomUUID } from 'crypto';

export interface TaskInput {
  name?: string;
  description?: string;
  prompt: string;
  data?: any;
  tools?: ToolSchemaType[];
  metadata?: Record<string, any>;
  images?: string[];
}

export interface TaskConfig {
  type: 'agent' | 'swarm';
  executorId: string;
  input: TaskInput;
  context?: Record<string, any>;
  attachments?: Array<{
    name: string;
    content: string;
    type: string;
  }>;
  timeout?: number;
  priority?: 'low' | 'medium' | 'high';
  retryConfig?: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay?: number;
    maxDelay?: number;
  };
}

export interface TaskResult {
  id: string;
  status: TaskStatus;
  output?: any;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  metrics?: {
    tokenCount?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
    retryCount?: number;
    totalRetryDelay?: number;
  };
}

export const TaskStatus = {
  PENDING: 'pending' as const,
  RUNNING: 'running' as const,
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
  CANCELLED: 'cancelled' as const,
  TIMEOUT: 'timeout' as const
};

export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

export interface TaskWithInput {
  id: string;
  type: 'agent' | 'swarm';
  executorId?: string;
  input: TaskInput;
  context?: Record<string, any>;
  attachments?: Array<{
    name: string;
    content: string;
    type: string;
  }>;
  timeout?: number;
  priority?: 'low' | 'medium' | 'high';
  retryConfig?: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay?: number;
    maxDelay?: number;
  };
  status: TaskStatus;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
  name?: string;
}

export class Task {
  public readonly id: string;
  private config: TaskConfig;
  private executor?: AgentInterface;
  private status: TaskStatus = TaskStatus.PENDING;
  private startTime?: Date;
  private endTime?: Date;
  private result?: any;
  private error?: string;
  private retryCount: number = 0;
  private totalRetryDelay: number = 0;
  private timeoutHandle?: NodeJS.Timeout;

  constructor(config: TaskConfig) {
    this.id = randomUUID();
    this.config = {
      timeout: 30000,
      priority: 'medium',
      retryConfig: {
        maxAttempts: 3,
        backoffMultiplier: 1.5,
        initialDelay: 1000,
        maxDelay: 30000
      },
      ...config
    };
  }

  setExecutor(executor: AgentInterface): void {
    this.executor = executor;
  }

  async execute(): Promise<TaskResult> {
    if (!this.executor) {
      throw new Error('No executor assigned to task');
    }

    try {
      this.status = TaskStatus.RUNNING;
      this.startTime = new Date();

      // Set timeout if configured
      if (this.config.timeout) {
        this.timeoutHandle = setTimeout(() => {
          this.handleTimeout();
        }, this.config.timeout);
      }

      const result = await this.executeWithRetry();

      // Clear timeout if execution completed successfully
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
      }

      this.status = TaskStatus.COMPLETED;
      this.result = result;
      this.endTime = new Date();

      return this.getTaskResult();
    } catch (error) {
      // Clear timeout if execution failed
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
      }

      this.status = TaskStatus.FAILED;
      this.error = error instanceof Error ? error.message : String(error);
      this.endTime = new Date();
      
      return this.getTaskResult();
    }
  }

  private async executeWithRetry(attempt = 1): Promise<any> {
    try {
      if (!this.executor) {
        throw new Error('No executor assigned to task');
      }

      // Prepare execution context
      const executionContext = {
        ...this.config.context,
        attempt,
        maxAttempts: this.config.retryConfig?.maxAttempts ?? 3,
        taskId: this.id,
        startTime: this.startTime
      };

      // Execute task with context
      const result = await this.executor.execute(this);

      return result;
    } catch (error) {
      const retryConfig = this.config.retryConfig;
      const maxAttempts = retryConfig?.maxAttempts ?? 3;
      const backoffMultiplier = retryConfig?.backoffMultiplier ?? 1.5;
      const initialDelay = retryConfig?.initialDelay ?? 1000;
      const maxDelay = retryConfig?.maxDelay ?? 30000;

      if (attempt < maxAttempts) {
        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, attempt - 1),
          maxDelay
        );

        this.retryCount++;
        this.totalRetryDelay += delay;

        // Wait for the calculated delay
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry execution
        return this.executeWithRetry(attempt + 1);
      }

      throw error;
    }
  }

  private handleTimeout(): void {
    this.status = TaskStatus.TIMEOUT;
    this.error = `Task execution timed out after ${this.config.timeout}ms`;
    this.endTime = new Date();

    // Reject any pending promises or cleanup
    if (this.executor) {
      // Notify executor of timeout
      this.executor.cleanup?.();
    }
  }

  private getTaskResult(): TaskResult {
    if (!this.startTime) {
      throw new Error('Task has not been started');
    }

    const result: TaskResult = {
      id: this.id,
      status: this.status,
      startedAt: this.startTime,
      completedAt: this.endTime,
      duration: this.endTime ? this.endTime.getTime() - this.startTime.getTime() : undefined,
      metrics: {
        retryCount: this.retryCount,
        totalRetryDelay: this.totalRetryDelay
      }
    };

    if (this.result) {
      result.output = this.result;
      
      // Add execution metrics if available
      if (typeof this.result === 'object' && this.result !== null) {
        const { completionTokens, promptTokens, tokenCount, cost } = this.result;
        result.metrics = {
          ...result.metrics,
          completionTokens,
          promptTokens,
          tokenCount,
          cost,
          totalTokens: (completionTokens ?? 0) + (promptTokens ?? 0)
        };
      }
    }

    if (this.error) {
      result.error = this.error;
    }

    return result;
  }

  getStatus(): TaskStatus {
    return this.status;
  }

  getExecutorId(): string {
    return this.config.executorId;
  }

  cancel(): void {
    if (this.status === TaskStatus.RUNNING || this.status === TaskStatus.PENDING) {
      this.status = TaskStatus.CANCELLED;
      this.endTime = new Date();

      // Clear timeout if it exists
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
      }

      // Cleanup executor if it exists
      if (this.executor) {
        this.executor.cleanup?.();
      }
    }
  }

  toJSON(): TaskWithInput {
    return {
      id: this.id,
      type: this.config.type,
      input: this.config.input,
      context: this.config.context,
      attachments: this.config.attachments,
      timeout: this.config.timeout,
      priority: this.config.priority,
      retryConfig: this.config.retryConfig,
      status: this.status,
      startedAt: this.startTime,
      completedAt: this.endTime,
      duration: this.endTime && this.startTime ? this.endTime.getTime() - this.startTime.getTime() : undefined,
      error: this.error,
      name: this.config.input.name
    };
  }
}