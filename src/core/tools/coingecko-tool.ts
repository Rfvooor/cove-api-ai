import { Tool, type ToolConfig, type SchemaType } from '../tool.js';

// Base URL for the CoinGecko API
const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';

// Constants for validation
const SORT_BY_VALUES = ['market_cap', 'name', 'symbol', 'date_added', 'market_cap_strict', 'price',
  'circulating_supply', 'total_supply', 'max_supply', 'num_market_pairs',
  'volume_24h', 'percent_change_1h', 'percent_change_24h', 'percent_change_7d',
  'market_cap_by_total_supply_strict', 'volume_7d', 'volume_30d'] as const;

const SORT_DIR_VALUES = ['asc', 'desc'] as const;
const CRYPTO_TYPE_VALUES = ['all', 'coins', 'tokens'] as const;

type SortBy = typeof SORT_BY_VALUES[number];
type SortDir = typeof SORT_DIR_VALUES[number];
type CryptoType = typeof CRYPTO_TYPE_VALUES[number];

type CoinGeckoInput = {
  operation: 'getListings';
  start?: number;
  limit?: number;
  sort?: SortBy;
  sortDir?: SortDir;
  cryptoType?: CryptoType;
  tag?: string;
  convert?: string;
} | {
  operation: 'getQuotes';
  id?: string[];
  symbol?: string[];
  convert?: string;
} | {
  operation: 'getOHLCV';
  id?: string[];
  symbol?: string[];
  convert?: string;
  convertId?: string;
  skipInvalid?: boolean;
} | {
  operation: 'getTrending';
  start?: number;
  limit?: number;
  timePeriod?: '24h' | '30d' | '7d';
  convert?: string;
  convertId?: string;
} | {
  operation: 'getMostVisited';
  start?: number;
  limit?: number;
  timePeriod?: '24h' | '30d' | '7d';
  convert?: string;
  convertId?: string;
} | {
  operation: 'getGainersLosers';
  start?: number;
  limit?: number;
  timePeriod?: '1h' | '24h' | '7d' | '30d';
  convert?: string;
  convertId?: string;
  sortDir?: SortDir;
} | {
  operation: 'getMap';
  listingStatus?: 'active' | 'inactive' | 'untracked';
  start?: number;
  limit?: number;
  sort?: 'cmc_rank' | 'id' | 'name';
  symbol?: string[];
};

interface CoinGeckoResponse {
  success: boolean;
  data: any;
  error?: string;
}

interface CoinGeckoConfig {
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
        'getListings',
        'getQuotes',
        'getOHLCV',
        'getTrending',
        'getMostVisited',
        'getGainersLosers',
        'getMap'
      ],
      description: 'The operation to perform'
    },
    start: {
      type: 'number',
      description: 'Starting position for pagination',
      minimum: 1
    },
    limit: {
      type: 'number',
      description: 'Number of results to return',
      minimum: 1,
      maximum: 5000
    },
    sort: {
      type: 'string',
      enum: [...SORT_BY_VALUES],
      description: 'Field to sort by'
    },
    sortDir: {
      type: 'string',
      enum: [...SORT_DIR_VALUES],
      description: 'Sort direction'
    },
    cryptoType: {
      type: 'string',
      enum: [...CRYPTO_TYPE_VALUES],
      description: 'Type of cryptocurrency'
    },
    tag: {
      type: 'string',
      description: 'Tag to filter by'
    },
    convert: {
      type: 'string',
      description: 'Currency to convert prices to'
    },
    id: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of coin IDs'
    },
    symbol: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of coin symbols'
    },
    convertId: {
      type: 'string',
      description: 'ID of the currency to convert to'
    },
    skipInvalid: {
      type: 'boolean',
      description: 'Whether to skip invalid entries'
    },
    timePeriod: {
      type: 'string',
      enum: ['1h', '24h', '7d', '30d'],
      description: 'Time period for data'
    },
    listingStatus: {
      type: 'string',
      enum: ['active', 'inactive', 'untracked'],
      description: 'Status of coin listing'
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
      type: 'object',
      description: 'Response data'
    },
    error: {
      type: 'string',
      description: 'Error message if operation failed'
    }
  },
  required: ['success', 'data']
};

