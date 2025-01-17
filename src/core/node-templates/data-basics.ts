import { NodeTemplate, BasicNodeCategory, WorkflowNodeCategory } from '../types/node.js';
import { Agent, AgentConfig } from '../agent.js';
import { Task } from '../task.js';

// Agent templates for data operations
const agentTemplates: Record<string, AgentConfig> = {
  jsonParser: {
    name: 'JSON Parser Agent',
    description: 'Parse and validate JSON data',
    systemPrompt: `You are a specialized agent for handling JSON data.
Your task is to parse, validate, and transform JSON structures.
Follow these guidelines:
- Validate JSON syntax and structure
- Handle nested objects and arrays
- Maintain data types
- Format output consistently
- Handle edge cases and errors`,
    maxLoops: 1,
    temperature: 0.1,
    maxTokens: 2048,
    contextLength: 4096
  },
  jsonTransformer: {
    name: 'JSON Transformer Agent',
    description: 'Transform JSON structures',
    systemPrompt: `You are a specialized agent for transforming JSON data.
Your task is to modify and restructure JSON data according to specifications.
Follow these guidelines:
- Preserve data integrity
- Handle complex transformations
- Validate output structure
- Maintain type consistency
- Document changes made`,
    maxLoops: 2,
    temperature: 0.3,
    maxTokens: 2048,
    contextLength: 4096
  }
};

export const dataBasicsTemplates: NodeTemplate[] = [
  {
    id: 'parse-json',
    name: 'Parse JSON',
    description: 'Parse and validate JSON data',
    type: 'basic',
    category: 'data' as BasicNodeCategory,
    defaultConfig: {
      timeout: 30000,
      retryStrategy: {
        maxAttempts: 3,
        backoffMultiplier: 1.5,
        initialDelay: 1000
      }
    },
    metadata: {
      version: '1.0.0',
      tags: ['data', 'json', 'parse'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'parseJson',
      description: 'Parse and validate JSON data',
      category: 'data' as BasicNodeCategory,
      implementation: `
        // Create agent with JSON parser template
        const agent = await Agent.create({
          ...agentTemplates.jsonParser,
          languageModelConfig: {
            model: input.config?.model || 'claude-3-haiku',
            temperature: input.config?.temperature || 0.1,
            provider: 'claude'
          }
        });

        // Create parsing task
        const task = new Task({
          type: 'agent',
          executorId: agent.id,
          input: {
            name: 'Parse JSON',
            description: 'Parse and validate JSON data',
            prompt: \`Parse and validate the following JSON data:
            Data: \${input.data}
            Schema: \${input.schema ? JSON.stringify(input.schema, null, 2) : 'No schema provided'}
            
            Requirements:
            1. Validate JSON syntax
            2. Check data types
            3. Verify required fields
            4. Handle nested structures
            5. Report any validation errors
            \`,
            data: {
              content: input.data,
              schema: input.schema
            }
          },
          timeout: 30000,
          retryConfig: {
            maxAttempts: 3,
            backoffMultiplier: 1.5,
            initialDelay: 1000
          }
        });

        // Execute task
        const result = await agent.execute(task);
        
        // Cleanup
        await agent.cleanup();

        return {
          result: result.output || result.error?.message || 'Failed to parse JSON'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          data: { type: 'string' },
          schema: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              properties: {
                type: 'object',
                properties: {}
              },
              required: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          },
          config: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                enum: ['claude-3-haiku', 'gpt-4', 'gpt-3.5-turbo', 'anthropic-claude-2']
              },
              temperature: {
                type: 'number',
                description: 'Temperature value between 0 and 1'
              },
              useCache: { type: 'boolean' }
            }
          }
        },
        required: ['data']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  properties: {
                    type: 'object',
                    properties: {}
                  }
                }
              },
              errors: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          }
        },
        required: ['result']
      }
    }
  },
  {
    id: 'transform-json',
    name: 'Transform JSON',
    description: 'Transform JSON structure',
    type: 'basic',
    category: 'data' as BasicNodeCategory,
    defaultConfig: {
      timeout: 30000,
      retryStrategy: {
        maxAttempts: 3,
        backoffMultiplier: 1.5,
        initialDelay: 1000
      }
    },
    metadata: {
      version: '1.0.0',
      tags: ['data', 'json', 'transform'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'transformJson',
      description: 'Transform JSON structure',
      category: 'data' as BasicNodeCategory,
      implementation: `
        // Create agent with JSON transformer template
        const agent = await Agent.create({
          ...agentTemplates.jsonTransformer,
          languageModelConfig: {
            model: input.config?.model || 'claude-3-haiku',
            temperature: input.config?.temperature || 0.3,
            provider: 'claude'
          }
        });

        // Create transformation task
        const task = new Task({
          type: 'agent',
          executorId: agent.id,
          input: {
            name: 'Transform JSON',
            description: 'Transform JSON structure according to mapping',
            prompt: \`Transform the following JSON data according to the mapping:
            Source Data: \${JSON.stringify(input.data, null, 2)}
            Mapping: \${JSON.stringify(input.mapping, null, 2)}
            Target Schema: \${input.targetSchema ? JSON.stringify(input.targetSchema, null, 2) : 'No schema provided'}
            
            Requirements:
            1. Apply mapping transformations
            2. Validate against target schema
            3. Preserve data types
            4. Handle missing or null values
            5. Document transformation steps
            \`,
            data: {
              source: input.data,
              mapping: input.mapping,
              targetSchema: input.targetSchema
            }
          },
          timeout: 30000,
          retryConfig: {
            maxAttempts: 3,
            backoffMultiplier: 1.5,
            initialDelay: 1000
          }
        });

        // Execute task
        const result = await agent.execute(task);
        
        // Cleanup
        await agent.cleanup();

        return {
          result: result.output || result.error?.message || 'Failed to transform JSON'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              metadata: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string' }
                }
              }
            }
          },
          mapping: {
            type: 'object',
            properties: {
              fields: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    source: { type: 'string' },
                    target: { type: 'string' },
                    transform: { type: 'string' }
                  }
                }
              }
            }
          },
          targetSchema: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              properties: {
                type: 'object',
                properties: {
                  value: { type: 'string' }
                }
              },
              required: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          },
          config: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                enum: ['claude-3-haiku', 'gpt-4', 'gpt-3.5-turbo', 'anthropic-claude-2']
              },
              temperature: {
                type: 'number',
                description: 'Temperature value between 0 and 1'
              },
              useCache: { type: 'boolean' }
            }
          }
        },
        required: ['data', 'mapping']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  metadata: {
                    type: 'object',
                    properties: {
                      timestamp: { type: 'string' }
                    }
                  }
                }
              },
              transformations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    operation: { type: 'string' },
                    status: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        required: ['result']
      }
    }
  }
];