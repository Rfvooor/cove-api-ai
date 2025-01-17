import { NodeTemplate, BasicNodeCategory } from '../types/node.js';
import { Agent, AgentConfig } from '../agent.js';
import { Task } from '../task.js';

// Agent templates for messaging operations
const agentTemplates: Record<string, AgentConfig> = {
  messagingProcessor: {
    name: 'Messaging Processor Agent',
    description: 'Process and handle messaging platform interactions',
    systemPrompt: `You are a specialized agent for messaging platform operations.
Your task is to process and handle messaging interactions efficiently.
Follow these guidelines:
- Validate message content
- Handle platform-specific features
- Maintain conversation context
- Follow platform guidelines
- Document operations performed`,
    maxLoops: 2,
    temperature: 0.3,
    maxTokens: 2048,
    contextLength: 4096
  }
};

export const messagingBasicsTemplates: NodeTemplate[] = [
  {
    id: 'discord-interact',
    name: 'Discord Interaction',
    description: 'Handle Discord channel interactions',
    type: 'basic',
    category: 'messaging' as BasicNodeCategory,
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
      tags: ['messaging', 'discord', 'interaction'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'discordInteract',
      description: 'Handle Discord channel interactions',
      category: 'messaging' as BasicNodeCategory,
      implementation: `
        // Create agent with messaging processor template
        const agent = await Agent.create({
          ...agentTemplates.messagingProcessor,
          languageModelConfig: {
            model: input.config?.model || 'claude-3-haiku',
            temperature: input.config?.temperature || 0.3,
            provider: 'claude'
          }
        });

        // Create interaction task
        const task = new Task({
          type: 'agent',
          executorId: agent.id,
          input: {
            name: 'Discord Interaction',
            description: 'Handle Discord channel interactions',
            prompt: \`Process Discord interaction:
            Channel: \${input.channel}
            Message: \${input.message}
            Action: \${input.action || 'respond'}
            
            Requirements:
            1. Validate channel access
            2. Process message content
            3. Handle mentions and roles
            4. Format response properly
            5. Report any errors
            \`,
            data: {
              channel: input.channel,
              message: input.message,
              action: input.action || 'respond'
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
          result: result.output || result.error?.message || 'Failed to handle Discord interaction'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          message: { type: 'string' },
          action: {
            type: 'string',
            enum: ['respond', 'react', 'delete', 'pin']
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
        required: ['channel', 'message']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              response: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  embeds: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        color: { type: 'number' }
                      }
                    }
                  }
                }
              },
              metadata: {
                type: 'object',
                properties: {
                  channel: { type: 'string' },
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
    id: 'telegram-interact',
    name: 'Telegram Interaction',
    description: 'Handle Telegram chat interactions',
    type: 'basic',
    category: 'messaging' as BasicNodeCategory,
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
      tags: ['messaging', 'telegram', 'interaction'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'telegramInteract',
      description: 'Handle Telegram chat interactions',
      category: 'messaging' as BasicNodeCategory,
      implementation: `
        // Create agent with messaging processor template
        const agent = await Agent.create({
          ...agentTemplates.messagingProcessor,
          languageModelConfig: {
            model: input.config?.model || 'claude-3-haiku',
            temperature: input.config?.temperature || 0.3,
            provider: 'claude'
          }
        });

        // Create interaction task
        const task = new Task({
          type: 'agent',
          executorId: agent.id,
          input: {
            name: 'Telegram Interaction',
            description: 'Handle Telegram chat interactions',
            prompt: \`Process Telegram interaction:
            Chat: \${input.chat}
            Message: \${input.message}
            Action: \${input.action || 'send'}
            
            Requirements:
            1. Validate chat access
            2. Process message content
            3. Handle special entities
            4. Format response properly
            5. Report any errors
            \`,
            data: {
              chat: input.chat,
              message: input.message,
              action: input.action || 'send'
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
          result: result.output || result.error?.message || 'Failed to handle Telegram interaction'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          chat: { type: 'string' },
          message: { type: 'string' },
          action: {
            type: 'string',
            enum: ['send', 'edit', 'delete', 'pin']
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
        required: ['chat', 'message']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              response: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  entities: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string' },
                        offset: { type: 'number' },
                        length: { type: 'number' }
                      }
                    }
                  }
                }
              },
              metadata: {
                type: 'object',
                properties: {
                  chat: { type: 'string' },
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