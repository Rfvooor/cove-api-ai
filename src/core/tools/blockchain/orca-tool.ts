import zod from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../../tool.js';

// Interfaces
export interface OrcaPoolData {
  address: string;
  type: 'constantProduct' | 'concentratedLiquidity';
  tokenA: {
    address: string;
    symbol: string;
    decimals: number;
    reserve: string;
  };
  tokenB: {
    address: string;
    symbol: string;
    decimals: number;
    reserve: string;
  };
  fees: {
    tradeFee: number;
    ownerFee: number;
  };
  price: {
    tokenA: number;
    tokenB: number;
  };
  liquidity: {
    total: string;
    tokenA: string;
    tokenB: string;
  };
  volume: {
    h24: number;
    h7d: number;
  };
  apr: {
    total: number;
    fee: number;
    rewards?: number[];
  };
}

export interface OrcaWhirlpoolData extends OrcaPoolData {
  type: 'concentratedLiquidity';
  tickSpacing: number;
  tickCurrent: number;
  sqrtPrice: string;
  feeGrowthGlobalA: string;
  feeGrowthGlobalB: string;
  rewardInfos: Array<{
    mint: string;
    vault: string;
    authority: string;
    emissionsPerSecond: string;
    growthGlobalX64: string;
  }>;
}

export interface OrcaPositionData {
  address: string;
  owner: string;
  pool: string;
  liquidity: string;
  tickLowerIndex: number;
  tickUpperIndex: number;
  tokenA: {
    address: string;
    amount: string;
  };
  tokenB: {
    address: string;
    amount: string;
  };
  fees: {
    owed0: string;
    owed1: string;
  };
  rewards: Array<{
    mint: string;
    amount: string;
    amountOwed: string;
  }>;
}

export interface OrcaQuoteData {
  inAmount: string;
  outAmount: string;
  minOutAmount: string;
  priceImpact: number;
  fee: {
    amount: string;
    mint: string;
    percent: number;
  };
  route: Array<{
    poolAddress: string;
    tokenIn: string;
    tokenOut: string;
    quotedInAmount: string;
    quotedOutAmount: string;
    fee: number;
  }>;
}

export interface OrcaResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface OrcaToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  apiEndpoint: string;
}

export type OrcaPoolInput = {
  poolAddress?: string;
  tokenA?: string;
  tokenB?: string;
  poolType?: 'constantProduct' | 'concentratedLiquidity';
};

export type OrcaPositionInput = {
  positionAddress?: string;
  owner?: string;
  poolAddress?: string;
};

export type OrcaQuoteInput = {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  slippage?: number;
  limit?: number;
};

export type OrcaToolInput = {
  action: 'getPool' | 'getPosition' | 'getQuote';
  params: OrcaPoolInput | OrcaPositionInput | OrcaQuoteInput;
};

// Zod Schemas for validation
const tokenDataSchema = zod.object({
  address: zod.string(),
  symbol: zod.string(),
  decimals: zod.number(),
  reserve: zod.string(),
});

const poolDataSchema = zod.object({
  address: zod.string(),
  type: zod.string(),
  tokenA: tokenDataSchema,
  tokenB: tokenDataSchema,
  fees: zod.object({
    tradeFee: zod.number(),
    ownerFee: zod.number(),
  }),
  price: zod.object({
    tokenA: zod.number(),
    tokenB: zod.number(),
  }),
  liquidity: zod.object({
    total: zod.string(),
    tokenA: zod.string(),
    tokenB: zod.string(),
  }),
  volume: zod.object({
    h24: zod.number(),
    h7d: zod.number(),
  }),
  apr: zod.object({
    total: zod.number(),
    fee: zod.number(),
    rewards: zod.array(zod.number()).optional(),
  }),
});

// Separate schema for whirlpool data
const whirlpoolDataSchema = zod.object({
  address: zod.string(),
  type: zod.string(),
  tokenA: tokenDataSchema,
  tokenB: tokenDataSchema,
  fees: zod.object({
    tradeFee: zod.number(),
    ownerFee: zod.number(),
  }),
  price: zod.object({
    tokenA: zod.number(),
    tokenB: zod.number(),
  }),
  liquidity: zod.object({
    total: zod.string(),
    tokenA: zod.string(),
    tokenB: zod.string(),
  }),
  volume: zod.object({
    h24: zod.number(),
    h7d: zod.number(),
  }),
  apr: zod.object({
    total: zod.number(),
    fee: zod.number(),
    rewards: zod.array(zod.number()).optional(),
  }),
  tickSpacing: zod.number(),
  tickCurrent: zod.number(),
  sqrtPrice: zod.string(),
  feeGrowthGlobalA: zod.string(),
  feeGrowthGlobalB: zod.string(),
  rewardInfos: zod.array(zod.object({
    mint: zod.string(),
    vault: zod.string(),
    authority: zod.string(),
    emissionsPerSecond: zod.string(),
    growthGlobalX64: zod.string(),
  })),
});

const positionDataSchema = zod.object({
  address: zod.string(),
  owner: zod.string(),
  pool: zod.string(),
  liquidity: zod.string(),
  tickLowerIndex: zod.number(),
  tickUpperIndex: zod.number(),
  tokenA: zod.object({
    address: zod.string(),
    amount: zod.string(),
  }),
  tokenB: zod.object({
    address: zod.string(),
    amount: zod.string(),
  }),
  fees: zod.object({
    owed0: zod.string(),
    owed1: zod.string(),
  }),
  rewards: zod.array(zod.object({
    mint: zod.string(),
    amount: zod.string(),
    amountOwed: zod.string(),
  })),
});

