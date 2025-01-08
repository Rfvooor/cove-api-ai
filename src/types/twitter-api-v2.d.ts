declare module 'twitter-api-v2' {
  export interface TwitterApiOptions {
    appKey: string;
    appSecret: string;
    accessToken: string;
    accessSecret: string;
  }

  export interface TweetV2PostParams {
    text: string;
    media?: {
      media_ids: string[];
    };
    reply?: {
      in_reply_to_tweet_id: string;
    };
  }

  export interface TweetSearchOptions {
    query: string;
    max_results?: number;
    start_time?: string;
    end_time?: string;
    'tweet.fields'?: string[];
  }

  export interface TweetSearchResponse {
    data: {
      id: string;
      text: string;
      author_id: string;
      created_at: string;
      lang: string;
    }[];
    includes?: {
      users?: Array<{
        id: string;
        name: string;
        username: string;
      }>;
    };
  }

  export interface UserResponse {
    data: {
      id: string;
      name: string;
      username: string;
    };
  }

  export interface StreamOptions {
    'tweet.fields'?: string[];
    expansions?: string[];
    language?: string;
  }

  export interface StreamTweet {
    data: {
      id: string;
      text: string;
      author_id: string;
      created_at: string;
      lang: string;
    };
    includes?: {
      users?: Array<{
        id: string;
        name: string;
        username: string;
      }>;
    };
  }

  export class TwitterApi {
    constructor(options: TwitterApiOptions);

    v2: {
      tweet(params: TweetV2PostParams): Promise<{ data: { id: string; text: string } }>;
      search(options: TweetSearchOptions): Promise<TweetSearchResponse>;
      user(userId: string): Promise<UserResponse>;
      searchStream(options?: StreamOptions): Promise<AsyncIterableIterator<StreamTweet>>;
    };
  }

  export default TwitterApi;
}