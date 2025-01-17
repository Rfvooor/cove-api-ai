import { NodeTemplate, BasicNodeCategory, WorkflowNodeCategory } from '../types/node.js';
import { Agent, AgentConfig } from '../agent.js';
import { Task } from '../task.js';
import { Memory } from '../memory.js';

// Agent templates for each AI operation
const agentTemplates: Record<string, AgentConfig> = {
  summarizer: {
    name: 'Summarizer Agent',
    description: 'Summarize large bodies of text using AI',
    systemPrompt: `You are a specialized AI agent focused on text summarization.
Your task is to create clear, concise summaries while preserving key information.
Consider the following in your summaries:
- Main ideas and key points
- Supporting details when relevant
- Original text structure and flow
- Audience-appropriate language`,
    maxLoops: 3,
    temperature: 0.7,
    maxTokens: 2048,
    contextLength: 4096,
    memoryConfig: {
      maxShortTermItems: 10,
      maxTokenSize: 4096,
      autoArchive: true
    }
  },
  extractor: {
    name: 'Data Extraction Agent',
    description: 'Extract structured data from text',
    systemPrompt: `You are a specialized AI agent focused on data extraction.
Your task is to identify and extract specific information from text into structured formats.
Follow these guidelines:
- Carefully identify requested data points
- Maintain data accuracy and completeness
- Follow provided schema structures
- Validate extracted data`,
    maxLoops: 2,
    temperature: 0.3,
    maxTokens: 1024,
    contextLength: 4096
  },
  categorizer: {
    name: 'Categorizer Agent',
    description: 'Group data into meaningful categories using AI',
    systemPrompt: `You are a specialized AI agent focused on data categorization.
Your task is to analyze and group items into meaningful categories based on their characteristics.
Follow these guidelines:
- Identify common patterns and themes
- Create logical groupings
- Maintain consistency in categorization
- Handle edge cases appropriately
- Consider semantic relationships
- Apply provided categorization methods`,
    maxLoops: 2,
    temperature: 0.5,
    maxTokens: 2048,
    contextLength: 4096,
    memoryConfig: {
      maxShortTermItems: 50,
      maxTokenSize: 4096,
      autoArchive: true
    }
  },
  scorer: {
    name: 'Scorer Agent',
    description: 'Rate items on custom scales using AI',
    systemPrompt: `You are a specialized AI agent focused on evaluating and scoring items.
Your task is to analyze items and assign scores based on specified criteria and scales.
Follow these guidelines:
- Carefully evaluate each item against criteria
- Use provided scale consistently
- Consider all aspects of scoring criteria
- Provide justification for scores
- Maintain objectivity in scoring
- Handle edge cases appropriately`,
    maxLoops: 2,
    temperature: 0.4,
    maxTokens: 1024,
    contextLength: 4096,
    memoryConfig: {
      maxShortTermItems: 20,
      maxTokenSize: 2048,
      autoArchive: true
    }
  },
  tableExtractor: {
    name: 'Table Extraction Agent',
    description: 'Convert text into structured table format',
    systemPrompt: `You are a specialized AI agent focused on extracting tabular data from text.
Your task is to identify and structure information into well-organized tables.
Follow these guidelines:
- Identify table-like patterns in text
- Maintain consistent column structure
- Ensure data type consistency
- Handle missing or ambiguous data
- Validate table structure
- Preserve data relationships`,
    maxLoops: 2,
    temperature: 0.3,
    maxTokens: 2048,
    contextLength: 4096,
    memoryConfig: {
      maxShortTermItems: 30,
      maxTokenSize: 4096,
      autoArchive: true
    }
  }
};

