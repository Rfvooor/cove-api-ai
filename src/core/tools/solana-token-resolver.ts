import { Tool, type ToolConfig, type SchemaType } from '../tool.js';

export interface TokenResolverResponse {
  success: boolean;
  data: {
    address: string;
    symbol: string;
    name: string;
  }[];
}

export interface TokenResolverConfig {
  name?: string;
  description?: string;
  apiKey: string;
}

// Input schema in JSON Schema format
const inputSchema: SchemaType = {
  type: 'string',
  description: 'Token symbol or name to resolve',
  minLength: 1,
  maxLength: 100
};

// Output schema in JSON Schema format
const outputSchema: SchemaType = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Whether the operation was successful'
    },
    data: {
      type: 'array',
      description: 'Array of resolved token information',
      items: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Token contract address'
          },
          symbol: {
            type: 'string',
            description: 'Token symbol'
          },
          name: {
            type: 'string',
            description: 'Token name'
          }
        },
        required: ['address', 'symbol', 'name']
      }
    }
  },
  required: ['success', 'data']
};

export class SolanaTokenResolver {
  private readonly tool: Tool<string, TokenResolverResponse>;
  private readonly apiEndpoint: string;
  private readonly apiKey: string;
  private readonly name: string;

  constructor(config: TokenResolverConfig) {
    this.apiEndpoint = 'https://public-api.birdeye.so';
    this.apiKey = config.apiKey;
    this.name = config.name || 'solana-token-resolver';

    const toolConfig: ToolConfig<string, TokenResolverResponse> = {
      name: this.name,
      description: `Resolves Solana token symbols and names to addresses. Features:
      - Token symbol resolution
      - Token name lookup
      - Address validation
      - Verified token filtering
      - Market data integration
      
      Input: Token symbol or name (e.g., "SOL", "Solana")
      Output: Array of matching tokens with addresses`,
      inputSchema,
      outputSchema,
      execute: async (symbol: string) => {
        return this.resolveToken(symbol);
      }
    };

    this.tool = new Tool<string, TokenResolverResponse>(toolConfig);
  }

  private async resolveToken(symbol: string): Promise<TokenResolverResponse> {
    try {
      const queryParams = new URLSearchParams({
        keyword: symbol,
        sort_by: 'liquidity',
        sort_type: 'desc',
        verify_token: 'true',
        limit: '1'
      });

      const response = await fetch(`${this.apiEndpoint}/defi/v3/search?${queryParams.toString()}`, {
        headers: {
          'X-API-KEY': this.apiKey,
          'x-chain': 'solana',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('API rate limit exceeded');
        }
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const rawData = await response.json();
      const matches = rawData.data.map((item: any) => ({
        address: item.address,
        symbol: item.symbol,
        name: item.name
      }));

      return {
        success: true,
        data: matches
      };
    } catch (error) {
      console.error('Error resolving token:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(symbol: string): Promise<TokenResolverResponse> {
    return this.tool.execute(symbol);
  }

  static create(config: TokenResolverConfig): Tool<string, TokenResolverResponse> {
    const instance = new SolanaTokenResolver(config);
    return instance.tool;
  }
}