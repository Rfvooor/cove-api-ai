import { NodeTemplate, BasicNodeCategory } from '../types/node.js';
import { Agent, AgentConfig } from '../agent.js';
import { Task } from '../task.js';

// Agent templates for blockchain operations
const agentTemplates: Record<string, AgentConfig> = {
  blockchainProcessor: {
    name: 'Blockchain Processor Agent',
    description: 'Process and analyze blockchain data',
    systemPrompt: `You are a specialized agent for blockchain operations.
Your task is to process and analyze blockchain data efficiently.
Follow these guidelines:
- Validate blockchain addresses
- Handle multiple chains
- Process transaction data
- Monitor token metrics
- Document operations performed`,
    maxLoops: 2,
    temperature: 0.3,
    maxTokens: 2048,
    contextLength: 4096
  }
};

export const blockchainBasicsTemplates: NodeTemplate[] = [
  {
    id: 'token-analyze',
    name: 'Token Analysis',
    description: 'Analyze token metrics and performance',
    type: 'basic',
    category: 'blockchain' as BasicNodeCategory,
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
      tags: ['blockchain', 'token', 'analysis'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'tokenAnalyze',
      description: 'Analyze token metrics and performance',
      category: 'blockchain' as BasicNodeCategory,
      implementation: `
        // Create agent with blockchain processor template
        const agent = await Agent.create({
          ...agentTemplates.blockchainProcessor,
          languageModelConfig: {
            model: input.config?.model || 'claude-3-haiku',
            temperature: input.config?.temperature || 0.3,
            provider: 'claude'
          }
        });

        // Create analysis task
        const task = new Task({
          type: 'agent',
          executorId: agent.id,
          input: {
            name: 'Token Analysis',
            description: 'Analyze token metrics and performance',
            prompt: \`Analyze token with the following parameters:
            Token: \${input.token}
            Chain: \${input.chain || 'solana'}
            Metrics: \${JSON.stringify(input.metrics || ['price', 'volume', 'liquidity'], null, 2)}
            
            Requirements:
            1. Validate token address
            2. Fetch token data
            3. Calculate metrics
            4. Generate insights
            5. Report any errors
            \`,
            data: {
              token: input.token,
              chain: input.chain || 'solana',
              metrics: input.metrics || ['price', 'volume', 'liquidity']
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
          result: result.output || result.error?.message || 'Failed to analyze token'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          chain: {
            type: 'string',
            enum: ['solana', 'ethereum', 'binance']
          },
          metrics: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['price', 'volume', 'liquidity', 'holders', 'transactions']
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
        required: ['token']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              token: {
                type: 'object',
                properties: {
                  address: { type: 'string' },
                  name: { type: 'string' },
                  symbol: { type: 'string' },
                  decimals: { type: 'number' }
                }
              },
              metrics: {
                type: 'object',
                properties: {
                  price: { type: 'number' },
                  priceChange24h: { type: 'number' },
                  volume24h: { type: 'number' },
                  liquidity: { type: 'number' },
                  marketCap: { type: 'number' }
                }
              },
              metadata: {
                type: 'object',
                properties: {
                  chain: { type: 'string' },
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
    id: 'chain-monitor',
    name: 'Chain Monitor',
    description: 'Monitor blockchain transactions and events',
    type: 'basic',
    category: 'blockchain' as BasicNodeCategory,
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
      tags: ['blockchain', 'monitor', 'transactions'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'chainMonitor',
      description: 'Monitor blockchain transactions and events',
      category: 'blockchain' as BasicNodeCategory,
      implementation: `
        // Create agent with blockchain processor template
        const agent = await Agent.create({
          ...agentTemplates.blockchainProcessor,
          languageModelConfig: {
            model: input.config?.model || 'claude-3-haiku',
            temperature: input.config?.temperature || 0.3,
            provider: 'claude'
          }
        });

        // Create monitoring task
        const task = new Task({
          type: 'agent',
          executorId: agent.id,
          input: {
            name: 'Chain Monitor',
            description: 'Monitor blockchain transactions and events',
            prompt: \`Monitor blockchain with the following parameters:
            Chain: \${input.chain || 'solana'}
            Address: \${input.address}
            Events: \${JSON.stringify(input.events || ['transfer', 'swap'], null, 2)}
            
            Requirements:
            1. Validate address
            2. Monitor transactions
            3. Filter events
            4. Process data
            5. Report any errors
            \`,
            data: {
              chain: input.chain || 'solana',
              address: input.address,
              events: input.events || ['transfer', 'swap']
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
          result: result.output || result.error?.message || 'Failed to monitor chain'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          chain: {
            type: 'string',
            enum: ['solana', 'ethereum', 'binance']
          },
          address: { type: 'string' },
          events: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['transfer', 'swap', 'mint', 'burn', 'stake']
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
        required: ['address']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              transactions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    hash: { type: 'string' },
                    type: { type: 'string' },
                    from: { type: 'string' },
                    to: { type: 'string' },
                    amount: { type: 'string' },
                    timestamp: { type: 'string' }
                  }
                }
              },
              metadata: {
                type: 'object',
                properties: {
                  chain: { type: 'string' },
                  address: { type: 'string' },
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