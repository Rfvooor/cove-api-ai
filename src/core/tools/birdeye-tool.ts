import { Tool, type ToolConfig, type SchemaType } from '../tool.js';

const addressTypes = ['token', 'pair'] as const;
const sortTypes = ['asc', 'desc'] as const;
const sortByTypes = ['rank', 'volume24hUSD', 'liquidity'] as const;
const timeIntervals = ['1m', '3m', '15m', '30m', '1H', '2H', '4H', '6H', '8H', '12H', '1D', '3D', '1W', '1M'] as const;
const supportedChains = ['solana', 'ethereum', 'arbitrum', 'avalanche', 'bsc', 'optimism', 'polygon', 'base', 'zksync', 'sui'] as const;
const markets = ['Raydium', 'Raydium CP', 'Raydium Clamm', 'Meteora', 'Meteora DLMM', 'Fluxbeam', 'Pump.fun', 'OpenBook', 'OpenBook V2', 'Orca'] as const;

type AddressType = typeof addressTypes[number];
type SortType = typeof sortTypes[number];
type SortByType = typeof sortByTypes[number];
type TimeInterval = typeof timeIntervals[number];
type Chain = typeof supportedChains[number];
type Market = typeof markets[number];

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
  operation: 'getTokenHistoryPrice';
  address: string;
  addressType: AddressType;
  type: TimeInterval;
  timeFrom?: number;
  timeTo?: number;
  chain: Chain;
} | {
  operation: 'getOhlcv';
  address: string;
  type: TimeInterval;
  timeFrom?: number;
  timeTo?: number;
  chain: Chain;
} | {
  operation: 'getOhlcvPair';
  pairAddress: string;
  type: TimeInterval;
  limit?: number;
  chain: Chain;
} | {
  operation: 'getTokenSecurity';
  address: string;
  chain: Chain;
} | {
  operation: 'getTrendingTokens';
  chain: Chain;
  sortBy: SortByType;
  sortType: SortType;
  offset?: number;
  limit?: number;
} | {
  operation: 'searchToken';
  keyword: string;
  chain: Chain;
  sortBy: string;
  sortType: SortType;
  verifyToken?: boolean;
  markets?: Market[];
  offset?: number;
  limit?: number;
};

interface BirdeyeOutput {
  success: boolean;
  data: TokenPrice[] | TokenHistory[] | OHLCV[] | TokenSecurity | TrendingToken[] | SearchResult[];
  error?: string;
}

interface BirdeyeConfig {
  name?: string;
  description?: string;
  apiKey: string;
}

// Input schema in JSON Schema format
const inputSchema: SchemaType = {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      enum: [
        'getTokenPrice',
        'getTokenHistoryPrice',
        'getOhlcv',
        'getOhlcvPair',
        'getTokenSecurity',
        'getTrendingTokens',
        'searchToken'
      ],
      description: 'The operation to perform'
    },
    addresses: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of token addresses (for getTokenPrice)'
    },
    address: {
      type: 'string',
      description: 'Token or pair address'
    },
    addressType: {
      type: 'string',
      enum: [...addressTypes],
      description: 'Type of address (token or pair)'
    },
    chain: {
      type: 'string',
      enum: [...supportedChains],
      description: 'Blockchain network'
    },
    type: {
      type: 'string',
      enum: [...timeIntervals],
      description: 'Time interval for historical data'
    },
    timeFrom: {
      type: 'number',
      description: 'Start timestamp (Unix)'
    },
    timeTo: {
      type: 'number',
      description: 'End timestamp (Unix)'
    },
    includeLiquidity: {
      type: 'boolean',
      description: 'Include liquidity information'
    },
    sortBy: {
      type: 'string',
      enum: [...sortByTypes],
      description: 'Field to sort by'
    },
    sortType: {
      type: 'string',
      enum: [...sortTypes],
      description: 'Sort direction'
    },
    keyword: {
      type: 'string',
      description: 'Search keyword'
    },
    verifyToken: {
      type: 'boolean',
      description: 'Only return verified tokens'
    },
    markets: {
      type: 'array',
      items: {
        type: 'string',
        enum: [...markets]
      },
      description: 'List of markets to include'
    },
    offset: {
      type: 'number',
      description: 'Pagination offset'
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results'
    }
  },
  required: ['operation', 'chain']
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
      description: 'Response data array',
      items: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          symbol: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' },
          marketCap: { type: 'number' },
          volume24h: { type: 'number' }
        }
      }
    },
    error: {
      type: 'string',
      description: 'Error message if operation failed'
    }
  },
  required: ['success', 'data']
};

export class BirdeyeTool extends Tool<BirdeyeInput, BirdeyeOutput> {
  private readonly baseUrl: string = 'https://public-api.birdeye.so';
  private readonly apiKey: string;

  constructor(config: BirdeyeConfig) {
    const toolConfig: ToolConfig<BirdeyeInput, BirdeyeOutput> = {
      name: config.name || 'Birdeye-Tool',
      description: config.description || `Birdeye API tool for token data and analytics. Available operations:
      - getTokenPrice: Get current price for multiple tokens
      - getTokenHistoryPrice: Get historical price data for a token
      - getOhlcv: Get OHLCV data for a token
      - getOhlcvPair: Get OHLCV data for a trading pair
      - getTokenSecurity: Get security analysis for a token
      - getTrendingTokens: Get trending tokens list
      - searchToken: Search for tokens by keyword

      All operations require 'chain' parameter. Supported chains: ${[...supportedChains].join(', ')}`,
      inputSchema,
      outputSchema,
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

        case 'getTokenHistoryPrice': {
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