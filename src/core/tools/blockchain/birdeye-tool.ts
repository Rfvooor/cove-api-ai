import zod from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../../tool.js';

// Interfaces
export interface BirdeyeTokenData {
  price: number;
  volume24h: number;
  marketCap: number;
  supply: {
    total: number;
    circulating: number;
  };
  priceChange: {
    '1h': number;
    '24h': number;
    '7d': number;
  };
}

export interface BirdeyeResponse {
  success: boolean;
  data: BirdeyeTokenData;
  timestamp: string;
}

export interface BirdeyeToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  apiEndpoint: string;
  apiKey: string;
}

// Constants
const SUPPORTED_CHAINS = ['solana'] as const;
export type ChainType = typeof SUPPORTED_CHAINS[number];

export type BirdeyeToolInput = {
  address: string;
  chain?: ChainType;
};

// Zod Schemas for validation
const birdeyeTokenDataSchema = zod.object({
  price: zod.number(),
  volume24h: zod.number(),
  marketCap: zod.number(),
  supply: zod.object({
    total: zod.number(),
    circulating: zod.number()
  }),
  priceChange: zod.object({
    '1h': zod.number(),
    '24h': zod.number(),
    '7d': zod.number()
  })
});

const birdeyeResponseSchema = zod.object({
  success: zod.boolean(),
  data: birdeyeTokenDataSchema,
  timestamp: zod.string()
});

export class BirdeyeTool {
  private readonly tool: Tool<BirdeyeToolInput, BirdeyeResponse>;
  private readonly apiEndpoint: string;
  private readonly apiKey: string;

  constructor(config: BirdeyeToolConfig) {
    this.apiEndpoint = config.apiEndpoint;
    this.apiKey = config.apiKey;

    const validateInput = (input: BirdeyeToolInput): boolean => {
      if (!input.address) {
        throw new Error("Token address must be provided");
      }
      if (input.chain && !SUPPORTED_CHAINS.includes(input.chain)) {
        throw new Error(`Chain must be one of: ${SUPPORTED_CHAINS.join(', ')}`);
      }
      return true;
    };

    const toolConfig: ToolConfig<BirdeyeToolInput, BirdeyeResponse> = {
      name: config.name || 'birdeye-tool',
      description: config.description || 'Fetches token data from Birdeye API',
      requiredTools: config.requiredTools || [],
      inputSchema: zod.object({
        address: zod.string(),
        chain: zod.string().optional()
      }) as ZodType<BirdeyeToolInput>,
      outputSchema: birdeyeResponseSchema,
      execute: async (input: BirdeyeToolInput) => {
        validateInput(input);
        return this.fetchTokenData(input);
      },
    };

    this.tool = new Tool<BirdeyeToolInput, BirdeyeResponse>(toolConfig);
  }

  private async fetchTokenData(input: BirdeyeToolInput): Promise<BirdeyeResponse> {
    try {
      const chain = input.chain || 'solana';
      const response = await fetch(`${this.apiEndpoint}/${chain}/token/${input.address}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return birdeyeResponseSchema.parse(data);
    } catch (error) {
      console.error('Error fetching Birdeye token data:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(input: BirdeyeToolInput): Promise<BirdeyeResponse> {
    return this.tool.execute(input);
  }

  static create(config: BirdeyeToolConfig): Tool<BirdeyeToolInput, BirdeyeResponse> {
    const instance = new BirdeyeTool(config);
    return instance.tool;
  }
}