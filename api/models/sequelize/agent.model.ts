import { Model } from 'sequelize';
import { sequelize } from '../index';
import { AgentConfig, AgentMetrics, agentConfigSchema } from '../types';

// Attributes interface for Agent model
export interface AgentAttributes {
  id: string;
  name: string;
  description?: string;
  config: AgentConfig;
  metrics: AgentMetrics;
  status: 'active' | 'idle' | 'error';
  lastExecutionTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Creation attributes interface (omit auto-generated fields)
export interface AgentCreationAttributes extends Omit<AgentAttributes, 'id' | 'metrics' | 'status' | 'createdAt' | 'updatedAt'> {}

// Model interface
interface AgentModel extends Model<AgentAttributes, AgentCreationAttributes>, AgentAttributes {}

const Agent = sequelize.define(
  'Agent',
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
      validate: {
        isValidConfig(value: AgentConfig) {
          try {
            agentConfigSchema.parse(value);
            return true;
          } catch (error) {
            throw new Error('Invalid agent configuration');
          }
        },
      },
    },
    metrics: {
      type: sequelize.Sequelize.JSONB,
      allowNull: false,
      defaultValue: {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        averageResponseTime: 0,
      },
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
    tableName: 'agents',
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
) as unknown as (new () => AgentModel) & typeof Model;

// Add instance methods
(Agent as any).prototype.updateMetrics = async function(success: boolean, duration: number): Promise<void> {
  const oldMetrics = this.metrics;
  const totalTasks = oldMetrics.totalTasks + 1;
  const successfulTasks = success ? oldMetrics.successfulTasks + 1 : oldMetrics.successfulTasks;
  const failedTasks = success ? oldMetrics.failedTasks : oldMetrics.failedTasks + 1;
  
  // Calculate new average response time
  const oldTotal = oldMetrics.averageResponseTime * (totalTasks - 1);
  const averageResponseTime = (oldTotal + duration) / totalTasks;

  this.metrics = {
    totalTasks,
    successfulTasks,
    failedTasks,
    averageResponseTime,
    lastExecutionTime: new Date().toISOString()
  };

  await this.save();
};

// Add associations
(Agent as any).associate = function(models: any) {
  Agent.belongsToMany(models.Swarm, {
    through: models.AgentSwarm,
    foreignKey: 'agentId',
    as: 'swarms',
  });
  Agent.hasMany(models.TaskExecution, {
    foreignKey: 'agentId',
    as: 'taskExecutions',
  });
};

export { Agent, AgentModel };
export default Agent;