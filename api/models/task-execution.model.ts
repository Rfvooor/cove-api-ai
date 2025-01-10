import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../database/config.js';

export interface TaskExecutionAttributes {
  id: string;
  type: 'agent' | 'swarm';
  executorId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  input: any;
  output?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}

class TaskExecution extends Model<TaskExecutionAttributes> implements TaskExecutionAttributes {
  public id!: string;
  public type!: 'agent' | 'swarm';
  public executorId!: string;
  public status!: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  public input!: any;
  public output?: any;
  public error?: string;
  public startedAt?: Date;
  public completedAt?: Date;
  public duration?: number;
  public createdAt!: Date;
  public updatedAt!: Date;
}

TaskExecution.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM('agent', 'swarm'),
      allowNull: false,
    },
    executorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    input: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    output: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    }
  },
  {
    sequelize,
    modelName: 'TaskExecution',
    tableName: 'task_executions',
    timestamps: true,
  }
);

export { TaskExecution };