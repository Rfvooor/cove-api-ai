import zod from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../../tool.js';

// Interfaces
export interface MeteoraPoolData {
  address: string;
  token0: {
    address: string;
    symbol: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
  };
  fee: number;
  liquidity: string;
  sqrtPrice: string;
  tick: number;
  tickSpacing: number;
  price0: number;
  price1: number;
  tvlUSD: number;
  volume24h: number;
  volume7d: number;
  fees24h: number;
  fees7d: number;
  apr7d: number;
}

export interface MeteoraPositionData {
  id: string;
  owner: string;
  pool: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  token0: {
    address: string;
    amount: string;
    amountUSD: number;
  };
  token1: {
    address: string;
    amount: string;
    amountUSD: number;
  };
  fees: {
    token0: string;
    token1: string;
  };
  inRange: boolean;
}

export interface MeteoraQuoteData {
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  fee: {
    amount: string;
    token: string;
  };
}

export interface MeteoraResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface MeteoraToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  apiEndpoint: string;
}

export type MeteoraPoolInput = {
  poolAddress?: string;
  token0Address?: string;
  token1Address?: string;
};

export type MeteoraPositionInput = {
  owner: string;
  poolAddress?: string;
};

export type MeteoraQuoteInput = {
  poolAddress: string;
  tokenInAddress: string;
  tokenOutAddress: string;
  amount: string;
  slippage?: number;
};

export type MeteoraToolInput = {
  action: 'getPool' | 'getPosition' | 'getQuote';
  params: MeteoraPoolInput | MeteoraPositionInput | MeteoraQuoteInput;
};

// Zod Schemas for validation
const tokenSchema = zod.object({
  address: zod.string(),
  symbol: zod.string(),
  decimals: zod.number(),
});

const poolDataSchema = zod.object({
  address: zod.string(),
  token0: tokenSchema,
  token1: tokenSchema,
  fee: zod.number(),
  liquidity: zod.string(),
  sqrtPrice: zod.string(),
  tick: zod.number(),
  tickSpacing: zod.number(),
  price0: zod.number(),
  price1: zod.number(),
  tvlUSD: zod.number(),
  volume24h: zod.number(),
  volume7d: zod.number(),
  fees24h: zod.number(),
  fees7d: zod.number(),
  apr7d: zod.number(),
});

const tokenAmountSchema = zod.object({
  address: zod.string(),
  amount: zod.string(),
  amountUSD: zod.number(),
});

const positionDataSchema = zod.object({
  id: zod.string(),
  owner: zod.string(),
  pool: zod.string(),
  tickLower: zod.number(),
  tickUpper: zod.number(),
  liquidity: zod.string(),
  token0: tokenAmountSchema,
  token1: tokenAmountSchema,
  fees: zod.object({
    token0: zod.string(),
    token1: zod.string(),
  }),
  inRange: zod.boolean(),
});

const quoteDataSchema = zod.object({
  amountIn: zod.string(),
  amountOut: zod.string(),
  priceImpact: zod.number(),
  fee: zod.object({
    amount: zod.string(),
    token: zod.string(),
  }),
});

const responseSchema = zod.object({
  success: zod.boolean(),
  data: zod.any(), // We'll validate specific data types in the execute method
  timestamp: zod.string(),
});

const inputSchema = zod.object({
  action: zod.string(),
  params: zod.any(), // We'll validate params in the validateInput method
});

export class MeteoraTool {
  private readonly tool: Tool<MeteoraToolInput, MeteoraResponse<MeteoraPoolData | MeteoraPositionData | MeteoraQuoteData>>;
  private readonly apiEndpoint: string;

