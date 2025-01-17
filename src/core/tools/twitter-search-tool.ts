import { Tool, type ToolConfig, type SchemaType } from '../tool.js';
import { TwitterApi } from 'twitter-api-v2';

interface TwitterSearchResult {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
}

interface TwitterSearchOptions {
  query: string;
  maxResults?: number;
  startTime?: string;
  endTime?: string;
  sortOrder?: 'recency' | 'relevancy';
}

interface TwitterSearchResponse {
  success: boolean;
  data: TwitterSearchResult[];
  error?: string;
}

export interface TwitterSearchToolConfig {
  name?: string;
  description?: string;
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
}

// Input schema in JSON Schema format
const inputSchema: SchemaType = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Search query string',
      minLength: 1,
      maxLength: 500
    },
    maxResults: {
      type: 'number',
      description: 'Maximum number of results to return',
      minimum: 1,
      maximum: 100,
      default: 10
    },
    startTime: {
      type: 'string',
      description: 'Start time in ISO 8601 format',
      pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$'
    },
    endTime: {
      type: 'string',
      description: 'End time in ISO 8601 format',
      pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$'
    },
    sortOrder: {
      type: 'string',
      enum: ['recency', 'relevancy'],
      description: 'Sort order for results',
      default: 'recency'
    }
  },
  required: ['query']
};

// Output schema in JSON Schema format
const outputSchema: SchemaType = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Whether the operation was successful'
    },
    data: {
      type: 'array',
      description: 'Array of tweet results',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Tweet ID'
          },
          text: {
            type: 'string',
            description: 'Tweet text content'
          },
          created_at: {
            type: 'string',
            description: 'Tweet creation timestamp'
          },
          author_id: {
            type: 'string',
            description: 'Author ID'
          },
          public_metrics: {
            type: 'object',
            properties: {
              retweet_count: {
                type: 'number',
                description: 'Number of retweets'
              },
              reply_count: {
                type: 'number',
                description: 'Number of replies'
              },
              like_count: {
                type: 'number',
                description: 'Number of likes'
              },
              quote_count: {
                type: 'number',
                description: 'Number of quotes'
              }
            },
            required: ['retweet_count', 'reply_count', 'like_count', 'quote_count']
          }
        },
        required: ['id', 'text', 'created_at', 'author_id', 'public_metrics']
      }
    },
    error: {
      type: 'string',
      description: 'Error message if operation failed'
    }
  },
  required: ['success', 'data']
};

class TwitterSearchToolImpl extends Tool<TwitterSearchOptions, TwitterSearchResponse> {
  private readonly client: TwitterApi;

  constructor(config: ToolConfig<TwitterSearchOptions, TwitterSearchResponse>, twitterConfig: TwitterSearchToolConfig) {
    super(config);
    this.client = new TwitterApi({
      appKey: twitterConfig.appKey,
      appSecret: twitterConfig.appSecret,
      accessToken: twitterConfig.accessToken,
      accessSecret: twitterConfig.accessSecret
    });
  }

  async execute(options: TwitterSearchOptions): Promise<TwitterSearchResponse> {
    try {
      const sortOrder = options.sortOrder === 'relevancy' ? 'relevancy' : 'recency';
      const tweetFields = ['created_at', 'public_metrics', 'author_id'];

      const searchOptions = {
        query: options.query,
        'tweet.fields': tweetFields,
        max_results: options.maxResults || 10,
        ...(options.startTime && { start_time: options.startTime }),
        ...(options.endTime && { end_time: options.endTime }),
        sort_order: sortOrder
      };

      const response = await this.client.v2.search(searchOptions);

      return {
        success: true,
        data: response.data.map(tweet => ({
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at || new Date().toISOString(),
          author_id: tweet.author_id || 'unknown',
          public_metrics: {
            retweet_count: (tweet as any).public_metrics?.retweet_count || 0,
            reply_count: (tweet as any).public_metrics?.reply_count || 0,
            like_count: (tweet as any).public_metrics?.like_count || 0,
            quote_count: (tweet as any).public_metrics?.quote_count || 0
          }
        }))
      };
    } catch (error) {
      console.error('Twitter search error:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class TwitterSearchTool {
  static create(config: TwitterSearchToolConfig): Tool<TwitterSearchOptions, TwitterSearchResponse> {
    const toolConfig: ToolConfig<TwitterSearchOptions, TwitterSearchResponse> = {
      name: config.name || 'twitter-search',
      description: config.description || `Twitter search tool for finding tweets based on queries. Features:
      - Full text search
      - Date range filtering
      - Sort by recency or relevance
      - Engagement metrics (likes, retweets, etc.)
      - Author information`,
      inputSchema,
      outputSchema,
      execute: async (input: TwitterSearchOptions) => {
        const tool = new TwitterSearchToolImpl(toolConfig, config);
        return tool.execute(input);
      }
    };

    return new TwitterSearchToolImpl(toolConfig, config);
  }
}