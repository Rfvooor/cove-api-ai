import { TaskResult } from './task.js';

export interface AgentMetrics {
  taskCount: number;
  successRate: number;
  averageExecutionTime: number;
  capabilities: AgentCapability[];
}

export interface AgentCapability {
  name: string;
  score: number;
  metadata?: Record<string, any>;
}

export class AgentMetricsTracker {
  private metrics: AgentMetrics;
  private readonly decayFactor: number = 0.1; // Weight for exponential moving average

  constructor() {
    this.metrics = {
      taskCount: 0,
      successRate: 1.0,
      averageExecutionTime: 0,
      capabilities: []
    };
  }

  updateMetrics(success: boolean, executionTime: number): void {
    this.metrics.taskCount++;
    this.metrics.successRate = (1 - this.decayFactor) * this.metrics.successRate + 
      (success ? 1 : 0) * this.decayFactor;
    this.metrics.averageExecutionTime = (1 - this.decayFactor) * this.metrics.averageExecutionTime + 
      executionTime * this.decayFactor;
  }

  updateCapabilities(capabilities: AgentCapability[]): void {
    this.metrics.capabilities = capabilities;
  }

  trackExecution(result: TaskResult, startTime: number): void {
    const executionTime = Date.now() - startTime;
    const success = result.status === 'completed';
    this.updateMetrics(success, executionTime);
  }

  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  getExecutionSummary(result: TaskResult, startTime: number): {
    executionTime: number;
    summary: Record<string, any>;
  } {
    const executionTime = Date.now() - startTime;
    return {
      executionTime,
      summary: {
        taskCount: this.metrics.taskCount + 1,
        successRate: this.metrics.successRate,
        averageExecutionTime: this.metrics.averageExecutionTime,
        currentExecutionTime: executionTime,
        status: result.status,
        output: result.output !== null ? 'present' : 'none',
        error: result.error || 'none'
      }
    };
  }

  getPerformanceReport(): string {
    return `
Agent Performance Report:
- Tasks Completed: ${this.metrics.taskCount}
- Success Rate: ${(this.metrics.successRate * 100).toFixed(1)}%
- Average Execution Time: ${this.metrics.averageExecutionTime.toFixed(0)}ms
- Capabilities: ${this.metrics.capabilities.map(c => c.name).join(', ')}
    `.trim();
  }
}