import { Tool, type ToolConfig, type SchemaType } from '../tool.js';

// Constants for validation
const SORT_BY_VALUES = ['netFlow', 'volume', 'txCount', 'uniqueMakers', 'priceChange'] as const;
const SORT_ORDER_VALUES = ['asc', 'desc'] as const;
const TIME_PERIODS = ['1m', '5m', '15m', '30m', '1h', '4h', '12h', '1d'] as const;

type SortBy = typeof SORT_BY_VALUES[number];
type SortOrder = typeof SORT_ORDER_VALUES[number];
type TimePeriod = typeof TIME_PERIODS[number];

interface TokenStats {
  address: string;
  symbol: string;
  marketCap?: number;
  netFlow?: number;
  priceChange?: number;
  txCount?: number;
  uniqueMakers?: number;
  volume?: number;
  holderData?: {
    totalHolders: number;
    newHolders: number;
  };
}

interface TokenStatsResponse {
  success: boolean;
  data: TokenStats[];
  creditCost: number;
  timestamp: string;
}

type TokenStatsOptions = {
  debug?: boolean;
  period: TimePeriod;
  minMarketCap?: number;
  maxMarketCap?: number;
  minNetFlow?: number;
  maxNetFlow?: number;
  minPriceChange?: number;
  maxPriceChange?: number;
  minTxCount?: number;
  maxTxCount?: number;
  minUniqueMakers?: number;
  maxUniqueMakers?: number;
  startTimestamp?: number;
  endTimestamp?: number;
  limit?: number;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  tokenAddresses?: string[];
  tokenRefs?: number[];
  getHolderData?: boolean;
  detailed?: boolean;
  onlyPumpTokens?: boolean;
};

export interface SolanaTokenToolConfig {
  name?: string;
  description?: string;
  apiEndpoint: string;
  apiKey: string;
}

// Input schema in JSON Schema format
const inputSchema: SchemaType = {
  type: 'object',
  properties: {
    period: {
      type: 'string',
      enum: [...TIME_PERIODS],
      description: 'Time period for data analysis'
    },
    minMarketCap: {
      type: 'number',
      description: 'Minimum market capitalization in USD'
    },
    maxMarketCap: {
      type: 'number',
      description: 'Maximum market capitalization in USD'
    },
    minNetFlow: {
      type: 'number',
      description: 'Minimum net flow in USD'
    },
    maxNetFlow: {
      type: 'number',
      description: 'Maximum net flow in USD'
    },
    minPriceChange: {
      type: 'number',
      description: 'Minimum price change percentage'
    },
    maxPriceChange: {
      type: 'number',
      description: 'Maximum price change percentage'
    },
    minTxCount: {
      type: 'number',
      description: 'Minimum transaction count'
    },
    maxTxCount: {
      type: 'number',
      description: 'Maximum transaction count'
    },
    minUniqueMakers: {
      type: 'number',
      description: 'Minimum unique makers count'
    },
    maxUniqueMakers: {
      type: 'number',
      description: 'Maximum unique makers count'
    },
    startTimestamp: {
      type: 'number',
      description: 'Start timestamp (Unix)'
    },
    endTimestamp: {
      type: 'number',
      description: 'End timestamp (Unix)'
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results',
      minimum: 1,
      maximum: 100,
      default: 20
    },
    sortBy: {
      type: 'string',
      enum: [...SORT_BY_VALUES],
      description: 'Field to sort by'
    },
    sortOrder: {
      type: 'string',
      enum: [...SORT_ORDER_VALUES],
      description: 'Sort direction'
    },
    tokenAddresses: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of token addresses to filter by'
    },
    tokenRefs: {
      type: 'array',
      items: { type: 'number' },
      description: 'List of token reference IDs'
    },
    getHolderData: {
      type: 'boolean',
      description: 'Include holder statistics',
      default: true
    },
    detailed: {
      type: 'boolean',
      description: 'Include detailed token information',
      default: true
    },
    onlyPumpTokens: {
      type: 'boolean',
      description: 'Only include tokens with significant price increases',
      default: false
    },
    debug: {
      type: 'boolean',
      description: 'Enable debug logging',
      default: false
    }
  },
  required: ['period']
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
      description: 'Array of token statistics',
      items: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Token contract address'
          },
          symbol: {
            type: 'string',
            description: 'Token symbol'
          },
          marketCap: {
            type: 'number',
            description: 'Market capitalization in USD'
          },
          netFlow: {
            type: 'number',
            description: 'Net flow in USD'
          },
          priceChange: {
            type: 'number',
            description: 'Price change percentage'
          },
          txCount: {
            type: 'number',
            description: 'Transaction count'
          },
          uniqueMakers: {
            type: 'number',
            description: 'Number of unique makers'
          },
          volume: {
            type: 'number',
            description: 'Trading volume in USD'
          },
          holderData: {
            type: 'object',
            properties: {
              totalHolders: {
                type: 'number',
                description: 'Total number of token holders'
              },
              newHolders: {
                type: 'number',
                description: 'Number of new holders in period'
              }
            }
          }
        },
        required: ['address', 'symbol']
      }
    },
    creditCost: {
      type: 'number',
      description: 'API credits used for this request'
    },
    timestamp: {
      type: 'string',
      description: 'Timestamp of the response'
    }
  },
  required: ['success', 'data', 'creditCost', 'timestamp']
};

class SolanaTokenToolImpl extends Tool<TokenStatsOptions, TokenStatsResponse> {
  private readonly apiEndpoint: string;
  private readonly apiKey: string;

  constructor(config: ToolConfig<TokenStatsOptions, TokenStatsResponse>, apiEndpoint: string, apiKey: string) {
    super(config);
    this.apiEndpoint = apiEndpoint;
    this.apiKey = apiKey;
  }

  async execute(options: TokenStatsOptions): Promise<TokenStatsResponse> {
    try {
      const queryParams = new URLSearchParams();

      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((v) => {
              if (v !== undefined && v !== null) {
                queryParams.append(`${key}[]`, String(v));
              }
            });
          } else {
            queryParams.append(key, String(value));
          }
        }
      });

      const response = await fetch(`${this.apiEndpoint}/token/stats?${queryParams.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'Origin': 'https://covequant.com'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.tokens,
        creditCost: data.creditCost,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching token stats:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}

export class SolanaTokenTool {
  static create(config: SolanaTokenToolConfig): Tool<TokenStatsOptions, TokenStatsResponse> {
    const toolConfig: ToolConfig<TokenStatsOptions, TokenStatsResponse> = {
      name: config.name || 'solana-token-tool',
      description: config.description || `Solana token analysis tool with comprehensive metrics. Features:
      - Market capitalization tracking
      - Price change analysis
      - Transaction volume monitoring
      - Holder statistics
      - Net flow analysis
      - Unique maker tracking
      
      Time periods: ${[...TIME_PERIODS].join(', ')}
      Sort fields: ${[...SORT_BY_VALUES].join(', ')}
      Sort orders: ${[...SORT_ORDER_VALUES].join(', ')}`,
      inputSchema,
      outputSchema,
      execute: async (input: TokenStatsOptions) => {
        const tool = new SolanaTokenToolImpl(toolConfig, config.apiEndpoint, config.apiKey);
        return tool.execute(input);
      }
    };

    return new SolanaTokenToolImpl(toolConfig, config.apiEndpoint, config.apiKey);
  }
}