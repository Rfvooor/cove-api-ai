import { Model } from 'sequelize';
import { sequelize } from './index';
import { ToolAttributes, ToolCreationAttributes } from './types';

interface ToolModel extends Model<ToolAttributes, ToolCreationAttributes>, ToolAttributes {}

const Tool = sequelize.define(
    'Tool',
    {
        id: {
            type: sequelize.Sequelize.UUID,
            defaultValue: sequelize.Sequelize.literal('UUID()'),
            primaryKey: true
        },
        name: {
            type: sequelize.Sequelize.STRING,
            allowNull: false
        },
        description: {
            type: sequelize.Sequelize.TEXT,
            allowNull: false
        },
        type: {
            type: sequelize.Sequelize.STRING,
            allowNull: false,
            comment: 'Tool category/type (e.g., "web", "math", "file", etc.)'
        },
        version: {
            type: sequelize.Sequelize.STRING,
            allowNull: false,
            defaultValue: '1.0.0'
        },
        enabled: {
            type: sequelize.Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        inputSchema: {
            type: sequelize.Sequelize.JSON,
            allowNull: false,
            validate: {
                isValidSchema(value: any) {
                    if (!value.type || !value.properties || !value.required) {
                        throw new Error('Invalid tool schema');
                    }
                }
            }
        },
        outputSchema: {
            type: sequelize.Sequelize.JSON,
            allowNull: false,
            validate: {
                isValidSchema(value: any) {
                    if (!value.type || !value.properties) {
                        throw new Error('Invalid tool schema');
                    }
                }
            }
        },
        configuration: {
            type: sequelize.Sequelize.JSON,
            allowNull: false,
            defaultValue: {}
        },
        permissions: {
            type: sequelize.Sequelize.JSON,
            allowNull: false,
            defaultValue: {
                requiresAuth: false,
                scope: ['*'],
                rateLimit: null
            }
        },
        metrics: {
            type: sequelize.Sequelize.JSON,
            allowNull: false,
            defaultValue: {
                usageCount: 0,
                successRate: 1.0,
                averageExecutionTime: 0,
                lastUsed: null,
                errorTypes: {}
            }
        },
        agentId: {
            type: sequelize.Sequelize.UUID,
            allowNull: true,
            references: {
                model: 'agents',
                key: 'id'
            }
        },
        metadata: {
            type: sequelize.Sequelize.JSON,
            allowNull: false,
            defaultValue: {}
        },
        dependencies: {
            type: sequelize.Sequelize.JSON,
            allowNull: false,
            defaultValue: []
        },
        tags: {
            type: sequelize.Sequelize.JSON,
            allowNull: false,
            defaultValue: []
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
        tableName: 'tools',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['name', 'agentId'],
                where: {
                    agentId: {
                        [sequelize.Sequelize.Op.ne]: null
                    }
                }
            },
            {
                fields: ['type']
            },
            {
                fields: ['enabled']
            }
        ]
    }
) as unknown as (new () => ToolModel) & typeof Model;

// Add associations
(Tool as any).associate = function(models: any) {
    Tool.belongsTo(models.Agent, {
        foreignKey: 'agentId',
        as: 'agent'
    });
    Tool.hasMany(models.TaskExecution, {
        foreignKey: 'toolId',
        as: 'executions'
    });
};

export { Tool, ToolModel };