import { TwitterApi, TweetV2PostParams } from 'twitter-api-v2';
import { randomUUID } from 'crypto';
import { Agent } from '../core/agent.js';
import { SentimentAnalyzer } from '../utils/sentiment-analyzer.js';
import { Task, TaskResult, TaskStatus } from '../core/task.js';

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
    const startTime = new Date();
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
      const endTime = new Date();

      return {
        id: randomUUID(),
        status: TaskStatus.COMPLETED,
        output: tweet,
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime(),
        metrics: {
          tokenCount: options.text.length,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: options.text.length
        }
      };
    } catch (error) {
      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error.message : 'Failed to post tweet',
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    }
  }

  async listenToMentions(filter?: StreamFilter): Promise<TaskResult> {
    const startTime = new Date();
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
              importance: sentiment * 0.7 + 0.3,
              isConsolidated: false,
              consolidationScore: 0,
              isArchived: false
            }
          };

          const task = new Task({
            type: 'agent',
            executorId: this.agent.id,
            input: {
              name: 'Process Twitter mention',
              description: JSON.stringify(agentContext),
              prompt: tweet.data.text,
              metadata: agentContext.metadata
            },
            timeout: 30000,
            retryConfig: {
              maxAttempts: 3,
              backoffMultiplier: 1.5,
              initialDelay: 1000,
              maxDelay: 30000
            }
          });

          task.setExecutor(this.agent);
          const result = await task.execute();

          // Store interaction in agent's memory
          await this.agent.memory.add({
            content: `Tweet: ${tweet.data.text}\nResponse: ${result.output}`,
            type: 'conversation',
            metadata: {
              tweetId: tweet.data.id,
              authorId: tweet.data.author_id,
              sentiment,
              taskResult: result
            }
          });

          // Optionally reply to the tweet
          if (result.status === TaskStatus.COMPLETED && typeof result.output === 'string') {
            await this.postTweet({
              text: result.output,
              replyToTweetId: tweet.data.id
            });
          }
        }
      };

      // Start processing stream in background
      processStream().catch(console.error);

      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.COMPLETED,
        output: { message: 'Twitter stream listener started' },
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    } catch (error) {
      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error.message : 'Failed to start Twitter stream',
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    }
  }

  async searchTweets(query: string, options?: {
    maxResults?: number;
    startTime?: Date;
    endTime?: Date;
  }): Promise<TaskResult> {
    const startTime = new Date();
    try {
      const tweets = await this.client.v2.search({
        query,
        max_results: options?.maxResults || 10,
        start_time: options?.startTime?.toISOString(),
        end_time: options?.endTime?.toISOString(),
        'tweet.fields': ['author_id', 'created_at', 'text', 'lang']
      });

      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.COMPLETED,
        output: tweets.data,
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    } catch (error) {
      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error.message : 'Failed to search tweets',
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    }
  }

  async getUserProfile(userId: string): Promise<TaskResult> {
    const startTime = new Date();
    try {
      const user = await this.client.v2.user(userId);
      const endTime = new Date();

      return {
        id: randomUUID(),
        status: TaskStatus.COMPLETED,
        output: user.data,
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    } catch (error) {
      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error.message : 'Failed to retrieve user profile',
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    }
  }

  async automate(task: Task): Promise<TaskResult> {
    const startTime = new Date();
    try {
      // Create enhanced task for automation
      const automationTask = new Task({
        type: 'agent',
        executorId: this.agent.id,
        input: {
          name: task.toJSON().name,
          description: task.toJSON().input.description,
          prompt: task.toJSON().input.prompt,
          metadata: {
            ...task.toJSON().input.metadata,
            type: 'twitter_automation',
            importance: 0.8
          }
        },
        timeout: 30000,
        retryConfig: {
          maxAttempts: 3,
          backoffMultiplier: 1.5,
          initialDelay: 1000,
          maxDelay: 30000
        }
      });

      automationTask.setExecutor(this.agent);
      const result = await automationTask.execute();

      // Store automation result in memory
      await this.agent.memory.add({
        content: `Automation task: ${task.toJSON().name}\nResult: ${result.output}`,
        type: 'task',
        metadata: {
          taskId: task.id,
          automationType: 'twitter',
          result
        }
      });

      // Post tweet based on execution result
      const tweetText = typeof result.output === 'string'
        ? result.output
        : JSON.stringify(result.output);
        
      const tweetResult = await this.postTweet({
        text: tweetText
      });

      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.COMPLETED,
        output: {
          taskResult: result,
          tweetPosted: tweetResult.status === TaskStatus.COMPLETED,
          tweetLength: tweetText.length
        },
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime(),
        metrics: {
          ...result.metrics
        }
      };
    } catch (error) {
      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error.message : 'Twitter automation failed',
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    }
  }
}