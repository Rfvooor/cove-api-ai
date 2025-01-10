export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface TaskInput {
  prompt: string;
  images?: string[];
  metadata?: Record<string, any>;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority?: number;
  dependencies?: string[];
  metadata?: Record<string, any>;
  input?: TaskInput;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}