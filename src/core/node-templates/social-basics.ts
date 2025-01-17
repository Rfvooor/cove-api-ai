import { NodeTemplate, BasicNodeCategory } from '../types/node.js';
import { Agent, AgentConfig } from '../agent.js';
import { Task } from '../task.js';

// Agent templates for social media operations
const agentTemplates: Record<string, AgentConfig> = {
  socialProcessor: {
    name: 'Social Media Processor Agent',
    description: 'Process and analyze social media content',
    systemPrompt: `You are a specialized agent for social media operations.
Your task is to process and analyze social media content efficiently.
Follow these guidelines:
- Validate social media queries
- Handle rate limits and errors
- Extract relevant information
- Analyze sentiment and trends
- Document operations performed`,
    maxLoops: 2,
    temperature: 0.3,
    maxTokens: 2048,
    contextLength: 4096
  }
};

export const socialBasicsTemplates: NodeTemplate[] = [
  {
    id: 'twitter-search',
    name: 'Twitter Search',
    description: 'Search and analyze Twitter content',
    type: 'basic',
    category: 'social' as BasicNodeCategory,
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
      tags: ['social', 'twitter', 'search'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'twitterSearch',
      description: 'Search and analyze Twitter content',
      category: 'social' as BasicNodeCategory,
      implementation: `
        // Create agent with social processor template
        const agent = await Agent.create({
          ...agentTemplates.socialProcessor,
          languageModelConfig: {
            model: input.config?.model || 'claude-3-haiku',
            temperature: input.config?.temperature || 0.3,
            provider: 'claude'
          }
        });

        // Create search task
        const task = new Task({
          type: 'agent',
          executorId: agent.id,
          input: {
            name: 'Twitter Search',
            description: 'Search and analyze Twitter content',
            prompt: \`Search Twitter with the following parameters:
            Query: \${input.query}
            Filters: \${JSON.stringify(input.filters || {}, null, 2)}
            
            Requirements:
            1. Validate search query
            2. Apply filters
            3. Handle pagination
            4. Analyze results
            5. Report any errors
            \`,
            data: {
              query: input.query,
              filters: input.filters || {}
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
          result: result.output || result.error?.message || 'Failed to search Twitter'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          filters: {
            type: 'object',
            properties: {
              language: { type: 'string' },
              fromDate: { type: 'string' },
              toDate: { type: 'string' },
              verified: { type: 'boolean' },
              minLikes: { type: 'number' },
              minRetweets: { type: 'number' }
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
        required: ['query']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              tweets: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    text: { type: 'string' },
                    author: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        username: { type: 'string' },
                        verified: { type: 'boolean' }
                      }
                    },
                    metrics: {
                      type: 'object',
                      properties: {
                        likes: { type: 'number' },
                        retweets: { type: 'number' },
                        replies: { type: 'number' }
                      }
                    },
                    created_at: { type: 'string' }
                  }
                }
              },
              metadata: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  count: { type: 'number' },
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
    id: 'twitter-analyze',
    name: 'Twitter Analysis',
    description: 'Analyze Twitter content and trends',
    type: 'basic',
    category: 'social' as BasicNodeCategory,
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
      tags: ['social', 'twitter', 'analysis'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'twitterAnalyze',
      description: 'Analyze Twitter content and trends',
      category: 'social' as BasicNodeCategory,
      implementation: `
        // Create agent with social processor template
        const agent = await Agent.create({
          ...agentTemplates.socialProcessor,
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
            name: 'Twitter Analysis',
            description: 'Analyze Twitter content and trends',
            prompt: \`Analyze Twitter content with the following parameters:
            Tweets: \${JSON.stringify(input.tweets || [], null, 2)}
            Metrics: \${JSON.stringify(input.metrics || [], null, 2)}
            
            Requirements:
            1. Analyze sentiment
            2. Extract topics
            3. Identify trends
            4. Generate insights
            5. Report any errors
            \`,
            data: {
              tweets: input.tweets || [],
              metrics: input.metrics || []
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
          result: result.output || result.error?.message || 'Failed to analyze Twitter content'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          tweets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                author: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    username: { type: 'string' }
                  }
                },
                created_at: { type: 'string' }
              }
            }
          },
          metrics: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['sentiment', 'topics', 'engagement', 'influence']
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
        required: ['tweets']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              sentiment: {
                type: 'object',
                properties: {
                  positive: { type: 'number' },
                  neutral: { type: 'number' },
                  negative: { type: 'number' }
                }
              },
              topics: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    count: { type: 'number' },
                    sentiment: { type: 'string' }
                  }
                }
              },
              trends: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    topic: { type: 'string' },
                    growth: { type: 'number' },
                    period: { type: 'string' }
                  }
                }
              },
              metadata: {
                type: 'object',
                properties: {
                  analyzed_count: { type: 'number' },
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