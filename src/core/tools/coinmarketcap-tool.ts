import { Tool, type ToolConfig } from '../tool.js';
import z from 'zod';

// Base URL for the CoinMarketCap API
const COINMARKETCAP_API_BASE_URL = 'https://pro-api.coinmarketcap.com';

// Input types for different operations
type CoinMarketCapInput = {
  operation: 'getListings';
  start?: number;
  limit?: number;
  sort?: 'market_cap' | 'name' | 'symbol' | 'date_added' | 'market_cap_strict' | 'price' |
         'circulating_supply' | 'total_supply' | 'max_supply' | 'num_market_pairs' |
         'volume_24h' | 'percent_change_1h' | 'percent_change_24h' | 'percent_change_7d' |
         'market_cap_by_total_supply_strict' | 'volume_7d' | 'volume_30d';
  sortDir?: 'asc' | 'desc';
  cryptoType?: 'all' | 'coins' | 'tokens';
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
  sortDir?: 'asc' | 'desc';
} | {
  operation: 'getMap';
  listingStatus?: 'active' | 'inactive' | 'untracked';
  start?: number;
  limit?: number;
  sort?: 'cmc_rank' | 'id' | 'name';
  symbol?: string[];
};

interface CoinMarketCapConfig {
  name?: string;
  description?: string;
  apiKey: string;
}

interface CoinMarketCapResponse {
  success: boolean;
  data: any;
  error?: string;
}

// Input schema
const coinMarketCapInputSchema = z.object({
  operation: z.string(),
  start: z.number().optional(),
  limit: z.number().optional(),
  sort: z.string().optional(),
  sortDir: z.string().optional(),
  cryptoType: z.string().optional(),
  tag: z.string().optional(),
  convert: z.string().optional(),
  id: z.array(z.string()).optional(),
  symbol: z.array(z.string()).optional(),
  convertId: z.string().optional(),
  skipInvalid: z.boolean().optional(),
  timePeriod: z.string().optional(),
  listingStatus: z.string().optional()
});

// Output schema
const coinMarketCapOutputSchema = z.object({
  success: z.boolean(),
  data: z.any(),
  error: z.string().optional()
});

export class CoinMarketCapTool extends Tool<CoinMarketCapInput, CoinMarketCapResponse> {
  private readonly apiKey: string;

  constructor(config: CoinMarketCapConfig) {
    const toolConfig: ToolConfig<CoinMarketCapInput, CoinMarketCapResponse> = {
      name: config.name || 'coinmarketcap',
      description: config.description || 'Interact with CoinMarketCap API for cryptocurrency data',
      inputSchema: coinMarketCapInputSchema as any,
      outputSchema: coinMarketCapOutputSchema,
      execute: (input: CoinMarketCapInput) => this.execute(input)
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

    const url = queryString ? `${COINMARKETCAP_API_BASE_URL}${endpoint}?${queryString}` : `${COINMARKETCAP_API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          'X-CMC_PRO_API_KEY': this.apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`CoinMarketCap API Error: ${response.status} - ${errorData?.status?.error_message || response.statusText}`);
      }

      return (await response.json()).data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred while fetching data');
    }
  }

  async execute(input: CoinMarketCapInput): Promise<CoinMarketCapResponse> {
    try {
      switch (input.operation) {
        case 'getListings': {
          const data = await this.makeRequest('/v1/cryptocurrency/listings/latest', {
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
          const data = await this.makeRequest('/v2/cryptocurrency/quotes/latest', {
            id: input.id,
            symbol: input.symbol,
            convert: input.convert
          });
          return { success: true, data };
        }

        case 'getOHLCV': {
          const data = await this.makeRequest('/v2/cryptocurrency/ohlcv/latest', {
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
          const data = await this.makeRequest('/v1/cryptocurrency/map', {
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
      console.error('CoinMarketCap tool error:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}