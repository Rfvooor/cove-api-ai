import { NodeTemplate, BasicNodeCategory } from '../types/node.js';
import { Agent, AgentConfig } from '../agent.js';
import { Task } from '../task.js';

// Agent templates for memory operations
const agentTemplates: Record<string, AgentConfig> = {
  memoryProcessor: {
    name: 'Memory Processor Agent',
    description: 'Process and manage memory operations',
    systemPrompt: `You are a specialized agent for memory operations.
Your task is to process and manage memory storage efficiently.
Follow these guidelines:
- Validate data structures
- Handle multiple storage types
- Maintain data consistency
- Optimize retrieval
- Document operations performed`,
    maxLoops: 2,
    temperature: 0.3,
    maxTokens: 2048,
    contextLength: 4096
  }
};

export const memoryBasicsTemplates: NodeTemplate[] = [
  {
    id: 'vector-store',
    name: 'Vector Store',
    description: 'Store and retrieve vector embeddings',
    type: 'basic',
    category: 'memory' as BasicNodeCategory,
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
      tags: ['memory', 'vector', 'embeddings'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'vectorStore',
      description: 'Store and retrieve vector embeddings',
      category: 'memory' as BasicNodeCategory,
      implementation: `
        // Create agent with memory processor template
        const agent = await Agent.create({
          ...agentTemplates.memoryProcessor,
          languageModelConfig: {
            model: input.config?.model || 'claude-3-haiku',
            temperature: input.config?.temperature || 0.3,
            provider: 'claude'
          }
        });

        // Create vector store task
        const task = new Task({
          type: 'agent',
          executorId: agent.id,
          input: {
            name: 'Vector Store',
            description: 'Store and retrieve vector embeddings',
            prompt: \`Process vector operation:
            Operation: \${input.operation}
            Data: \${JSON.stringify(input.data || {}, null, 2)}
            Store: \${input.store || 'pinecone'}
            
            Requirements:
            1. Validate data format
            2. Generate embeddings
            3. Store/retrieve vectors
            4. Handle metadata
            5. Report any errors
            \`,
            data: {
              operation: input.operation,
              data: input.data || {},
              store: input.store || 'pinecone'
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
          result: result.output || result.error?.message || 'Failed to process vector operation'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['store', 'retrieve', 'update', 'delete']
          },
          data: {
            type: 'object',
            properties: {
              vectors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    values: {
                      type: 'array',
                      items: { type: 'number' }
                    },
                    metadata: {
                      type: 'object',
                      properties: {
                        source: { type: 'string' },
                        timestamp: { type: 'string' },
                        tags: {
                          type: 'array',
                          items: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              },
              namespace: { type: 'string' }
            }
          },
          store: {
            type: 'string',
            enum: ['pinecone', 'chroma']
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
        required: ['operation']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  vectors: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        score: { type: 'number' },
                        metadata: {
                          type: 'object',
                          properties: {
                            type: { type: 'string' },
                            timestamp: { type: 'string' },
                            namespace: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              },
              metadata: {
                type: 'object',
                properties: {
                  store: { type: 'string' },
                  operation: { type: 'string' },
                  timestamp: { type: 'string' }
                }
              }
            }
          }
        },
        required: ['result']
      }
    }
  },
  {
    id: 'cache-manage',
    name: 'Cache Management',
    description: 'Manage distributed cache operations',
    type: 'basic',
    category: 'memory' as BasicNodeCategory,
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
      tags: ['memory', 'cache', 'redis'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'cacheManage',
      description: 'Manage distributed cache operations',
      category: 'memory' as BasicNodeCategory,
      implementation: `
        // Create agent with memory processor template
        const agent = await Agent.create({
          ...agentTemplates.memoryProcessor,
          languageModelConfig: {
            model: input.config?.model || 'claude-3-haiku',
            temperature: input.config?.temperature || 0.3,
            provider: 'claude'
          }
        });

        // Create cache management task
        const task = new Task({
          type: 'agent',
          executorId: agent.id,
          input: {
            name: 'Cache Management',
            description: 'Manage distributed cache operations',
            prompt: \`Process cache operation:
            Operation: \${input.operation}
            Key: \${input.key}
            Value: \${JSON.stringify(input.value || null, null, 2)}
            TTL: \${input.ttl || 3600}
            
            Requirements:
            1. Validate key/value
            2. Handle data types
            3. Set expiration
            4. Manage consistency
            5. Report any errors
            \`,
            data: {
              operation: input.operation,
              key: input.key,
              value: input.value,
              ttl: input.ttl || 3600
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
          result: result.output || result.error?.message || 'Failed to process cache operation'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['get', 'set', 'delete', 'expire']
          },
          key: { type: 'string' },
          value: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              data: { type: 'string' },
              metadata: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  timestamp: { type: 'string' }
                }
              }
            }
          },
          ttl: { type: 'number' },
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
        required: ['operation', 'key']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  value: {
                    type: 'object',
                    properties: {
                      data: { type: 'string' },
                      metadata: {
                        type: 'object',
                        properties: {
                          type: { type: 'string' },
                          timestamp: { type: 'string' }
                        }
                      }
                    }
                  },
                  ttl: { type: 'number' }
                }
              },
              metadata: {
                type: 'object',
                properties: {
                  operation: { type: 'string' },
                  key: { type: 'string' },
                  timestamp: { type: 'string' }
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