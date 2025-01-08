import { TwitterApi, TweetV2PostParams } from 'twitter-api-v2';
import { Agent } from '../core/agent.js';
import { SentimentAnalyzer } from '../utils/sentiment-analyzer.js';
import { Task, TaskResult } from '../core/task.js';

export interface TwitterIntegrationConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
}

export interface TweetOptions {
  text: string;
  mediaIds?: string[];
  replyToTweetId?: string;
  quoteTweetId?: string;
}

export interface StreamFilter {
  keywords?: string[];
  hashtags?: string[];
  userIds?: string[];
  languageCode?: string;
}

export class TwitterIntegration {
  private client: TwitterApi;
  private agent: Agent;
  private sentimentAnalyzer: SentimentAnalyzer;

  constructor(
    credentials: TwitterIntegrationConfig, 
    agent: Agent
  ) {
    this.client = new TwitterApi({
      appKey: credentials.appKey,
      appSecret: credentials.appSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret
    });

    this.agent = agent;
    this.sentimentAnalyzer = new SentimentAnalyzer();
  }

  async postTweet(options: TweetOptions): Promise<TaskResult> {
    try {
      const tweetParams: TweetV2PostParams = {
        text: options.text
      };

      if (options.mediaIds) {
        tweetParams.media = { media_ids: options.mediaIds };
      }

      if (options.replyToTweetId) {
        tweetParams.reply = { in_reply_to_tweet_id: options.replyToTweetId };
      }

      const tweet = await this.client.v2.tweet(tweetParams);

      return {
        success: true,
        data: tweet
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to post tweet'
      };
    }
  }

  async listenToMentions(filter?: StreamFilter): Promise<TaskResult> {
    try {
      const stream = await this.client.v2.searchStream({
        'tweet.fields': ['author_id', 'created_at', 'text', 'lang'],
        expansions: ['author_id'],
        ...(filter?.languageCode && { language: filter.languageCode })
      });

      const processStream = async () => {
        for await (const tweet of stream) {
          const sentiment = this.sentimentAnalyzer.analyze(tweet.data.text);
          
          const agentContext = {
            tweet: tweet.data,
            author: tweet.includes?.users?.[0],
            sentiment: {
              score: sentiment,
              classification: this.sentimentAnalyzer.classifySentiment(sentiment)
            },
            metadata: {
              type: 'twitter_mention',
              importance: sentiment * 0.7 + 0.3, // Base importance on sentiment with minimum threshold
              isConsolidated: false,
              consolidationScore: 0,
              isArchived: false
            }
          };

          const task = new Task({
            name: 'Process Twitter mention',
            description: JSON.stringify(agentContext),
            metadata: agentContext.metadata
          });

          const result = await this.agent.execute(task);
          const agentResponse = result.success ? result.output : null;

          // Optionally reply to the tweet
          if (typeof agentResponse === 'string') {
            await this.postTweet({
              text: agentResponse,
              replyToTweetId: tweet.data.id
            });
          }
        }
      };

      // Start processing stream in background
      processStream().catch(console.error);

      return {
        success: true,
        data: { message: 'Twitter stream listener started' }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start Twitter stream'
      };
    }
  }

  async searchTweets(query: string, options?: {
    maxResults?: number;
    startTime?: Date;
    endTime?: Date;
  }): Promise<TaskResult> {
    try {
      const tweets = await this.client.v2.search({
        query,
        max_results: options?.maxResults || 10,
        start_time: options?.startTime?.toISOString(),
        end_time: options?.endTime?.toISOString(),
        'tweet.fields': ['author_id', 'created_at', 'text', 'lang']
      });

      return {
        success: true,
        data: tweets.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search tweets'
      };
    }
  }

  async getUserProfile(userId: string): Promise<TaskResult> {
    try {
      const user = await this.client.v2.user(userId);

      return {
        success: true,
        data: user.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve user profile'
      };
    }
  }

  async automate(task: Task): Promise<TaskResult> {
    try {
      // Create enhanced task for automation
      const automationTask = new Task({
        name: task.name,
        description: task.description,
        metadata: {
          ...task.metadata,
          type: 'twitter_automation',
          importance: 0.8, // High importance for automated tasks
          isConsolidated: false,
          consolidationScore: 0,
          isArchived: false
        }
      });

      const result = await this.agent.execute(automationTask);

      // Post tweet based on execution result
      const tweetResult = await this.postTweet({
        text: typeof result.output === 'string'
          ? result.output
          : JSON.stringify(result.output)
      });

      return {
        success: true,
        data: {
          taskResult: result,
          tweetPosted: tweetResult.success
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Twitter automation failed'
      };
    }
  }
}