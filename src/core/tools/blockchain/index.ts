import { BirdeyeTool } from '../birdeye-tool.js';
import { CoinGeckoTool } from '../coingecko-tool.js';

export type ChainType = 'solana' | 'ethereum' | 'binance' | 'polygon';
export type VsCurrency = 'usd' | 'eur' | 'gbp' | 'btc' | 'eth';

// Birdeye Tool Types
export interface BirdeyeToolConfig {
  apiKey: string;
  chain: ChainType;
  timeout?: number;
}

export interface BirdeyeToolInput {
  address: string;
  chain?: ChainType;
  fields?: string[];
}

export interface BirdeyeTokenData {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  price: number;
  volume24h: number;
  marketCap: number;
  supply: {
    total: number;
    circulating: number;
  };
  holders: number;
  metadata?: Record<string, any>;
}

export interface BirdeyeResponse {
  success: boolean;
  data: BirdeyeTokenData;
  error?: string;
}

// CoinGecko Tool Types
export interface CoinGeckoToolConfig {
  apiKey?: string;
  timeout?: number;
  proxyUrl?: string;
}

export interface CoinGeckoToolInput {
  id?: string;
  symbol?: string;
  vsCurrency?: VsCurrency;
  days?: number;
}

export interface CoinGeckoMarketData {
  currentPrice: number;
  marketCap: number;
  totalVolume: number;
  high24h: number;
  low24h: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  marketCapChange24h: number;
  marketCapChangePercentage24h: number;
  circulatingSupply: number;
  totalSupply: number;
  maxSupply: number | null;
  ath: number;
  athChangePercentage: number;
  athDate: string;
  atl: number;
  atlChangePercentage: number;
  atlDate: string;
  lastUpdated: string;
}

export interface CoinGeckoTokenData {
  id: string;
  symbol: string;
  name: string;
  description?: {
    en: string;
  };
  links?: {
    homepage: string[];
    blockchain_site: string[];
    official_forum_url: string[];
    chat_url: string[];
    announcement_url: string[];
    twitter_screen_name: string;
    telegram_channel_identifier: string;
    subreddit_url: string;
  };
  image?: {
    thumb: string;
    small: string;
    large: string;
  };
  marketData: CoinGeckoMarketData;
  communityData?: {
    twitter_followers: number;
    reddit_subscribers: number;
    telegram_channel_user_count?: number;
  };
  developerData?: {
    forks: number;
    stars: number;
    subscribers: number;
    total_issues: number;
    closed_issues: number;
    pull_requests_merged: number;
    pull_request_contributors: number;
    code_additions_deletions_4_weeks: {
      additions: number;
      deletions: number;
    };
    commit_count_4_weeks: number;
  };
}

export interface CoinGeckoResponse {
  success: boolean;
  data: CoinGeckoTokenData;
  error?: string;
}

// Re-export tools
export { BirdeyeTool, CoinGeckoTool };