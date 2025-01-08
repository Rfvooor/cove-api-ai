import { Tool, type ToolConfig } from '../tool.js';
import { TwitterApi } from 'twitter-api-v2';
import z from 'zod';

export interface TwitterSearchResult {
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

export interface TwitterSearchConfig {
  name?: string;
  description?: string;
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
}

interface SearchOptions {
  query: string;
  maxResults?: number;
  startTime?: string;
  endTime?: string;
  sortOrder?: string;
}

const searchOptionsSchema = z.object({
  query: z.string(),
  maxResults: z.number().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  sortOrder: z.string().optional()
});

export class TwitterSearchTool extends Tool<SearchOptions, TwitterSearchResult[]> {
  private client: TwitterApi;

  constructor(config: TwitterSearchConfig) {
    const toolConfig: ToolConfig<SearchOptions, TwitterSearchResult[]> = {
      name: config.name || 'twitter-search',
      description: config.description || 'Search for tweets about specific topics or keywords',
      inputSchema: searchOptionsSchema,
      execute: async (options) => {
        try {
          const results = await this.searchTweets(options);
          return results.map(tweet => ({
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
          }));
        } catch (error) {
          console.error('Twitter search error:', error);
          throw error instanceof Error ? error : new Error(String(error));
        }
      }
    };

    super(toolConfig);

    this.client = new TwitterApi({
      appKey: config.appKey,
      appSecret: config.appSecret,
      accessToken: config.accessToken,
      accessSecret: config.accessSecret
    });
  }

  private async searchTweets(options: SearchOptions) {
    const sortOrder = options.sortOrder === 'recency' || options.sortOrder === 'relevancy'
      ? options.sortOrder
      : 'recency';

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
    return response.data;
  }

  static createTool(config: TwitterSearchConfig): TwitterSearchTool {
    return new TwitterSearchTool(config);
  }
}