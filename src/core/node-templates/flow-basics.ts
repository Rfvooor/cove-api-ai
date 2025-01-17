import { NodeTemplate, BasicNodeCategory, WorkflowNodeCategory } from '../types/node.js';

export const flowBasicsTemplates: NodeTemplate[] = [
  {
    id: 'input',
    name: 'Input',
    description: 'Start automation with input',
    type: 'basic',
    category: 'input' as WorkflowNodeCategory,
    defaultConfig: {},
    metadata: {
      version: '1.0.0',
      tags: ['flow', 'input', 'start'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'input',
      description: 'Start automation with input',
      category: 'input' as WorkflowNodeCategory,
      implementation: `
        return input;
      `,
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        required: ['data']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        required: ['result']
      }
    }
  },
  {
    id: 'output',
    name: 'Output',
    description: 'End automation with output',
    type: 'basic',
    category: 'output' as WorkflowNodeCategory,
    defaultConfig: {},
    metadata: {
      version: '1.0.0',
      tags: ['flow', 'output', 'end'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'output',
      description: 'End automation with output',
      category: 'output' as WorkflowNodeCategory,
      implementation: `
        return input;
      `,
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        required: ['data']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        required: ['result']
      }
    }
  },
  {
    id: 'note',
    name: 'Note',
    description: 'Add notes to automation',
    type: 'basic',
    category: 'control' as WorkflowNodeCategory,
    defaultConfig: {},
    metadata: {
      version: '1.0.0',
      tags: ['flow', 'note', 'documentation'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'note',
      description: 'Add notes to automation',
      category: 'control' as WorkflowNodeCategory,
      implementation: `
        return input;
      `,
      inputSchema: {
        type: 'object',
        properties: {
          note: { type: 'string' },
          data: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        required: ['note', 'data']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        required: ['result']
      }
    }
  },
  {
    id: 'filter',
    name: 'Filter',
    description: 'Filter data by condition',
    type: 'basic',
    category: 'control' as WorkflowNodeCategory,
    defaultConfig: {},
    metadata: {
      version: '1.0.0',
      tags: ['flow', 'filter', 'condition'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'filter',
      description: 'Filter data by condition',
      category: 'control' as WorkflowNodeCategory,
      implementation: `
        const { condition, data } = input;
        return condition(data) ? data : null;
      `,
      inputSchema: {
        type: 'object',
        properties: {
          condition: { type: 'string' },
          data: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        required: ['condition', 'data']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        required: ['result']
      }
    }
  },
  {
    id: 'if-else',
    name: 'If-Else',
    description: 'Create conditional workflow branch',
    type: 'decision',
    category: 'control' as WorkflowNodeCategory,
    defaultConfig: {},
    metadata: {
      version: '1.0.0',
      tags: ['flow', 'condition', 'branch'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'ifElse',
      description: 'Create conditional workflow branch',
      category: 'control' as WorkflowNodeCategory,
      implementation: `
        const { condition, data } = input;
        return {
          result: condition(data),
          path: condition(data) ? 'true' : 'false'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          condition: { type: 'string' },
          data: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        required: ['condition', 'data']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'boolean' },
          path: { type: 'string' }
        },
        required: ['result', 'path']
      }
    }
  },
  {
    id: 'error-shield',
    name: 'Error Shield',
    description: 'Handle errors in workflow',
    type: 'basic',
    category: 'control' as WorkflowNodeCategory,
    defaultConfig: {},
    metadata: {
      version: '1.0.0',
      tags: ['flow', 'error', 'handling'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'errorShield',
      description: 'Handle errors in workflow',
      category: 'control' as WorkflowNodeCategory,
      implementation: `
        try {
          return await input.operation(input.data);
        } catch (error) {
          return input.fallback ? input.fallback(error) : { error: error.message };
        }
      `,
      inputSchema: {
        type: 'object',
        properties: {
          operation: { type: 'string' },
          data: {
            type: 'object',
            properties: {},
            required: []
          },
          fallback: { type: 'string' }
        },
        required: ['operation', 'data']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        required: ['result']
      }
    }
  },
  {
    id: 'join-paths',
    name: 'Join Paths',
    description: 'Join conditional branches back together. Useful for branching in If/Else or Error Shield nodes.',
    type: 'merge',
    category: 'control' as WorkflowNodeCategory,
    defaultConfig: {},
    metadata: {
      version: '1.0.0',
      tags: ['flow', 'merge', 'join'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'joinPaths',
      description: 'Join multiple paths into one',
      category: 'control' as WorkflowNodeCategory,
      implementation: `
        return {
          result: input.paths.reduce((acc, path) => ({
            ...acc,
            ...path
          }), {})
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          paths: {
            type: 'array',
            items: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        },
        required: ['paths']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        required: ['result']
      }
    }
  }
];