  constructor(config: MeteoraToolConfig) {
    this.apiEndpoint = config.apiEndpoint;

    const validateInput = (input: MeteoraToolInput): boolean => {
      if (!input.action) {
        throw new Error("Action must be provided");
      }
      if (!['getPool', 'getPosition', 'getQuote'].includes(input.action)) {
        throw new Error("Action must be one of: getPool, getPosition, getQuote");
      }
      if (!input.params) {
        throw new Error("Parameters must be provided");
      }

      switch (input.action) {
        case 'getPool': {
          const params = input.params as MeteoraPoolInput;
          if (!params.poolAddress && (!params.token0Address || !params.token1Address)) {
            throw new Error("Either poolAddress or both token addresses must be provided");
          }
          break;
        }
        case 'getPosition': {
          const params = input.params as MeteoraPositionInput;
          if (!params.owner) {
            throw new Error("Owner address must be provided");
          }
          break;
        }
        case 'getQuote': {
          const params = input.params as MeteoraQuoteInput;
          if (!params.poolAddress || !params.tokenInAddress || !params.tokenOutAddress || !params.amount) {
            throw new Error("Pool address, input token, output token, and amount are required");
          }
          break;
        }
      }

      return true;
    };

    const toolConfig: ToolConfig<MeteoraToolInput, MeteoraResponse<MeteoraPoolData | MeteoraPositionData | MeteoraQuoteData>> = {
      name: config.name || 'meteora-tool',
      description: config.description || 'Interacts with Meteora DEX API for pool data and trading',
      requiredTools: config.requiredTools || [],
      inputSchema: inputSchema as ZodType<MeteoraToolInput>,
      outputSchema: responseSchema as ZodType<MeteoraResponse<MeteoraPoolData | MeteoraPositionData | MeteoraQuoteData>>,
      execute: async (input: MeteoraToolInput) => {
        validateInput(input);
        return this.executeAction(input);
      },
    };

    this.tool = new Tool<MeteoraToolInput, MeteoraResponse<MeteoraPoolData | MeteoraPositionData | MeteoraQuoteData>>(toolConfig);
  }

  private async executeAction(input: MeteoraToolInput): Promise<MeteoraResponse<MeteoraPoolData | MeteoraPositionData | MeteoraQuoteData>> {
    try {
      let endpoint: string;
      let method = 'GET';
      let queryParams = new URLSearchParams();

      switch (input.action) {
        case 'getPool': {
          const params = input.params as MeteoraPoolInput;
          endpoint = `${this.apiEndpoint}/pools`;
          if (params.poolAddress) {
            endpoint = `${endpoint}/${params.poolAddress}`;
          } else {
            queryParams.append('token0', params.token0Address!);
            queryParams.append('token1', params.token1Address!);
          }
          break;
        }
        case 'getPosition': {
          const params = input.params as MeteoraPositionInput;
          endpoint = `${this.apiEndpoint}/positions`;
          queryParams.append('owner', params.owner);
          if (params.poolAddress) {
            queryParams.append('pool', params.poolAddress);
          }
          break;
        }
        case 'getQuote': {
          const params = input.params as MeteoraQuoteInput;
          endpoint = `${this.apiEndpoint}/quote`;
          queryParams.append('pool', params.poolAddress);
          queryParams.append('tokenIn', params.tokenInAddress);
          queryParams.append('tokenOut', params.tokenOutAddress);
          queryParams.append('amount', params.amount);
          if (params.slippage) {
            queryParams.append('slippage', params.slippage.toString());
          }
          break;
        }
        default:
          throw new Error(`Unsupported action: ${input.action}`);
      }

      const url = queryParams.toString() ? `${endpoint}?${queryParams.toString()}` : endpoint;
      const response = await fetch(url, {
        method,
        headers: {
          'Accept': 'application/json',
        },
      });

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
      console.error('Error executing Meteora action:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(input: MeteoraToolInput): Promise<MeteoraResponse<MeteoraPoolData | MeteoraPositionData | MeteoraQuoteData>> {
    return this.tool.execute(input);
  }

  static create(config: MeteoraToolConfig): Tool<MeteoraToolInput, MeteoraResponse<MeteoraPoolData | MeteoraPositionData | MeteoraQuoteData>> {
    const instance = new MeteoraTool(config);
    return instance.tool;
  }
}