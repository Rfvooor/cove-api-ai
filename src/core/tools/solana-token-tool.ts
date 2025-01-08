import zod from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../tool.js';

// Interfaces
export interface TokenStats {
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

export interface TokenOHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TokenResponse {
  id: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  creationTime?: Date;
}

export interface TokenStatsResponse {
  success: boolean;
  data: TokenStats[];
  creditCost: number;
  timestamp: string;
}

export interface TokenOHLCVResponse {
  success: boolean;
  data: TokenOHLCV[];
  creditCost: number;
  timestamp: string;
}

export interface TokenHolderData {
  token_address: string;
  total_holders: number;
  new_holders: number;
}

// Constants
export const DEFAULT_FIELDS = [
  'swapTime',
  'swapValueUSD',
  'swapAmountIn',
  'swapAmountOut',
  'tokenInRef',
  'tokenOutRef',
  'addressRef',
  'dexKey',
  'txnHash',
  'slot',
] as const;

export const DEX_MAPPINGS = {
  raydium: 0,
  pump: 1,
  jupiter: 2,
} as const;

export const UNIT_TO_SECONDS = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
} as const;

export type TokenField = (typeof DEFAULT_FIELDS)[number];
export type DexType = keyof typeof DEX_MAPPINGS;
export type TimeUnit = keyof typeof UNIT_TO_SECONDS;

// Zod Schemas for validation
const sortByValues = ['netFlow', 'volume', 'txCount', 'uniqueMakers', 'priceChange'] as const;
const sortOrderValues = ['asc', 'desc'] as const;

type SortBy = typeof sortByValues[number];
type SortOrder = typeof sortOrderValues[number];

const tokenStatsOptionsSchema = zod.object({
  debug: zod.boolean().optional(),
  period: zod.string(),
  minMarketCap: zod.number().optional(),
  maxMarketCap: zod.number().optional(),
  minNetFlow: zod.number().optional(),
  maxNetFlow: zod.number().optional(),
  minPriceChange: zod.number().optional(),
  maxPriceChange: zod.number().optional(),
  minTxCount: zod.number().optional(),
  maxTxCount: zod.number().optional(),
  minUniqueMakers: zod.number().optional(),
  maxUniqueMakers: zod.number().optional(),
  startTimestamp: zod.number().optional(),
  endTimestamp: zod.number().optional(),
  limit: zod.number().optional(),
  sortBy: zod.string().optional(),
  sortOrder: zod.string().optional(),
  dexes: zod.array(zod.string()).optional(),
  tokenAddresses: zod.array(zod.string()).optional(),
  tokenRefs: zod.array(zod.number()).optional(),
  getHolderData: zod.boolean().optional(),
  detailed: zod.boolean().optional(),
  onlyPumpTokens: zod.boolean().optional(),
});

const tokenStatsSchema = zod.object({
  address: zod.string(),
  symbol: zod.string(),
  marketCap: zod.number().optional(),
  netFlow: zod.number().optional(),
  priceChange: zod.number().optional(),
  txCount: zod.number().optional(),
  uniqueMakers: zod.number().optional(),
  volume: zod.number().optional(),
  holderData: zod.object({
    totalHolders: zod.number(),
    newHolders: zod.number(),
  }).optional(),
});

const tokenStatsResponseSchema = zod.object({
  success: zod.boolean(),
  data: zod.array(tokenStatsSchema),
  creditCost: zod.number(),
  timestamp: zod.string(),
});

export type TokenStatsOptions = {
  debug?: boolean;
  period: string;
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
  dexes?: string[];
  tokenAddresses?: string[];
  tokenRefs?: number[];
  getHolderData?: boolean;
  detailed?: boolean;
  onlyPumpTokens?: boolean;
};

export type TokenToolInput = {
  address?: string;
  symbol?: string;
  options?: TokenStatsOptions;
};

export interface SolanaTokenToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  apiEndpoint: string;
  apiKey: string;
}

export class SolanaTokenTool {
  private readonly tool: Tool<TokenToolInput, TokenStatsResponse>;
  private readonly apiEndpoint: string;
  private readonly apiKey: string;

  constructor(config: SolanaTokenToolConfig) {
    this.apiEndpoint = config.apiEndpoint;
    this.apiKey = config.apiKey;

    const validateInput = (input: TokenToolInput): boolean => {
      if (!input.address && !input.symbol) {
        throw new Error("Either address or symbol must be provided");
      }
      if (input.options?.sortBy && !sortByValues.includes(input.options.sortBy)) {
        throw new Error(`Invalid sortBy value. Must be one of: ${sortByValues.join(', ')}`);
      }
      if (input.options?.sortOrder && !sortOrderValues.includes(input.options.sortOrder)) {
        throw new Error(`Invalid sortOrder value. Must be one of: ${sortOrderValues.join(', ')}`);
      }
      return true;
    };

    const toolConfig: ToolConfig<TokenToolInput, TokenStatsResponse> = {
      name: config.name || 'solana-token-tool',
      description: config.description || 'Fetches data for Solana memecoins by address or symbol',
      requiredTools: config.requiredTools || [],
      inputSchema: zod.object({
        address: zod.string().optional(),
        symbol: zod.string().optional(),
        options: tokenStatsOptionsSchema.optional(),
      }) as ZodType<TokenToolInput>,
      outputSchema: tokenStatsResponseSchema,
      execute: async (input: TokenToolInput) => {
        validateInput(input);
        return this.fetchTokenData(input);
      },
    };

    this.tool = new Tool<TokenToolInput, TokenStatsResponse>(toolConfig);
  }

  private async fetchTokenData(input: TokenToolInput): Promise<TokenStatsResponse> {
    try {
      const queryParams = new URLSearchParams();

      if (input.address) {
        queryParams.append('address', input.address);
      } else if (input.symbol) {
        queryParams.append('symbol', input.symbol);
      }

      if (input.options) {
        Object.entries(input.options).forEach(([key, value]) => {
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
      }

      const response = await fetch(`${this.apiEndpoint}/tokens?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return tokenStatsResponseSchema.parse(data);
    } catch (error) {
      console.error('Error fetching token data:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(input: TokenToolInput): Promise<TokenStatsResponse> {
    return this.tool.execute(input);
  }

  static create(config: SolanaTokenToolConfig): Tool<TokenToolInput, TokenStatsResponse> {
    const instance = new SolanaTokenTool(config);
    return instance.tool;
  }
}