import { Model } from 'sequelize';
import { sequelize } from '../index';
import { SwarmConfig } from '../types';

// Attributes interface for Swarm model
export interface SwarmAttributes {
  id: string;
  name: string;
  description?: string;
  config: SwarmConfig;
  status: 'active' | 'idle' | 'error';
  lastExecutionTime?: Date;
  metrics: {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    averageResponseTime: number;
    activeAgents: number;
    totalAgents: number;
    taskDistribution: Record<string, number>;
    lastExecutionTime?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Creation attributes interface (omit auto-generated fields)
export interface SwarmCreationAttributes extends Omit<SwarmAttributes, 'id' | 'metrics' | 'status' | 'createdAt' | 'updatedAt'> {}

// Model interface
interface SwarmModel extends Model<SwarmAttributes, SwarmCreationAttributes>, SwarmAttributes {}

const Swarm = sequelize.define(
  'Swarm',
  {
    id: {
      type: sequelize.Sequelize.UUID,
      defaultValue: sequelize.Sequelize.literal('UUID()'),
      primaryKey: true,
    },
    name: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
    },
    description: {
      type: sequelize.Sequelize.TEXT,
      allowNull: true,
    },
    config: {
      type: sequelize.Sequelize.JSONB,
      allowNull: false,
    },
    status: {
      type: sequelize.Sequelize.ENUM('active', 'idle', 'error'),
      allowNull: false,
      defaultValue: 'idle',
    },
    lastExecutionTime: {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    },
    metrics: {
      type: sequelize.Sequelize.JSONB,
      allowNull: false,
      defaultValue: {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        averageResponseTime: 0,
        activeAgents: 0,
        totalAgents: 0,
        taskDistribution: {},
      },
    },
    createdAt: {
      type: sequelize.Sequelize.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: sequelize.Sequelize.DATE,
      allowNull: false,
    },
  },
  {
    tableName: 'swarms',
    timestamps: true,
    indexes: [
      {
        fields: ['status'],
      },
      {
        fields: ['lastExecutionTime'],
      },
      {
        fields: ['name'],
      },
    ],
  }
) as unknown as (new () => SwarmModel) & typeof Model;

// Add instance methods
(Swarm as any).prototype.updateMetrics = async function(success: boolean, duration: number, agentId: string): Promise<void> {
  const oldMetrics = this.metrics;
  const totalTasks = oldMetrics.totalTasks + 1;
  const successfulTasks = success ? oldMetrics.successfulTasks + 1 : oldMetrics.successfulTasks;
  const failedTasks = success ? oldMetrics.failedTasks : oldMetrics.failedTasks + 1;
  
  // Calculate new average response time
  const oldTotal = oldMetrics.averageResponseTime * (totalTasks - 1);
  const averageResponseTime = (oldTotal + duration) / totalTasks;

  // Update task distribution
  const taskDistribution = { ...oldMetrics.taskDistribution };
  taskDistribution[agentId] = (taskDistribution[agentId] || 0) + 1;

  this.metrics = {
    ...oldMetrics,
    totalTasks,
    successfulTasks,
    failedTasks,
    averageResponseTime,
    taskDistribution,
    lastExecutionTime: new Date().toISOString()
  };

  await this.save();
};

// Add associations
(Swarm as any).associate = function(models: any) {
  Swarm.belongsToMany(models.Agent, {
    through: models.AgentSwarm,
    foreignKey: 'swarmId',
    as: 'agents',
  });
  Swarm.hasMany(models.TaskExecution, {
    foreignKey: 'swarmId',
    as: 'taskExecutions',
  });
};

export { Swarm, SwarmModel };
export default Swarm;