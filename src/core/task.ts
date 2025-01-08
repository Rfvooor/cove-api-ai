import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 1,
  MEDIUM = 5,
  HIGH = 10,
  CRITICAL = 15
}

export interface TaskDependency {
  taskId: string;
  type: 'prerequisite' | 'blocking';
}

export interface TaskMetadata {
  [key: string]: any;
}

export interface TaskConfig {
  id?: string;
  name: string;
  description?: string;
  priority?: TaskPriority;
  dependencies?: TaskDependency[];
  timeout?: number;
  retryAttempts?: number;
  metadata?: TaskMetadata;
}

export interface TaskResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class Task extends EventEmitter {
  public readonly id: string;
  public readonly name: string;
  public readonly description?: string;
  public readonly priority: TaskPriority;
  public readonly dependencies: TaskDependency[];
  public readonly timeout: number;
  public readonly retryAttempts: number;
  public readonly metadata: TaskMetadata;

  private _status: TaskStatus = TaskStatus.PENDING;
  private _result?: TaskResult;
  private _startTime?: number;
  private _endTime?: number;
  private _currentAttempt = 0;

  constructor(config: TaskConfig) {
    super();

    this.id = config.id || uuidv4();
    this.name = config.name;
    this.description = config.description;
    this.priority = config.priority || TaskPriority.MEDIUM;
    this.dependencies = config.dependencies || [];
    this.timeout = config.timeout || 30000; // 30 seconds default
    this.retryAttempts = config.retryAttempts || 3;
    this.metadata = config.metadata || {};

    this.on('status', this.handleStatusChange.bind(this));
  }

  get status(): TaskStatus {
    return this._status;
  }

  get result(): TaskResult | undefined {
    return this._result;
  }

  get duration(): number | undefined {
    if (!this._startTime) return undefined;
    return (this._endTime || Date.now()) - this._startTime;
  }

  async execute(executor: (task: Task) => Promise<TaskResult>): Promise<TaskResult> {
    if (this._status !== TaskStatus.PENDING) {
      throw new Error(`Cannot execute task in ${this._status} state`);
    }

    this.emit('status', TaskStatus.RUNNING);
    this._startTime = Date.now();
    this._currentAttempt++;

    try {
      const result = await this.runWithTimeout(executor);
      this._result = result;
      this._endTime = Date.now();
      this.emit('status', result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED);
      return result;
    } catch (error) {
      this._result = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      this._endTime = Date.now();
      this.emit('status', TaskStatus.FAILED);

      if (this._currentAttempt < this.retryAttempts) {
        return this.execute(executor);
      }

      return this._result;
    }
  }

  pause(): void {
    if (this._status === TaskStatus.RUNNING) {
      this.emit('status', TaskStatus.PAUSED);
    }
  }

  resume(executor: (task: Task) => Promise<TaskResult>): Promise<TaskResult> {
    if (this._status === TaskStatus.PAUSED) {
      return this.execute(executor);
    }
    throw new Error('Task is not in a pausable state');
  }

  cancel(): void {
    if (this._status === TaskStatus.RUNNING || this._status === TaskStatus.PAUSED) {
      this.emit('status', TaskStatus.CANCELLED);
    }
  }

  private async runWithTimeout(executor: (task: Task) => Promise<TaskResult>): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Task execution timed out'));
      }, this.timeout);

      executor(this)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private handleStatusChange(newStatus: TaskStatus): void {
    switch (newStatus) {
      case TaskStatus.RUNNING:
        this.emit('taskStarted', this);
        break;
      case TaskStatus.COMPLETED:
        this.emit('taskCompleted', this);
        break;
      case TaskStatus.FAILED:
        this.emit('taskFailed', this);
        break;
      case TaskStatus.PAUSED:
        this.emit('taskPaused', this);
        break;
      case TaskStatus.CANCELLED:
        this.emit('taskCancelled', this);
        break;
    }
  }

  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      status: this._status,
      priority: this.priority,
      result: this._result,
      duration: this.duration,
      metadata: this.metadata
    };
  }
}

export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();

  addTask(task: Task): void {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task with id ${task.id} already exists`);
    }

    this.tasks.set(task.id, task);
    this.updateDependencyGraph(task);
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  removeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      this.tasks.delete(taskId);
      this.cleanupDependencyGraph(taskId);
    }
  }

  async executeTasks(executor: (task: Task) => Promise<TaskResult>): Promise<Map<string, TaskResult>> {
    const results = new Map<string, TaskResult>();
    const tasksToExecute = this.getExecutableTasksInOrder();

    for (const task of tasksToExecute) {
      const canExecute = this.checkDependencies(task);
      if (canExecute) {
        const result = await task.execute(executor);
        results.set(task.id, result);
      }
    }

    return results;
  }

  private updateDependencyGraph(task: Task): void {
    for (const dependency of task.dependencies) {
      const dependencySet = this.dependencyGraph.get(dependency.taskId) || new Set();
      dependencySet.add(task.id);
      this.dependencyGraph.set(dependency.taskId, dependencySet);
    }
  }

  private cleanupDependencyGraph(taskId: string): void {
    this.dependencyGraph.delete(taskId);
    for (const dependents of this.dependencyGraph.values()) {
      dependents.delete(taskId);
    }
  }

  private checkDependencies(task: Task): boolean {
    return task.dependencies.every(dep => {
      const dependentTask = this.tasks.get(dep.taskId);
      if (!dependentTask) return false;

      switch (dep.type) {
        case 'prerequisite':
          return dependentTask.status === TaskStatus.COMPLETED;
        case 'blocking':
          return dependentTask.status !== TaskStatus.RUNNING;
        default:
          return false;
      }
    });
  }

  private getExecutableTasksInOrder(): Task[] {
    const tasks = Array.from(this.tasks.values());
    return tasks
      .filter(task => task.status === TaskStatus.PENDING)
      .sort((a, b) => b.priority - a.priority);
  }
}