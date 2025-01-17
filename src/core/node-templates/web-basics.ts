import { NodeTemplate, BasicNodeCategory } from '../types/node.js';
import { Agent, AgentConfig } from '../agent.js';
import { Task } from '../task.js';

// Agent templates for web operations
const agentTemplates: Record<string, AgentConfig> = {
  webProcessor: {
    name: 'Web Processor Agent',
    description: 'Process and interact with web content',
    systemPrompt: `You are a specialized agent for web operations.
Your task is to process and interact with web content safely and efficiently.
Follow these guidelines:
- Validate URLs and web content
- Handle navigation and interactions
- Extract relevant information
- Follow web standards and best practices
- Document operations performed`,
    maxLoops: 2,
    temperature: 0.3,
    maxTokens: 2048,
    contextLength: 4096
  }
};

export const webBasicsTemplates: NodeTemplate[] = [
  {
    id: 'browse-web',
    name: 'Browse Web',
    description: 'Browse and interact with web pages',
    type: 'basic',
    category: 'web' as BasicNodeCategory,
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
      tags: ['web', 'browse', 'interact'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'browseWeb',
      description: 'Browse and interact with web pages',
      category: 'web' as BasicNodeCategory,
      implementation: `
        // Create agent with web processor template
        const agent = await Agent.create({
          ...agentTemplates.webProcessor,
          languageModelConfig: {
            model: input.config?.model || 'claude-3-haiku',
            temperature: input.config?.temperature || 0.3,
            provider: 'claude'
          }
        });

        // Create browse task
        const task = new Task({
          type: 'agent',
          executorId: agent.id,
          input: {
            name: 'Browse Web',
            description: 'Browse and interact with web pages',
            prompt: \`Browse the following web page:
            URL: \${input.url}
            Actions: \${JSON.stringify(input.actions || [], null, 2)}
            
            Requirements:
            1. Validate URL
            2. Handle navigation
            3. Execute specified actions
            4. Extract relevant content
            5. Report any errors
            \`,
            data: {
              url: input.url,
              actions: input.actions || []
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
          result: result.output || result.error?.message || 'Failed to browse web'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['click', 'type', 'scroll_up', 'scroll_down']
                },
                target: {
                  type: 'object',
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' }
                  }
                },
                text: { type: 'string' }
              },
              required: ['type']
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
        required: ['url']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              screenshot: { type: 'string' },
              metadata: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  title: { type: 'string' },
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
    id: 'extract-web',
    name: 'Extract Web Content',
    description: 'Extract content from web pages',
    type: 'basic',
    category: 'web' as BasicNodeCategory,
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
      tags: ['web', 'extract', 'content'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'extractWeb',
      description: 'Extract content from web pages',
      category: 'web' as BasicNodeCategory,
      implementation: `
        // Create agent with web processor template
        const agent = await Agent.create({
          ...agentTemplates.webProcessor,
          languageModelConfig: {
            model: input.config?.model || 'claude-3-haiku',
            temperature: input.config?.temperature || 0.3,
            provider: 'claude'
          }
        });

        // Create extraction task
        const task = new Task({
          type: 'agent',
          executorId: agent.id,
          input: {
            name: 'Extract Web Content',
            description: 'Extract content from web pages',
            prompt: \`Extract content from the following web page:
            URL: \${input.url}
            Selectors: \${JSON.stringify(input.selectors || [], null, 2)}
            
            Requirements:
            1. Validate URL
            2. Load page content
            3. Apply selectors
            4. Extract matching content
            5. Report any errors
            \`,
            data: {
              url: input.url,
              selectors: input.selectors || []
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
          result: result.output || result.error?.message || 'Failed to extract web content'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          selectors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                selector: { type: 'string' },
                attribute: { type: 'string' }
              },
              required: ['selector']
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
        required: ['url']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              extractions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    content: { type: 'string' },
                    selector: { type: 'string' }
                  }
                }
              },
              metadata: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
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