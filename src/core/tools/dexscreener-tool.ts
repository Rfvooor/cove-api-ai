import { Tool, type ToolConfig, type SchemaType } from '../tool.js';

// Base URL for the DexScreener API
const DEXSCREENER_API_BASE_URL = 'https://api.dexscreener.com/latest';

// Constants for validation
const SORT_BY_VALUES = ['liquidity', 'volume', 'txCount', 'uniqueMakers', 'priceChange'] as const;
const SORT_ORDER_VALUES = ['asc', 'desc'] as const;
const MARKETS = ['Raydium', 'Raydium CP', 'Raydium Clamm', 'Meteora', 'Meteora DLMM', 'Fluxbeam', 'Pump.fun', 'OpenBook', 'OpenBook V2', 'Orca'] as const;

type SortBy = typeof SORT_BY_VALUES[number];
type SortOrder = typeof SORT_ORDER_VALUES[number];
type Market = typeof MARKETS[number];

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    h1: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h1: number;
    h24: number;
  };
  priceChange: {
    h1: number;
    h24: number;
  };
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
}

type DexScreenerInput = {
  operation: 'getPairsByChainAndPair';
  chainId: string;
  pairAddress: string;
} | {
  operation: 'searchPairs';
  query: string;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  markets?: Market[];
  offset?: number;
  limit?: number;
} | {
  operation: 'getTokenPairs';
  tokenAddress: string;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  offset?: number;
  limit?: number;
};

interface DexScreenerResponse {
  success: boolean;
  data: DexScreenerPair[];
  error?: string;
}

interface DexScreenerConfig {
  name?: string;
  description?: string;
  rateLimitPerMinute?: number;
}

// Input schema in JSON Schema format
const inputSchema: SchemaType = {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      enum: [
        'getPairsByChainAndPair',
        'searchPairs',
        'getTokenPairs'
      ],
      description: 'The operation to perform'
    },
    chainId: {
      type: 'string',
      description: 'Blockchain network identifier'
    },
    pairAddress: {
      type: 'string',
      description: 'Trading pair contract address'
    },
    query: {
      type: 'string',
      description: 'Search query (token name, symbol, or address)'
    },
    sortBy: {
      type: 'string',
      enum: [...SORT_BY_VALUES],
      description: 'Field to sort results by'
    },
    sortOrder: {
      type: 'string',
      enum: [...SORT_ORDER_VALUES],
      description: 'Sort direction'
    },
    markets: {
      type: 'array',
      items: {
        type: 'string',
        enum: [...MARKETS]
      },
      description: 'List of DEX markets to include'
    },
    tokenAddress: {
      type: 'string',
      description: 'Token contract address'
    },
    offset: {
      type: 'number',
      description: 'Number of items to skip',
      minimum: 0
    },
    limit: {
      type: 'number',
      description: 'Maximum number of items to return',
      minimum: 1,
      maximum: 100,
      default: 20
    }
  },
  required: ['operation']
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
      description: 'Array of trading pair data',
      items: {
        type: 'object',
        properties: {
          chainId: { type: 'string' },
          dexId: { type: 'string' },
          pairAddress: { type: 'string' },
          baseToken: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              name: { type: 'string' },
              symbol: { type: 'string' }
            }
          },
          quoteToken: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              name: { type: 'string' },
              symbol: { type: 'string' }
            }
          },
          priceUsd: { type: 'string' },
          volume: {
            type: 'object',
            properties: {
              h1: { type: 'number' },
              h24: { type: 'number' }
            }
          },
          liquidity: {
            type: 'object',
            properties: {
              usd: { type: 'number' }
            }
          }
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

export class DexScreenerTool extends Tool<DexScreenerInput, DexScreenerResponse> {
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number;

  constructor(config: DexScreenerConfig = {}) {
    const toolConfig: ToolConfig<DexScreenerInput, DexScreenerResponse> = {
      name: config.name || 'dexscreener',
      description: config.description || `DexScreener API tool for DEX trading pair data. Available operations:
      - getPairsByChainAndPair: Get trading pair details by chain and address
      - searchPairs: Search for trading pairs by token name, symbol, or address
      - getTokenPairs: Get all trading pairs for a specific token

      Features:
      - Real-time price data
      - Trading volume metrics
      - Liquidity information
      - Transaction counts
      - Price change tracking
      - Multi-DEX support
      
      Supported DEXs: ${[...MARKETS].join(', ')}`,
      inputSchema,
      outputSchema,
      execute: (input: DexScreenerInput) => this.execute(input)
    };

    super(toolConfig);

    // Rate limit: default 300 requests per minute (5 per second)
    this.minRequestInterval = 60000 / (config.rateLimitPerMinute || 300);
  }

  private async throttleRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
  }

  private async makeRequest(endpoint: string): Promise<any> {
    await this.throttleRequest();

    const response = await fetch(`${DEXSCREENER_API_BASE_URL}${endpoint}`);

    if (!response.ok) {
      throw new Error(`DexScreener API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async execute(input: DexScreenerInput): Promise<DexScreenerResponse> {
    try {
      switch (input.operation) {
        case 'getPairsByChainAndPair': {
          const data = await this.makeRequest(
            `/dex/pairs/${input.chainId}/${input.pairAddress}`
          );
          return { success: true, data: data.pairs || [] };
        }

        case 'searchPairs': {
          const queryParams = new URLSearchParams({
            q: input.query,
            ...(input.sortBy && { sort_by: input.sortBy }),
            ...(input.sortOrder && { sort_order: input.sortOrder }),
            ...(input.markets && { markets: input.markets.join(',') }),
            ...(input.offset !== undefined && { offset: input.offset.toString() }),
            ...(input.limit !== undefined && { limit: input.limit.toString() })
          });
          const data = await this.makeRequest(
            `/dex/search/?${queryParams.toString()}`
          );
          return { success: true, data: data.pairs || [] };
        }

        case 'getTokenPairs': {
          const queryParams = new URLSearchParams({
            ...(input.sortBy && { sort_by: input.sortBy }),
            ...(input.sortOrder && { sort_order: input.sortOrder }),
            ...(input.offset !== undefined && { offset: input.offset.toString() }),
            ...(input.limit !== undefined && { limit: input.limit.toString() })
          });
          const endpoint = `/dex/tokens/${input.tokenAddress}${
            queryParams.toString() ? `?${queryParams.toString()}` : ''
          }`;
          const data = await this.makeRequest(endpoint);
          return { success: true, data: data.pairs || [] };
        }

        default:
          throw new Error(`Unsupported operation: ${(input as any).operation}`);
      }
    } catch (error) {
      console.error('DexScreener tool error:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}