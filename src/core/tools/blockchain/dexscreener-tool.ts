import zod from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../../tool.js';

// Interfaces
export interface DexScreenerPairData {
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
    h1: {
      buys: number;
      sells: number;
    };
    h24: {
      buys: number;
      sells: number;
    };
  };
  volume: {
    h1: number;
    h24: number;
  };
  priceChange: {
    h1: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
}

export interface DexScreenerResponse {
  success: boolean;
  data: DexScreenerPairData[];
  timestamp: string;
}

export interface DexScreenerToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  apiEndpoint: string;
}

// Constants
const SUPPORTED_CHAINS = [
  'solana'
] as const;
export type ChainType = typeof SUPPORTED_CHAINS[number];

export type DexScreenerToolInput = {
  search: string;
  chainId?: ChainType;
  limit?: number;
};

// Zod Schemas for validation
const pairDataSchema = zod.object({
  chainId: zod.string(),
  dexId: zod.string(),
  url: zod.string(),
  pairAddress: zod.string(),
  baseToken: zod.object({
    address: zod.string(),
    name: zod.string(),
    symbol: zod.string(),
  }),
  quoteToken: zod.object({
    address: zod.string(),
    name: zod.string(),
    symbol: zod.string(),
  }),
  priceNative: zod.string(),
  priceUsd: zod.string(),
  txns: zod.object({
    h1: zod.object({
      buys: zod.number(),
      sells: zod.number(),
    }),
    h24: zod.object({
      buys: zod.number(),
      sells: zod.number(),
    }),
  }),
  volume: zod.object({
    h1: zod.number(),
    h24: zod.number(),
  }),
  priceChange: zod.object({
    h1: zod.number(),
    h24: zod.number(),
  }),
  liquidity: zod.object({
    usd: zod.number(),
    base: zod.number(),
    quote: zod.number(),
  }),
  fdv: zod.number(),
  marketCap: zod.number(),
});

const responseSchema = zod.object({
  success: zod.boolean(),
  data: zod.array(pairDataSchema),
  timestamp: zod.string(),
});

const inputSchema = zod.object({
  search: zod.string(),
  chainId: zod.string().optional(),
  limit: zod.number().optional(),
});

export class DexScreenerTool {
  private readonly tool: Tool<DexScreenerToolInput, DexScreenerResponse>;
  private readonly apiEndpoint: string;

  constructor(config: DexScreenerToolConfig) {
    this.apiEndpoint = config.apiEndpoint;

    const validateInput = (input: DexScreenerToolInput): boolean => {
      if (!input.search) {
        throw new Error("Search term must be provided");
      }
      if (input.chainId && !SUPPORTED_CHAINS.includes(input.chainId)) {
        throw new Error(`Chain must be one of: ${SUPPORTED_CHAINS.join(', ')}`);
      }
      if (input.limit && (input.limit < 1 || input.limit > 100)) {
        throw new Error("Limit must be between 1 and 100");
      }
      return true;
    };

    const toolConfig: ToolConfig<DexScreenerToolInput, DexScreenerResponse> = {
      name: config.name || 'dexscreener-tool',
      description: config.description || 'Fetches trading pair data from DexScreener API',
      requiredTools: config.requiredTools || [],
      inputSchema: inputSchema as ZodType<DexScreenerToolInput>,
      outputSchema: responseSchema,
      execute: async (input: DexScreenerToolInput) => {
        validateInput(input);
        return this.fetchPairData(input);
      },
    };

    this.tool = new Tool<DexScreenerToolInput, DexScreenerResponse>(toolConfig);
  }

  private async fetchPairData(input: DexScreenerToolInput): Promise<DexScreenerResponse> {
    try {
      const params = new URLSearchParams();
      params.append('search', input.search);
      
      if (input.chainId) {
        params.append('chainId', input.chainId);
      }
      
      if (input.limit) {
        params.append('limit', input.limit.toString());
      }

      const response = await fetch(
        `${this.apiEndpoint}/pairs/search?${params.toString()}`,
        {
          headers: {
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
        data: data.pairs || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching DexScreener data:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(input: DexScreenerToolInput): Promise<DexScreenerResponse> {
    return this.tool.execute(input);
  }

  static create(config: DexScreenerToolConfig): Tool<DexScreenerToolInput, DexScreenerResponse> {
    const instance = new DexScreenerTool(config);
    return instance.tool;
  }
}