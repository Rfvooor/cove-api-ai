import { Model } from 'sequelize';
import { sequelize } from './index';
import { AgentSwarmAttributes, AgentSwarmCreationAttributes } from './types';

interface AgentSwarmModel extends Model<AgentSwarmAttributes, AgentSwarmCreationAttributes>, AgentSwarmAttributes {}

const AgentSwarm = sequelize.define(
    'AgentSwarm',
    {
        id: {
            type: sequelize.Sequelize.UUID,
            defaultValue: sequelize.Sequelize.literal('UUID()'),
            primaryKey: true
        },
        agentId: {
            type: sequelize.Sequelize.UUID,
            allowNull: false,
            references: {
                model: 'agents',
                key: 'id'
            }
        },
        swarmId: {
            type: sequelize.Sequelize.UUID,
            allowNull: false,
            references: {
                model: 'swarms',
                key: 'id'
            }
        },
        active: {
            type: sequelize.Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        priority: {
            type: sequelize.Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1,
            validate: {
                min: 1,
                max: 10
            }
        },
        role: {
            type: sequelize.Sequelize.STRING,
            allowNull: false,
            defaultValue: 'member'
        },
        capabilities: {
            type: sequelize.Sequelize.JSON,
            allowNull: false,
            defaultValue: []
        },
        config: {
            type: sequelize.Sequelize.JSON,
            allowNull: false,
            defaultValue: {
                priority: 1,
                role: 'member',
                capabilities: [],
                constraints: {}
            }
        },
        metrics: {
            type: sequelize.Sequelize.JSON,
            allowNull: false,
            defaultValue: {
                tasksAssigned: 0,
                tasksCompleted: 0,
                tasksFailed: 0,
                averageExecutionTime: 0,
                lastTaskTime: null,
                collaborationScore: 1.0,
                specializations: []
            }
        },
        lastInteraction: {
            type: sequelize.Sequelize.DATE,
            allowNull: true
        },
        metadata: {
            type: sequelize.Sequelize.JSON,
            allowNull: false,
            defaultValue: {}
        },
        createdAt: {
            type: sequelize.Sequelize.DATE,
            allowNull: false
        },
        updatedAt: {
            type: sequelize.Sequelize.DATE,
            allowNull: false
        }
    },
    {
        tableName: 'agent_swarms',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['agentId', 'swarmId']
            },
            {
                fields: ['active']
            },
            {
                fields: ['priority']
            }
        ]
    }
) as unknown as (new () => AgentSwarmModel) & typeof Model;

// Add associations
(AgentSwarm as any).associate = function(models: any) {
    AgentSwarm.belongsTo(models.Agent, {
        foreignKey: 'agentId',
        as: 'agent'
    });
    AgentSwarm.belongsTo(models.Swarm, {
        foreignKey: 'swarmId',
        as: 'swarm'
    });
};

export { AgentSwarm, AgentSwarmModel };