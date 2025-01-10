import { Tool, type ToolConfig } from '../tool.js';
import z from 'zod';

// Base URL for the CoinGecko API
const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';

// Input types for different operations
type CoinGeckoInput = {
  operation: 'getTrendingCoins';
  limit?: number;
  includePlatform?: boolean;
} | {
  operation: 'getCoinPrice';
  coinId: string;
  vsCurrency?: string;
  includeMarketCap?: boolean;
  include24hrVol?: boolean;
  include24hrChange?: boolean;
  includeLastUpdatedAt?: boolean;
} | {
  operation: 'searchCoins';
  query: string;
} | {
  operation: 'getCoinPriceByContractAddress';
  id: string;
  contractAddresses: string[];
  vsCurrency?: string;
  includeMarketCap?: boolean;
  include24hrVol?: boolean;
  include24hrChange?: boolean;
  includeLastUpdatedAt?: boolean;
} | {
  operation: 'getCoinData';
  id: string;
  localization?: boolean;
  tickers?: boolean;
  marketData?: boolean;
  communityData?: boolean;
  developerData?: boolean;
  sparkline?: boolean;
} | {
  operation: 'getSupportedCoins';
  includePlatform?: boolean;
} | {
  operation: 'getHistoricalData';
  id: string;
  date: string;
  localization?: boolean;
} | {
  operation: 'getOHLCData';
  id: string;
  vsCurrency?: string;
  days: number;
};

interface CoinGeckoConfig {
  name?: string;
  description?: string;
  apiKey: string;
}

interface CoinGeckoResponse {
  success: boolean;
  data: any;
  error?: string;
}

// Input schema
const coinGeckoInputSchema = z.object({
  operation: z.string(),
  // Common optional fields
  limit: z.number().optional(),
  includePlatform: z.boolean().optional(),
  coinId: z.string().optional(),
  vsCurrency: z.string().optional(),
  includeMarketCap: z.boolean().optional(),
  include24hrVol: z.boolean().optional(),
  include24hrChange: z.boolean().optional(),
  includeLastUpdatedAt: z.boolean().optional(),
  query: z.string().optional(),
  id: z.string().optional(),
  contractAddresses: z.array(z.string()).optional(),
  localization: z.boolean().optional(),
  tickers: z.boolean().optional(),
  marketData: z.boolean().optional(),
  communityData: z.boolean().optional(),
  developerData: z.boolean().optional(),
  sparkline: z.boolean().optional(),
  date: z.string().optional(),
  days: z.number().optional()
});

// Output schema
const coinGeckoOutputSchema = z.object({
  success: z.boolean(),
  data: z.any(),
  error: z.string().optional()
});

export class CoinGeckoTool extends Tool<CoinGeckoInput, CoinGeckoResponse> {
  private readonly apiKey: string;

  constructor(config: CoinGeckoConfig) {
    const toolConfig: ToolConfig<CoinGeckoInput, CoinGeckoResponse> = {
      name: config.name || 'coingecko',
      description: config.description || 'Interact with CoinGecko API for cryptocurrency data',
      inputSchema: coinGeckoInputSchema as any, // Type assertion needed due to zod version limitations
      outputSchema: coinGeckoOutputSchema,
      execute: (input: CoinGeckoInput) => this.execute(input)
    };

    super(toolConfig);
    this.apiKey = config.apiKey;
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'boolean') {
          searchParams.append(key, value ? '1' : '0');
        } else {
          searchParams.append(key, String(value));
        }
      }
    }
    const queryString = searchParams.toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;

    const response = await fetch(url, {
      headers: {
        'x-cg-demo-api-key': this.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async execute(input: CoinGeckoInput): Promise<CoinGeckoResponse> {
    try {
      switch (input.operation) {
        case 'getTrendingCoins': {
          const data = await this.makeRequest(`${COINGECKO_API_BASE_URL}/search/trending`, {
            limit: input.limit,
            include_platform: input.includePlatform
          });
          return { success: true, data };
        }

        case 'getCoinPrice': {
          const data = await this.makeRequest(`${COINGECKO_API_BASE_URL}/simple/price`, {
            ids: input.coinId,
            vs_currencies: input.vsCurrency || 'usd',
            include_market_cap: input.includeMarketCap,
            include_24hr_vol: input.include24hrVol,
            include_24hr_change: input.include24hrChange,
            include_last_updated_at: input.includeLastUpdatedAt
          });
          return { success: true, data };
        }

        case 'searchCoins': {
          const data = await this.makeRequest(`${COINGECKO_API_BASE_URL}/search`, {
            query: input.query
          });
          return { success: true, data };
        }

        case 'getCoinPriceByContractAddress': {
          const data = await this.makeRequest(
            `${COINGECKO_API_BASE_URL}/simple/token_price/${input.id}`,
            {
              contract_addresses: input.contractAddresses.join(','),
              vs_currencies: input.vsCurrency || 'usd',
              include_market_cap: input.includeMarketCap,
              include_24hr_vol: input.include24hrVol,
              include_24hr_change: input.include24hrChange,
              include_last_updated_at: input.includeLastUpdatedAt
            }
          );
          return { success: true, data };
        }

        case 'getCoinData': {
          const data = await this.makeRequest(`${COINGECKO_API_BASE_URL}/coins/${input.id}`, {
            localization: input.localization,
            tickers: input.tickers,
            market_data: input.marketData,
            community_data: input.communityData,
            developer_data: input.developerData,
            sparkline: input.sparkline
          });
          return { success: true, data };
        }

        case 'getSupportedCoins': {
          const data = await this.makeRequest(`${COINGECKO_API_BASE_URL}/coins/list`, {
            include_platform: input.includePlatform
          });
          return { success: true, data };
        }

        case 'getHistoricalData': {
          const data = await this.makeRequest(
            `${COINGECKO_API_BASE_URL}/coins/${input.id}/history`,
            {
              date: input.date,
              localization: input.localization
            }
          );
          return { success: true, data };
        }

        case 'getOHLCData': {
          const data = await this.makeRequest(`${COINGECKO_API_BASE_URL}/coins/${input.id}/ohlc`, {
            vs_currency: input.vsCurrency || 'usd',
            days: input.days
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