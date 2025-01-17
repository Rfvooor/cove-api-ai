import { NodeTemplate, BasicNodeCategory } from '../types/node.js';
import { Agent, AgentConfig } from '../agent.js';
import { Task } from '../task.js';

// Agent templates for file operations
const agentTemplates: Record<string, AgentConfig> = {
  fileProcessor: {
    name: 'File Processor Agent',
    description: 'Process and manipulate files',
    systemPrompt: `You are a specialized agent for file operations.
Your task is to process and manipulate files safely and efficiently.
Follow these guidelines:
- Validate file operations
- Handle errors gracefully
- Maintain file integrity
- Follow file system permissions
- Document operations performed`,
    maxLoops: 1,
    temperature: 0.1,
    maxTokens: 1024,
    contextLength: 2048
  }
};

export const fileBasicsTemplates: NodeTemplate[] = [
  {
    id: 'read-file',
    name: 'Read File',
    description: 'Read file contents',
    type: 'basic',
    category: 'file' as BasicNodeCategory,
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
      tags: ['file', 'read', 'input'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'readFile',
      description: 'Read file contents',
      category: 'file' as BasicNodeCategory,
      implementation: `
        // Create agent with file processor template
        const agent = await Agent.create({
          ...agentTemplates.fileProcessor,
          languageModelConfig: {
            model: input.config?.model || 'claude-3-haiku',
            temperature: input.config?.temperature || 0.1,
            provider: 'claude'
          }
        });

        // Create read task
        const task = new Task({
          type: 'agent',
          executorId: agent.id,
          input: {
            name: 'Read File',
            description: 'Read and process file contents',
            prompt: \`Read the following file:
            Path: \${input.path}
            Encoding: \${input.encoding || 'utf8'}
            
            Requirements:
            1. Validate file exists
            2. Check read permissions
            3. Handle encoding correctly
            4. Process file contents
            5. Report any errors
            \`,
            data: {
              path: input.path,
              encoding: input.encoding || 'utf8'
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
          result: result.output || result.error?.message || 'Failed to read file'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          encoding: { type: 'string' },
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
        required: ['path']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              metadata: {
                type: 'object',
                properties: {
                  encoding: { type: 'string' },
                  size: { type: 'number' },
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
    id: 'write-file',
    name: 'Write File',
    description: 'Write content to file',
    type: 'basic',
    category: 'file' as BasicNodeCategory,
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
      tags: ['file', 'write', 'output'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'writeFile',
      description: 'Write content to file',
      category: 'file' as BasicNodeCategory,
      implementation: `
        // Create agent with file processor template
        const agent = await Agent.create({
          ...agentTemplates.fileProcessor,
          languageModelConfig: {
            model: input.config?.model || 'claude-3-haiku',
            temperature: input.config?.temperature || 0.1,
            provider: 'claude'
          }
        });

        // Create write task
        const task = new Task({
          type: 'agent',
          executorId: agent.id,
          input: {
            name: 'Write File',
            description: 'Write content to file',
            prompt: \`Write content to the following file:
            Path: \${input.path}
            Content: \${input.content}
            Encoding: \${input.encoding || 'utf8'}
            
            Requirements:
            1. Validate write permissions
            2. Create directories if needed
            3. Handle encoding correctly
            4. Ensure atomic write
            5. Report any errors
            \`,
            data: {
              path: input.path,
              content: input.content,
              encoding: input.encoding || 'utf8'
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
          result: result.output || result.error?.message || 'Failed to write file'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
          encoding: { type: 'string' },
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
        required: ['path', 'content']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              metadata: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  size: { type: 'number' },
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