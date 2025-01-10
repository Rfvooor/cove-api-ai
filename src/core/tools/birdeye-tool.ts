import { Tool, type ToolConfig } from '../tool.js';
import zod from 'zod';

const supportedChains = [
  'solana',
  'ethereum',
  'arbitrum',
  'avalanche',
  'bsc',
  'optimism',
  'polygon',
  'base',
  'zksync',
  'sui',
] as const;

type Chain = typeof supportedChains[number];

interface BirdeyeConfig {
  name?: string;
  description?: string;
  apiKey: string;
}

interface TokenPrice {
  value: number;
  updateUnixTime: number;
  updateTime: string;
  liquidity?: {
    value: number;
    updateUnixTime: number;
    updateTime: string;
  };
}

interface TokenHistory {
  unixTime: number;
  value: number;
}

interface OHLCV {
  unixTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TokenSecurity {
  address: string;
  chain: Chain;
  score: number;
  details: Record<string, unknown>;
}

interface TrendingToken {
  address: string;
  symbol: string;
  name: string;
  rank: number;
  volume24hUSD: number;
  liquidity: number;
}

interface SearchResult {
  address: string;
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  volume24h: number;
}

type BirdeyeInput = {
  operation: 'getTokenPrice';
  addresses: string[];
  chain: Chain;
  includeLiquidity?: boolean;
} | {
  operation: 'getTokenHistory';
  address: string;
  addressType: 'token' | 'pair';
  type: '1m' | '3m' | '15m' | '30m' | '1H' | '2H' | '4H' | '6H' | '8H' | '12H' | '1D' | '3D' | '1W' | '1M';
  timeFrom?: number;
  timeTo?: number;
  chain: Chain;
} | {
  operation: 'getOhlcv';
  address: string;
  type: '1H' | '4H' | '12H' | '1D' | '1W' | '1M';
  timeFrom?: number;
  timeTo?: number;
  chain: Chain;
} | {
  operation: 'getOhlcvPair';
  pairAddress: string;
  type: '1H' | '4H' | '12H' | '1D' | '1W' | '1M';
  limit?: number;
  chain: Chain;
} | {
  operation: 'getTokenSecurity';
  address: string;
  chain: Chain;
} | {
  operation: 'getTrendingTokens';
  chain: Chain;
  sortBy: 'rank' | 'volume24hUSD' | 'liquidity';
  sortType: 'asc' | 'desc';
  offset?: number;
  limit?: number;
} | {
  operation: 'searchToken';
  keyword: string;
  chain: Chain;
  sortBy: 'fdv' | 'marketcap' | 'liquidity' | 'price' | 'price_change_24h_percent' | 'trade_24h' | 
         'trade_24h_change_percent' | 'buy_24h' | 'buy_24h_change_percent' | 'sell_24h' | 
         'sell_24h_change_percent' | 'unique_wallet_24h' | 'unique_wallet_24h_change_percent' | 
         'last_trade_unix_time' | 'volume_24h_usd' | 'volume_24h_change_percent';
  sortType: 'asc' | 'desc';
  verifyToken?: boolean;
  markets?: Array<'Raydium' | 'Raydium CP' | 'Raydium Clamm' | 'Meteora' | 'Meteora DLMM' | 
                  'Fluxbeam' | 'Pump.fun' | 'OpenBook' | 'OpenBook V2' | 'Orca'>;
  offset?: number;
  limit?: number;
};

type BirdeyeOutput = {
  success: boolean;
  data: TokenPrice[] | TokenHistory[] | OHLCV[] | TokenSecurity | TrendingToken[] | SearchResult[];
  error?: string;
};

export class BirdeyeTool extends Tool<BirdeyeInput, BirdeyeOutput> {
  private readonly baseUrl = 'https://public-api.birdeye.so';
  private readonly apiKey: string;

  constructor(config: BirdeyeConfig) {
    const toolConfig: ToolConfig<BirdeyeInput, BirdeyeOutput> = {
      name: config.name || 'birdeye',
      description: config.description || 'Interact with Birdeye API for token data and analytics',
      execute: (input: BirdeyeInput) => this.execute(input)
    };

    super(toolConfig);
    this.apiKey = config.apiKey;
  }

  private async makeRequest(endpoint: string, chain = 'solana', options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'X-API-KEY': this.apiKey,
        'x-chain': chain
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Birdeye API rate limit exceeded');
      }
      throw new Error(`Birdeye API request failed: ${response.statusText}`);
    }

    return (await response.json()).data;
  }

  async execute(input: BirdeyeInput): Promise<BirdeyeOutput> {
    try {
      switch (input.operation) {
        case 'getTokenPrice': {
          const endpoint = `/defi/multi_price?addresses=${input.addresses.join(',')}${
            input.includeLiquidity ? '&include_liquidity=true' : ''
          }`;
          const data = await this.makeRequest(endpoint, input.chain);
          return { success: true, data };
        }

        case 'getTokenHistory': {
          const queryString = new URLSearchParams({
            address: input.address,
            address_type: input.addressType,
            type: input.type,
            ...(input.timeFrom && { time_from: input.timeFrom.toString() }),
            ...(input.timeTo && { time_to: input.timeTo.toString() })
          }).toString();
          const data = await this.makeRequest(`/defi/history_price?${queryString}`, input.chain);
          return { success: true, data };
        }

        case 'getOhlcv': {
          const queryString = new URLSearchParams({
            address: input.address,
            type: input.type,
            ...(input.timeFrom && { time_from: input.timeFrom.toString() }),
            ...(input.timeTo && { time_to: input.timeTo.toString() })
          }).toString();
          const data = await this.makeRequest(`/defi/ohlcv?${queryString}`, input.chain);
          return { success: true, data };
        }

        case 'getOhlcvPair': {
          const queryString = new URLSearchParams({
            pair_address: input.pairAddress,
            type: input.type,
            ...(input.limit && { limit: input.limit.toString() })
          }).toString();
          const data = await this.makeRequest(`/defi/ohlcv/pair?${queryString}`, input.chain);
          return { success: true, data };
        }

        case 'getTokenSecurity': {
          const data = await this.makeRequest(`/defi/token_security?address=${input.address}`, input.chain);
          return { success: true, data };
        }

        case 'getTrendingTokens': {
          const queryString = new URLSearchParams({
            sort_by: input.sortBy,
            sort_type: input.sortType,
            ...(input.offset && { offset: input.offset.toString() }),
            ...(input.limit && { limit: input.limit.toString() })
          }).toString();
          const data = await this.makeRequest(`/defi/trending_tokens?${queryString}`, input.chain);
          return { success: true, data };
        }

        case 'searchToken': {
          const queryString = new URLSearchParams({
            keyword: input.keyword,
            sort_by: input.sortBy,
            sort_type: input.sortType,
            ...(input.verifyToken !== undefined && { verify_token: input.verifyToken.toString() }),
            ...(input.markets && { markets: input.markets.join(',') }),
            ...(input.offset && { offset: input.offset.toString() }),
            ...(input.limit && { limit: input.limit.toString() })
          }).toString();
          const data = await this.makeRequest(`/defi/v3/search?${queryString}`, input.chain);
          return { success: true, data };
        }
      }
    } catch (error) {
      console.error('Birdeye tool error:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}