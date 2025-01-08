import zod from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../../tool.js';

// Interfaces
export interface CoinGeckoMarketData {
  current_price: {
    usd: number;
  };
  market_cap: {
    usd: number;
  };
  total_volume: {
    usd: number;
  };
  price_change_percentage_24h: number;
  price_change_percentage_7d: number;
  price_change_percentage_30d: number;
  circulating_supply: number;
  total_supply: number;
  max_supply?: number; // Changed from number | null to optional number
}

export interface CoinGeckoTokenData {
  id: string;
  symbol: string;
  name: string;
  market_data: CoinGeckoMarketData;
  last_updated: string;
}

export interface CoinGeckoResponse {
  success: boolean;
  data: CoinGeckoTokenData;
  timestamp: string;
}

export interface CoinGeckoToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  apiEndpoint: string;
  apiKey?: string; // Optional as CoinGecko has a free tier
}

// Constants
const SUPPORTED_VS_CURRENCIES = ['usd', 'eur', 'gbp', 'jpy'] as const;
export type VsCurrency = typeof SUPPORTED_VS_CURRENCIES[number];

export type CoinGeckoToolInput = {
  coinId: string;
  vsCurrency?: VsCurrency;
  includeMarketData?: boolean;
  includeTickers?: boolean;
};

// Zod Schemas for validation
const marketDataSchema = zod.object({
  current_price: zod.object({
    usd: zod.number(),
  }),
  market_cap: zod.object({
    usd: zod.number(),
  }),
  total_volume: zod.object({
    usd: zod.number(),
  }),
  price_change_percentage_24h: zod.number(),
  price_change_percentage_7d: zod.number(),
  price_change_percentage_30d: zod.number(),
  circulating_supply: zod.number(),
  total_supply: zod.number(),
  max_supply: zod.number().optional(),
});

const tokenDataSchema = zod.object({
  id: zod.string(),
  symbol: zod.string(),
  name: zod.string(),
  market_data: marketDataSchema,
  last_updated: zod.string(),
});

const responseSchema = zod.object({
  success: zod.boolean(),
  data: tokenDataSchema,
  timestamp: zod.string(),
});

export class CoinGeckoTool {
  private readonly tool: Tool<CoinGeckoToolInput, CoinGeckoResponse>;
  private readonly apiEndpoint: string;
  private readonly apiKey?: string;

  constructor(config: CoinGeckoToolConfig) {
    this.apiEndpoint = config.apiEndpoint;
    this.apiKey = config.apiKey;

    const validateInput = (input: CoinGeckoToolInput): boolean => {
      if (!input.coinId) {
        throw new Error("Coin ID must be provided");
      }
      if (input.vsCurrency && !SUPPORTED_VS_CURRENCIES.includes(input.vsCurrency)) {
        throw new Error(`Currency must be one of: ${SUPPORTED_VS_CURRENCIES.join(', ')}`);
      }
      return true;
    };

    const toolConfig: ToolConfig<CoinGeckoToolInput, CoinGeckoResponse> = {
      name: config.name || 'coingecko-tool',
      description: config.description || 'Fetches cryptocurrency data from CoinGecko API',
      requiredTools: config.requiredTools || [],
      inputSchema: zod.object({
        coinId: zod.string(),
        vsCurrency: zod.string().optional(),
        includeMarketData: zod.boolean().optional(),
        includeTickers: zod.boolean().optional(),
      }) as ZodType<CoinGeckoToolInput>,
      outputSchema: responseSchema,
      execute: async (input: CoinGeckoToolInput) => {
        validateInput(input);
        return this.fetchTokenData(input);
      },
    };

    this.tool = new Tool<CoinGeckoToolInput, CoinGeckoResponse>(toolConfig);
  }

  private async fetchTokenData(input: CoinGeckoToolInput): Promise<CoinGeckoResponse> {
    try {
      const params = new URLSearchParams({
        vs_currency: input.vsCurrency || 'usd',
        localization: 'false',
        tickers: input.includeTickers ? 'true' : 'false',
        market_data: input.includeMarketData ? 'true' : 'false',
        community_data: 'false',
        developer_data: 'false',
        sparkline: 'false',
      });

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      if (this.apiKey) {
        headers['x-cg-pro-api-key'] = this.apiKey;
      }

      const response = await fetch(
        `${this.apiEndpoint}/coins/${input.coinId}?${params.toString()}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching CoinGecko data:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(input: CoinGeckoToolInput): Promise<CoinGeckoResponse> {
    return this.tool.execute(input);
  }

  static create(config: CoinGeckoToolConfig): Tool<CoinGeckoToolInput, CoinGeckoResponse> {
    const instance = new CoinGeckoTool(config);
    return instance.tool;
  }
}