export class CoinGeckoTool extends Tool<CoinGeckoInput, CoinGeckoResponse> {
  private readonly apiKey: string;

  constructor(config: CoinGeckoConfig) {
    const toolConfig: ToolConfig<CoinGeckoInput, CoinGeckoResponse> = {
      name: config.name || 'coingecko',
      description: config.description || `CoinGecko API tool for cryptocurrency data. Available operations:
      - getListings: Get list of cryptocurrencies
      - getQuotes: Get current prices for coins
      - getOHLCV: Get OHLCV data for coins
      - getTrending: Get trending coins
      - getMostVisited: Get most visited coins
      - getGainersLosers: Get top gainers and losers
      - getMap: Get CoinGecko ID mappings

      Features:
      - Real-time price data
      - Historical data
      - Market statistics
      - Trending coins
      - Price conversions`,
      inputSchema,
      outputSchema,
      execute: (input: CoinGeckoInput) => this.execute(input)
    };

    super(toolConfig);
    this.apiKey = config.apiKey;
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    const queryString = new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            acc[key] = value.join(',');
          } else {
            acc[key] = String(value);
          }
        }
        return acc;
      }, {} as Record<string, string>)
    ).toString();

    const url = queryString ? `${COINGECKO_API_BASE_URL}${endpoint}?${queryString}` : `${COINGECKO_API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          'x-cg-demo-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`CoinGecko API Error: ${response.status} - ${errorData?.status?.error_message || response.statusText}`);
      }

      return (await response.json()).data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred while fetching data');
    }
  }

  async execute(input: CoinGeckoInput): Promise<CoinGeckoResponse> {
    try {
      switch (input.operation) {
        case 'getListings': {
          const data = await this.makeRequest('/cryptocurrency/listings/latest', {
            start: input.start,
            limit: input.limit,
            sort: input.sort,
            sort_dir: input.sortDir,
            cryptocurrency_type: input.cryptoType,
            tag: input.tag,
            convert: input.convert
          });
          return { success: true, data };
        }

        case 'getQuotes': {
          const data = await this.makeRequest('/cryptocurrency/quotes/latest', {
            id: input.id,
            symbol: input.symbol,
            convert: input.convert
          });
          return { success: true, data };
        }

        case 'getOHLCV': {
          const data = await this.makeRequest('/cryptocurrency/ohlcv/latest', {
            id: input.id,
            symbol: input.symbol,
            convert: input.convert,
            convert_id: input.convertId,
            skip_invalid: input.skipInvalid
          });
          return { success: true, data };
        }

        case 'getTrending': {
          const data = await this.makeRequest('/cryptocurrency/trending/latest', {
            start: input.start,
            limit: input.limit,
            time_period: input.timePeriod,
            convert: input.convert,
            convert_id: input.convertId
          });
          return { success: true, data };
        }

        case 'getMostVisited': {
          const data = await this.makeRequest('/cryptocurrency/trending/most-visited', {
            start: input.start,
            limit: input.limit,
            time_period: input.timePeriod,
            convert: input.convert,
            convert_id: input.convertId
          });
          return { success: true, data };
        }

        case 'getGainersLosers': {
          const data = await this.makeRequest('/cryptocurrency/trending/gainers-losers', {
            start: input.start,
            limit: input.limit,
            time_period: input.timePeriod,
            convert: input.convert,
            convert_id: input.convertId,
            sort_dir: input.sortDir
          });
          return { success: true, data };
        }

        case 'getMap': {
          const data = await this.makeRequest('/cryptocurrency/map', {
            listing_status: input.listingStatus,
            start: input.start,
            limit: input.limit,
            sort: input.sort,
            symbol: input.symbol
          });
          return { success: true, data };
        }

        default:
          throw new Error(`Unsupported operation: ${(input as any).operation}`);
      }
    } catch (error) {
      console.error('CoinGecko tool error:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}