const quoteDataSchema = zod.object({
  inAmount: zod.string(),
  outAmount: zod.string(),
  minOutAmount: zod.string(),
  priceImpact: zod.number(),
  fee: zod.object({
    amount: zod.string(),
    mint: zod.string(),
    percent: zod.number(),
  }),
  route: zod.array(zod.object({
    poolAddress: zod.string(),
    tokenIn: zod.string(),
    tokenOut: zod.string(),
    quotedInAmount: zod.string(),
    quotedOutAmount: zod.string(),
    fee: zod.number(),
  })),
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

export class OrcaTool {
  private readonly tool: Tool<OrcaToolInput, OrcaResponse<OrcaPoolData | OrcaWhirlpoolData | OrcaPositionData | OrcaQuoteData>>;
  private readonly apiEndpoint: string;

  constructor(config: OrcaToolConfig) {
    this.apiEndpoint = config.apiEndpoint;

    const validateInput = (input: OrcaToolInput): boolean => {
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
          const params = input.params as OrcaPoolInput;
          if (!params.poolAddress && (!params.tokenA || !params.tokenB)) {
            throw new Error("Either poolAddress or both token addresses must be provided");
          }
          if (params.poolType && !['constantProduct', 'concentratedLiquidity'].includes(params.poolType)) {
            throw new Error("Pool type must be either 'constantProduct' or 'concentratedLiquidity'");
          }
          break;
        }
        case 'getPosition': {
          const params = input.params as OrcaPositionInput;
          if (!params.positionAddress && !params.owner) {
            throw new Error("Either position address or owner address must be provided");
          }
          break;
        }
        case 'getQuote': {
          const params = input.params as OrcaQuoteInput;
          if (!params.tokenIn || !params.tokenOut || !params.amount) {
            throw new Error("Token in, token out, and amount are required");
          }
          if (params.slippage && (params.slippage < 0 || params.slippage > 100)) {
            throw new Error("Slippage must be between 0 and 100");
          }
          break;
        }
      }

      return true;
    };

    const toolConfig: ToolConfig<OrcaToolInput, OrcaResponse<OrcaPoolData | OrcaWhirlpoolData | OrcaPositionData | OrcaQuoteData>> = {
      name: config.name || 'orca-tool',
      description: config.description || 'Interacts with Orca DEX API for pool data and trading',
      requiredTools: config.requiredTools || [],
      inputSchema: inputSchema as ZodType<OrcaToolInput>,
      outputSchema: responseSchema as ZodType<OrcaResponse<OrcaPoolData | OrcaWhirlpoolData | OrcaPositionData | OrcaQuoteData>>,
      execute: async (input: OrcaToolInput) => {
        validateInput(input);
        return this.executeAction(input);
      },
    };

    this.tool = new Tool<OrcaToolInput, OrcaResponse<OrcaPoolData | OrcaWhirlpoolData | OrcaPositionData | OrcaQuoteData>>(toolConfig);
  }

  private async executeAction(input: OrcaToolInput): Promise<OrcaResponse<OrcaPoolData | OrcaWhirlpoolData | OrcaPositionData | OrcaQuoteData>> {
    try {
      let endpoint: string;
      let method = 'GET';
      let queryParams = new URLSearchParams();

      switch (input.action) {
        case 'getPool': {
          const params = input.params as OrcaPoolInput;
          endpoint = `${this.apiEndpoint}/pools`;
          if (params.poolAddress) {
            endpoint = `${endpoint}/${params.poolAddress}`;
          } else {
            queryParams.append('tokenA', params.tokenA!);
            queryParams.append('tokenB', params.tokenB!);
            if (params.poolType) {
              queryParams.append('type', params.poolType);
            }
          }
          break;
        }
        case 'getPosition': {
          const params = input.params as OrcaPositionInput;
          endpoint = `${this.apiEndpoint}/positions`;
          if (params.positionAddress) {
            endpoint = `${endpoint}/${params.positionAddress}`;
          } else {
            queryParams.append('owner', params.owner!);
            if (params.poolAddress) {
              queryParams.append('pool', params.poolAddress);
            }
          }
          break;
        }
        case 'getQuote': {
          const params = input.params as OrcaQuoteInput;
          endpoint = `${this.apiEndpoint}/quote`;
          queryParams.append('tokenIn', params.tokenIn);
          queryParams.append('tokenOut', params.tokenOut);
          queryParams.append('amount', params.amount);
          if (params.slippage) {
            queryParams.append('slippage', params.slippage.toString());
          }
          if (params.limit) {
            queryParams.append('limit', params.limit.toString());
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
      console.error('Error executing Orca action:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(input: OrcaToolInput): Promise<OrcaResponse<OrcaPoolData | OrcaWhirlpoolData | OrcaPositionData | OrcaQuoteData>> {
    return this.tool.execute(input);
  }

  static create(config: OrcaToolConfig): Tool<OrcaToolInput, OrcaResponse<OrcaPoolData | OrcaWhirlpoolData | OrcaPositionData | OrcaQuoteData>> {
    const instance = new OrcaTool(config);
    return instance.tool;
  }
}