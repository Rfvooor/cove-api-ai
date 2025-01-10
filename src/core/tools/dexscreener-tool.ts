import { Tool, type ToolConfig } from '../tool.js';
import z from 'zod';

// Base URL for the DexScreener API
const DEXSCREENER_API_BASE_URL = 'https://api.dexscreener.com/latest';

// Types
interface DexScreenerPair {
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
    h1: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h1: number;
    h24: number;
  };
  priceChange: {
    h1: number;
    h24: number;
  };
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
}

type DexScreenerInput = {
  operation: 'getPairsByChainAndPair';
  chainId: string;
  pairAddress: string;
} | {
  operation: 'searchPairs';
  query: string;
} | {
  operation: 'getTokenPairs';
  tokenAddress: string;
};

interface DexScreenerConfig {
  name?: string;
  description?: string;
  rateLimitPerMinute?: number;
}

interface DexScreenerResponse {
  success: boolean;
  data: DexScreenerPair[];
  error?: string;
}

// Input schema
const dexScreenerInputSchema = z.object({
  operation: z.string(),
  chainId: z.string().optional(),
  pairAddress: z.string().optional(),
  query: z.string().optional(),
  tokenAddress: z.string().optional()
});

// Output schema
const dexScreenerOutputSchema = z.object({
  success: z.boolean(),
  data: z.array(z.any()),
  error: z.string().optional()
});

export class DexScreenerTool extends Tool<DexScreenerInput, DexScreenerResponse> {
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number;

  constructor(config: DexScreenerConfig = {}) {
    const toolConfig: ToolConfig<DexScreenerInput, DexScreenerResponse> = {
      name: config.name || 'dexscreener',
      description: config.description || 'Interact with DexScreener API for DEX pair data',
      inputSchema: dexScreenerInputSchema as any,
      outputSchema: dexScreenerOutputSchema,
      execute: (input: DexScreenerInput) => this.execute(input)
    };

    super(toolConfig);

    // Rate limit: default 300 requests per minute (5 per second)
    this.minRequestInterval = 60000 / (config.rateLimitPerMinute || 300);
  }

  private async throttleRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
  }

  private async makeRequest(endpoint: string): Promise<any> {
    await this.throttleRequest();

    const response = await fetch(`${DEXSCREENER_API_BASE_URL}${endpoint}`);

    if (!response.ok) {
      throw new Error(`DexScreener API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async execute(input: DexScreenerInput): Promise<DexScreenerResponse> {
    try {
      switch (input.operation) {
        case 'getPairsByChainAndPair': {
          const data = await this.makeRequest(
            `/dex/pairs/${input.chainId}/${input.pairAddress}`
          );
          return { success: true, data: data.pairs || [] };
        }

        case 'searchPairs': {
          const data = await this.makeRequest(
            `/dex/search/?q=${encodeURIComponent(input.query)}`
          );
          return { success: true, data: data.pairs || [] };
        }

        case 'getTokenPairs': {
          const data = await this.makeRequest(
            `/dex/tokens/${input.tokenAddress}`
          );
          return { success: true, data: data.pairs || [] };
        }

        default:
          throw new Error(`Unsupported operation: ${(input as any).operation}`);
      }
    } catch (error) {
      console.error('DexScreener tool error:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}