import zod from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../../tool.js';

// Interfaces
export interface JupiterQuoteData {
  inputMint: string;
  outputMint: string;
  amount: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  routes: Array<{
    routePlan: Array<{
      swapInfo: {
        ammKey: string;
        label: string;
        inputMint: string;
        outputMint: string;
        inAmount: string;
        outAmount: string;
        feeAmount: string;
        feeMint: string;
      };
    }>;
    amount: string;
    otherAmountThreshold: string;
    swapMode: 'ExactIn' | 'ExactOut';
    priceImpactPct: number;
    marketInfos: Array<{
      id: string;
      label: string;
      inputMint: string;
      outputMint: string;
      notEnoughLiquidity: boolean;
      inAmount: string;
      outAmount: string;
      minInAmount?: string;
      minOutAmount?: string;
      priceImpactPct: number;
      lpFee: {
        amount: string;
        mint: string;
        pct: number;
      };
    }>;
  }>;
}

export interface JupiterSwapData {
  swapTransaction: string;
  lastValidBlockHeight: number;
}

export interface JupiterResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface JupiterToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  apiEndpoint: string;
}

export type JupiterQuoteInput = {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  swapMode?: 'ExactIn' | 'ExactOut';
  onlyDirectRoutes?: boolean;
};

export type JupiterSwapInput = {
  quoteResponse: JupiterQuoteData;
  userPublicKey: string;
  wrapUnwrapSOL?: boolean;
};

export type JupiterToolInput = {
  action: 'quote' | 'swap';
  params: JupiterQuoteInput | JupiterSwapInput;
};

// Zod Schemas for validation
const marketInfoSchema = zod.object({
  id: zod.string(),
  label: zod.string(),
  inputMint: zod.string(),
  outputMint: zod.string(),
  notEnoughLiquidity: zod.boolean(),
  inAmount: zod.string(),
  outAmount: zod.string(),
  minInAmount: zod.string().optional(),
  minOutAmount: zod.string().optional(),
  priceImpactPct: zod.number(),
  lpFee: zod.object({
    amount: zod.string(),
    mint: zod.string(),
    pct: zod.number(),
  }),
});

const swapInfoSchema = zod.object({
  ammKey: zod.string(),
  label: zod.string(),
  inputMint: zod.string(),
  outputMint: zod.string(),
  inAmount: zod.string(),
  outAmount: zod.string(),
  feeAmount: zod.string(),
  feeMint: zod.string(),
});

const routePlanSchema = zod.object({
  swapInfo: swapInfoSchema,
});

const routeSchema = zod.object({
  routePlan: zod.array(routePlanSchema),
  amount: zod.string(),
  otherAmountThreshold: zod.string(),
  swapMode: zod.string(),
  priceImpactPct: zod.number(),
  marketInfos: zod.array(marketInfoSchema),
});

const quoteDataSchema = zod.object({
  inputMint: zod.string(),
  outputMint: zod.string(),
  amount: zod.string(),
  swapMode: zod.string(),
  slippageBps: zod.number(),
  routes: zod.array(routeSchema),
});

const swapDataSchema = zod.object({
  swapTransaction: zod.string(),
  lastValidBlockHeight: zod.number(),
});

const responseSchema = zod.object({
  success: zod.boolean(),
  data: zod.any(), // We'll validate the specific data type in the execute method
  timestamp: zod.string(),
});

const inputSchema = zod.object({
  action: zod.string(),
  params: zod.any(), // We'll validate params in the validateInput method
});

export class JupiterTool {
  private readonly tool: Tool<JupiterToolInput, JupiterResponse<JupiterQuoteData | JupiterSwapData>>;
  private readonly apiEndpoint: string;

  constructor(config: JupiterToolConfig) {
    this.apiEndpoint = config.apiEndpoint;

    const validateInput = (input: JupiterToolInput): boolean => {
      if (!input.action) {
        throw new Error("Action must be provided");
      }
      if (!['quote', 'swap'].includes(input.action)) {
        throw new Error("Action must be either 'quote' or 'swap'");
      }
      if (!input.params) {
        throw new Error("Parameters must be provided");
      }

      if (input.action === 'quote') {
        const params = input.params as JupiterQuoteInput;
        if (!params.inputMint || !params.outputMint || !params.amount) {
          throw new Error("Quote requires inputMint, outputMint, and amount");
        }
      } else if (input.action === 'swap') {
        const params = input.params as JupiterSwapInput;
        if (!params.quoteResponse || !params.userPublicKey) {
          throw new Error("Swap requires quoteResponse and userPublicKey");
        }
      }

      return true;
    };

    const toolConfig: ToolConfig<JupiterToolInput, JupiterResponse<JupiterQuoteData | JupiterSwapData>> = {
      name: config.name || 'jupiter-tool',
      description: config.description || 'Interacts with Jupiter Aggregator API for Solana token swaps',
      requiredTools: config.requiredTools || [],
      inputSchema: inputSchema as ZodType<JupiterToolInput>,
      outputSchema: responseSchema as ZodType<JupiterResponse<JupiterQuoteData | JupiterSwapData>>,
      execute: async (input: JupiterToolInput) => {
        validateInput(input);
        return this.executeAction(input);
      },
    };

    this.tool = new Tool<JupiterToolInput, JupiterResponse<JupiterQuoteData | JupiterSwapData>>(toolConfig);
  }

  private async executeAction(input: JupiterToolInput): Promise<JupiterResponse<JupiterQuoteData | JupiterSwapData>> {
    try {
      let endpoint: string;
      let method: string;
      let body: any;

      if (input.action === 'quote') {
        const params = input.params as JupiterQuoteInput;
        endpoint = `${this.apiEndpoint}/quote`;
        method = 'GET';
        const queryParams = new URLSearchParams({
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          amount: params.amount,
          slippageBps: (params.slippageBps || 50).toString(),
          swapMode: params.swapMode || 'ExactIn',
          onlyDirectRoutes: (params.onlyDirectRoutes || false).toString(),
        });
        endpoint = `${endpoint}?${queryParams.toString()}`;
      } else {
        const params = input.params as JupiterSwapInput;
        endpoint = `${this.apiEndpoint}/swap`;
        method = 'POST';
        body = {
          quoteResponse: params.quoteResponse,
          userPublicKey: params.userPublicKey,
          wrapUnwrapSOL: params.wrapUnwrapSOL || false,
        };
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        ...(body && { body: JSON.stringify(body) }),
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
      console.error('Error executing Jupiter action:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(input: JupiterToolInput): Promise<JupiterResponse<JupiterQuoteData | JupiterSwapData>> {
    return this.tool.execute(input);
  }

  static create(config: JupiterToolConfig): Tool<JupiterToolInput, JupiterResponse<JupiterQuoteData | JupiterSwapData>> {
    const instance = new JupiterTool(config);
    return instance.tool;
  }
}