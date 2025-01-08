import { Agent, AgentConfig } from '../src/core/agent.js';
import { SwarmRouter, SwarmRouterConfig } from '../src/core/swarm-router.js';
import { TwitterSearchTool, type TwitterSearchResult } from '../src/core/tools/twitter-search-tool.js';
import { SentimentAnalyzer } from '../src/utils/sentiment-analyzer.js';
import { Task, TaskPriority } from '../src/core/task.js';
import { WebhookCronManager } from '../src/utils/webhook-cron.js';
import { 
  SolanaTokenTool, 
  type TokenStats,
  type TokenStatsOptions 
} from '../src/core/tools/solana-token-tool.js';

interface TokenSentimentResult {
  token: TokenStats;
  tweets: Array<{
    text: string;
    sentiment: number;
  }>;
  averageSentiment: number;
}

interface AnalysisContext {
  tokens: TokenStats[];
  sentimentData: TokenSentimentResult[];
  marketConditions: {
    timestamp: string;
    timeframe: string;
    significantMovements: number;
  };
}

async function main() {
  try {
    // Initialize specialized agents
    const marketDataAgent = await Agent.create({
      name: 'MarketDataAgent',
      description: 'Specializes in gathering and analyzing market data',
      systemPrompt: `You are an expert in cryptocurrency market analysis.
        Focus on price movements, volume, and market patterns.`,
      tools: [
        SolanaTokenTool.create({
          apiEndpoint: process.env.COVE_API_ENDPOINT!,
          apiKey: process.env.COVE_API_KEY!,
          name: 'solana-market-data',
          description: 'Fetches Solana token market data and statistics'
        })
      ]
    } as AgentConfig);

    const sentimentAgent = await Agent.create({
      name: 'SentimentAgent',
      description: 'Specializes in sentiment analysis and news impact',
      systemPrompt: `You are an expert in crypto market sentiment analysis.
        Focus on social media sentiment and market trends.`,
      tools: [
        TwitterSearchTool.createTool({
          appKey: process.env.TWITTER_APP_KEY!,
          appSecret: process.env.TWITTER_APP_SECRET!,
          accessToken: process.env.TWITTER_ACCESS_TOKEN!,
          accessSecret: process.env.TWITTER_ACCESS_SECRET!
        }),
        new SentimentAnalyzer()
      ]
    } as AgentConfig);

    const contentAgent = await Agent.create({
      name: 'ContentAgent',
      description: 'Specializes in creating engaging social media content',
      systemPrompt: `You are an expert in creating engaging crypto market updates.
        Focus on clear, informative, and engaging content.`,
      tools: []
    } as AgentConfig);

    // Initialize swarm for collaborative analysis
    const swarm = new SwarmRouter({
      name: 'CryptoAnalysisSwarm',
      description: 'A swarm of agents specialized in crypto market analysis',
      agents: [marketDataAgent, sentimentAgent, contentAgent],
      swarm_type: 'CollaborativeSolving',
      max_loops: 3,
      collaboration_threshold: 0.7
    });

    // Initialize cron manager for scheduled tasks
    const cronManager = new WebhookCronManager(contentAgent);

    // Register hourly analysis task
    cronManager.registerCronTask({
      name: 'hourly-crypto-analysis',
      schedule: '0 * * * *', // Every hour
      task: async () => {
        // 1. Gather market data
        const marketDataTask = new Task({
          name: 'Gather Solana Token Data',
          description: 'Collect current data for top Solana tokens',
          priority: TaskPriority.HIGH,
          metadata: {
            type: 'token_analysis',
            options: {
              period: '24h',
              minMarketCap: Number(process.env.MIN_MARKET_CAP_FILTER),
              minVolume: Number(process.env.MIN_DAILY_VOLUME),
              limit: 10,
              sortBy: 'volume',
              sortOrder: 'desc',
              getHolderData: true
            } as TokenStatsOptions
          }
        });

        const marketData = await marketDataAgent.execute(marketDataTask);
        const tokenResults = marketData.output?.data || [];

        // Process tokens with significant movements
        const processedTokens: TokenSentimentResult[] = await Promise.all(
          tokenResults
            .filter((token: TokenStats) => {
              const priceChangeThreshold = Number(process.env.PRICE_CHANGE_THRESHOLD);
              return Math.abs(token.priceChange || 0) >= priceChangeThreshold ||
                     (token.holderData?.newHolders || 0) > 100;
            })
            .map(async (token: TokenStats) => {
              const searchQuery = `${token.symbol} solana token`;
              const tweetsTask = new Task({
                name: 'Search Token Tweets',
                description: `Find recent tweets about ${token.symbol}`,
                priority: TaskPriority.HIGH,
                metadata: { searchQuery }
              });

              // Get tweets
              const tweetsResult = await sentimentAgent.execute(tweetsTask);
              const tweets = tweetsResult.output || [];

              // Analyze sentiment for each tweet
              const analyzedTweets = await Promise.all(tweets.map(async (tweet: TwitterSearchResult) => {
                const sentimentTask = new Task({
                  name: 'Analyze Tweet Sentiment',
                  description: 'Analyze sentiment of tweet',
                  priority: TaskPriority.MEDIUM,
                  metadata: { text: tweet.text }
                });
                const sentimentResult = await sentimentAgent.execute(sentimentTask);
                return {
                  text: tweet.text,
                  sentiment: sentimentResult.output?.score || 0
                };
              }));

              return {
                token,
                tweets: analyzedTweets,
                averageSentiment: analyzedTweets.reduce((acc, t) => acc + t.sentiment, 0) / analyzedTweets.length
              };
            })
        );

        // Generate platform-specific updates
        const formatTask = new Task({
          name: 'Format Social Updates',
          description: 'Create platform-specific market updates',
          priority: TaskPriority.HIGH,
          metadata: {
            analysisContext: {
              tokens: processedTokens.map(result => result.token),
              sentimentData: processedTokens,
              marketConditions: {
                timestamp: new Date().toISOString(),
                timeframe: '24h',
                significantMovements: processedTokens.length
              }
            } as AnalysisContext
          }
        });

        const formattedUpdates = await contentAgent.execute(formatTask);
        const updates = formattedUpdates.output || {};

        // Post significant movements to social media
        if (processedTokens.length > 0) {
          const emergencyThreshold = Number(process.env.EMERGENCY_ALERT_THRESHOLD);
          const hasEmergencyUpdates = processedTokens.some(
            result => Math.abs(result.token.priceChange || 0) >= emergencyThreshold
          );

          console.log('Market updates generated:', {
            timestamp: new Date().toISOString(),
            tokenCount: processedTokens.length,
            hasEmergencyUpdates,
            updates
          });
        }
      }
    });

    // Handle cleanup on shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      
      // Cleanup agents
      await Promise.all([
        cronManager.removeWebhook('hourly-crypto-analysis'),
        cronManager.removeCronTask('hourly-crypto-analysis'),
        ...swarm.agents.map(agent => agent.cleanup())
      ]);

      console.log('Cleanup completed');
      process.exit(0);
    });

    console.log('Crypto Analysis Agent started');
    console.log('Monitoring market data and posting updates hourly');

  } catch (error) {
    console.error('Error in crypto analysis agent:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);