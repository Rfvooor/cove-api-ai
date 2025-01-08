import zod from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../../tool.js';

// Interfaces
export interface CoinMarketCapQuote {
  price: number;
  volume_24h: number;
  volume_change_24h: number;
  percent_change_1h: number;
  percent_change_24h: number;
  percent_change_7d: number;
  market_cap: number;
  market_cap_dominance: number;
  fully_diluted_market_cap: number;
}

export interface CoinMarketCapTokenData {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  cmc_rank: number;
  num_market_pairs: number;
  circulating_supply: number;
  total_supply: number;
  max_supply?: number;
  last_updated: string;
  date_added: string;
  tags: string[];
  platform?: {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    token_address: string;
  };
  quote: {
    USD: CoinMarketCapQuote;
  };
}

export interface CoinMarketCapResponse {
  success: boolean;
  data: CoinMarketCapTokenData;
  timestamp: string;
}

export interface CoinMarketCapToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  apiEndpoint: string;
  apiKey: string;
}

// Constants
const SUPPORTED_CONVERT_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'] as const;
export type ConvertCurrency = typeof SUPPORTED_CONVERT_CURRENCIES[number];

export type CoinMarketCapToolInput = {
  symbol?: string;
  id?: number;
  slug?: string;
  convert?: ConvertCurrency;
  aux?: string[];
};

// Zod Schemas for validation
const quoteSchema = zod.object({
  price: zod.number(),
  volume_24h: zod.number(),
  volume_change_24h: zod.number(),
  percent_change_1h: zod.number(),
  percent_change_24h: zod.number(),
  percent_change_7d: zod.number(),
  market_cap: zod.number(),
  market_cap_dominance: zod.number(),
  fully_diluted_market_cap: zod.number(),
});

const platformSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  symbol: zod.string(),
  slug: zod.string(),
  token_address: zod.string(),
}).optional();

const tokenDataSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  symbol: zod.string(),
  slug: zod.string(),
  cmc_rank: zod.number(),
  num_market_pairs: zod.number(),
  circulating_supply: zod.number(),
  total_supply: zod.number(),
  max_supply: zod.number().optional(),
  last_updated: zod.string(),
  date_added: zod.string(),
  tags: zod.array(zod.string()),
  platform: platformSchema,
  quote: zod.object({
    USD: quoteSchema,
  }),
});

const responseSchema = zod.object({
  success: zod.boolean(),
  data: tokenDataSchema,
  timestamp: zod.string(),
});

export class CoinMarketCapTool {
  private readonly tool: Tool<CoinMarketCapToolInput, CoinMarketCapResponse>;
  private readonly apiEndpoint: string;
  private readonly apiKey: string;

  constructor(config: CoinMarketCapToolConfig) {
    this.apiEndpoint = config.apiEndpoint;
    this.apiKey = config.apiKey;

    const validateInput = (input: CoinMarketCapToolInput): boolean => {
      if (!input.symbol && !input.id && !input.slug) {
        throw new Error("Either symbol, id, or slug must be provided");
      }
      if (input.convert && !SUPPORTED_CONVERT_CURRENCIES.includes(input.convert)) {
        throw new Error(`Convert currency must be one of: ${SUPPORTED_CONVERT_CURRENCIES.join(', ')}`);
      }
      return true;
    };

    const toolConfig: ToolConfig<CoinMarketCapToolInput, CoinMarketCapResponse> = {
      name: config.name || 'coinmarketcap-tool',
      description: config.description || 'Fetches cryptocurrency data from CoinMarketCap API',
      requiredTools: config.requiredTools || [],
      inputSchema: zod.object({
        symbol: zod.string().optional(),
        id: zod.number().optional(),
        slug: zod.string().optional(),
        convert: zod.string().optional(),
        aux: zod.array(zod.string()).optional(),
      }) as ZodType<CoinMarketCapToolInput>,
      outputSchema: responseSchema,
      execute: async (input: CoinMarketCapToolInput) => {
        validateInput(input);
        return this.fetchTokenData(input);
      },
    };

    this.tool = new Tool<CoinMarketCapToolInput, CoinMarketCapResponse>(toolConfig);
  }

  private async fetchTokenData(input: CoinMarketCapToolInput): Promise<CoinMarketCapResponse> {
    try {
      const params = new URLSearchParams();

      if (input.symbol) {
        params.append('symbol', input.symbol);
      } else if (input.id) {
        params.append('id', input.id.toString());
      } else if (input.slug) {
        params.append('slug', input.slug);
      }

      if (input.convert) {
        params.append('convert', input.convert);
      }

      if (input.aux?.length) {
        params.append('aux', input.aux.join(','));
      }

      const response = await fetch(
        `${this.apiEndpoint}/cryptocurrency/quotes/latest?${params.toString()}`,
        {
          headers: {
            'X-CMC_PRO_API_KEY': this.apiKey,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data[Object.keys(data.data)[0]], // CMC returns an object with token data keyed by ID
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching CoinMarketCap data:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(input: CoinMarketCapToolInput): Promise<CoinMarketCapResponse> {
    return this.tool.execute(input);
  }

  static create(config: CoinMarketCapToolConfig): Tool<CoinMarketCapToolInput, CoinMarketCapResponse> {
    const instance = new CoinMarketCapTool(config);
    return instance.tool;
  }
}