export const aiBasicsTemplates: NodeTemplate[] = [
  {
    id: 'ask-ai',
    name: 'Ask AI',
    description: 'Get AI-generated responses',
    type: 'basic',
    category: 'ai' as WorkflowNodeCategory,
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
      tags: ['ai', 'generate', 'response'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'askAI',
      description: 'Get AI-generated responses',
      category: 'ai' as WorkflowNodeCategory,
      implementation: `
        const {
          prompt,
          modelPreference = 'claude-3-haiku',
          cacheResponse = true,
          temperature = 0.7,
          maxTokens
        } = input;

        // Get the configured LLM service
        const modelService = await llm.getService(modelPreference);

        // Configure request options
        const options = {
          temperature,
          maxTokens,
          cache: cacheResponse
        };

        // Generate response
        const response = await modelService.generate(prompt, options);
        return { result: response };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          modelPreference: {
            type: 'string',
            enum: ['claude-3-haiku', 'gpt-4', 'gpt-3.5-turbo', 'anthropic-claude-2']
          },
          cacheResponse: { type: 'boolean' },
          temperature: {
            type: 'number',
            description: 'Temperature value between 0 and 1'
          },
          maxTokens: { type: 'number' }
        },
        required: ['prompt']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'string' }
        },
        required: ['result']
      }
    }
  },
  {
    id: 'extract-data',
    name: 'Extract Data',
    description: 'Pull info from text',
    type: 'basic',
    category: 'ai' as WorkflowNodeCategory,
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
      tags: ['ai', 'extract', 'data'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'extractData',
      description: 'Extract structured data from text',
      category: 'ai' as WorkflowNodeCategory,
      implementation: `
        // Create agent with extractor template
        const agent = await Agent.create({
          ...agentTemplates.extractor,
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
            name: 'Extract Data',
            description: 'Extract structured data from the provided text according to schema',
            prompt: \`Extract data from the following text according to the provided schema:
            Text: \${input.text}
            Schema: \${JSON.stringify(input.schema, null, 2)}
            
            Requirements:
            1. Extract all fields specified in the schema
            2. Maintain data types as specified
            3. Ensure accuracy of extracted data
            4. Return null for fields where data cannot be found
            \`,
            data: {
              text: input.text,
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
          result: result.output || result.error?.message || 'Failed to extract data'
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          schema: {
            type: 'object',
            properties: {
              fields: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' }
                  }
                }
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
        required: ['text', 'schema']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {}
          }
        },
        required: ['result']
      }
    }
  },
  {
    id: 'summarizer',
    name: 'Summarizer',
    description: 'Condense text with AI',
    type: 'basic', 
    category: 'ai' as WorkflowNodeCategory,
    defaultConfig: {},
    metadata: {
      version: '1.0.0',
      tags: ['ai', 'summarize', 'text'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'summarize',
      description: 'Generate a concise summary of text',
      category: 'ai' as WorkflowNodeCategory,
      implementation: `
        const { text, maxLength, format = 'paragraph' } = input;
        return {
          result: await llm.summarize(text, { maxLength, format })
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          maxLength: { type: 'number' },
          format: { 
            type: 'string',
            enum: ['paragraph', 'bullets', 'outline']
          }
        },
        required: ['text']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'string' }
        },
        required: ['result']
      }
    }
  },
  {
    id: 'categorizer',
    name: 'Categorizer',
    description: 'Group data with AI',
    type: 'basic',
    category: 'ai' as WorkflowNodeCategory,
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
      tags: ['ai', 'categorize', 'group'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'categorize',
      description: 'Categorize data into groups using AI',
      category: 'ai' as WorkflowNodeCategory,
      implementation: `
        const { items, categories, config = {} } = input;
        const {
          model = 'claude-3-haiku',
          useCache = true,
          temperature = 0.7,
          method = 'semantic'
        } = config;

        // Get the configured LLM service
        const modelService = await llm.getService(model);

        // Configure request options
        const options = {
          temperature,
          cache: useCache,
          method
        };

        // Categorize items
        const categorized = await modelService.categorize(items, categories, options);
        return { result: categorized };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' }
          },
          categories: {
            type: 'array',
            items: { type: 'string' }
          },
          method: {
            type: 'string',
            enum: ['semantic', 'keyword', 'custom']
          }
        },
        required: ['items', 'categories']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              categories: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    items: {
                      type: 'array',
                      items: { type: 'string' }
                    }
                  }
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
    id: 'scorer',
    name: 'Scorer',
    description: 'Rate data on custom scale',
    type: 'basic',
    category: 'ai' as WorkflowNodeCategory,
    defaultConfig: {},
    metadata: {
      version: '1.0.0',
      tags: ['ai', 'score', 'rate'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'score',
      description: 'Score items on a custom scale using AI',
      category: 'ai' as WorkflowNodeCategory,
      implementation: `
        const { items, criteria, scale } = input;
        return {
          result: await llm.score(items, criteria, scale)
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' }
          },
          criteria: { type: 'string' },
          scale: {
            type: 'object',
            properties: {
              min: { type: 'number' },
              max: { type: 'number' },
              step: { type: 'number' }
            }
          }
        },
        required: ['items', 'criteria', 'scale']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string' },
                score: { type: 'number' }
              }
            }
          }
        },
        required: ['result']
      }
    }
  },
  {
    id: 'extract-table',
    name: 'Extract to Table',
    description: 'Convert text to table',
    type: 'basic',
    category: 'ai' as WorkflowNodeCategory,
    defaultConfig: {},
    metadata: {
      version: '1.0.0',
      tags: ['ai', 'table', 'extract'],
      author: 'system',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    operation: {
      name: 'extractTable',
      description: 'Convert text to structured table format',
      category: 'ai' as WorkflowNodeCategory,
      implementation: `
        const { text, columns } = input;
        return {
          result: await llm.extractTable(text, columns)
        };
      `,
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          columns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' }
              }
            }
          }
        },
        required: ['text', 'columns']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'array',
            items: {
              type: 'object',
              properties: {}
            }
          }
        },
        required: ['result']
      }
    }
  }
];