import zod from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../../tool.js';

// Interfaces
export interface SPLTokenData {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  isInitialized: boolean;
  supply: string;
  extensions?: {
    website?: string;
    bridgeContract?: string;
    assetContract?: string;
    coingeckoId?: string;
    imageUrl?: string;
    description?: string;
    twitter?: string;
    discord?: string;
    telegram?: string;
  };
}

export interface SPLTokenAccountData {
  address: string;
  mint: string;
  owner: string;
  amount: string;
  delegate: string | null;
  delegatedAmount: string;
  isNative: boolean;
  isFrozen: boolean;
}

export interface SPLTokenHolderData {
  owner: string;
  amount: string;
  delegateOption: boolean;
  delegate: string | null;
  state: 'initialized' | 'frozen';
  isNativeOption: boolean;
  isNative: boolean;
  delegatedAmount: string;
  closeAuthority: string | null;
}

export interface SPLTokenResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface SPLTokenToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  rpcEndpoint: string;
}

export type SPLTokenInfoInput = {
  mint: string;
};

export type SPLTokenAccountInput = {
  account: string;
};

export type SPLTokenHoldersInput = {
  mint: string;
  limit?: number;
  offset?: number;
};

export type SPLTokenToolInput = {
  action: 'getToken' | 'getAccount' | 'getHolders';
  params: SPLTokenInfoInput | SPLTokenAccountInput | SPLTokenHoldersInput;
};

// Zod Schemas for validation
const tokenExtensionsSchema = zod.object({
  website: zod.string().optional(),
  bridgeContract: zod.string().optional(),
  assetContract: zod.string().optional(),
  coingeckoId: zod.string().optional(),
  imageUrl: zod.string().optional(),
  description: zod.string().optional(),
  twitter: zod.string().optional(),
  discord: zod.string().optional(),
  telegram: zod.string().optional(),
});

const tokenDataSchema = zod.object({
  address: zod.string(),
  name: zod.string(),
  symbol: zod.string(),
  decimals: zod.number(),
  totalSupply: zod.string(),
  mintAuthority: zod.string().optional(),
  freezeAuthority: zod.string().optional(),
  isInitialized: zod.boolean(),
  supply: zod.string(),
  extensions: tokenExtensionsSchema.optional(),
});

const tokenAccountSchema = zod.object({
  address: zod.string(),
  mint: zod.string(),
  owner: zod.string(),
  amount: zod.string(),
  delegate: zod.string().optional(),
  delegatedAmount: zod.string(),
  isNative: zod.boolean(),
  isFrozen: zod.boolean(),
});

const tokenHolderSchema = zod.object({
  owner: zod.string(),
  amount: zod.string(),
  delegateOption: zod.boolean(),
  delegate: zod.string().optional(),
  state: zod.string(),
  isNativeOption: zod.boolean(),
  isNative: zod.boolean(),
  delegatedAmount: zod.string(),
  closeAuthority: zod.string().optional(),
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

export class SPLTokenTool {
  private readonly tool: Tool<SPLTokenToolInput, SPLTokenResponse<SPLTokenData | SPLTokenAccountData | SPLTokenHolderData[]>>;
  private readonly rpcEndpoint: string;

  constructor(config: SPLTokenToolConfig) {
    this.rpcEndpoint = config.rpcEndpoint;

    const validateInput = (input: SPLTokenToolInput): boolean => {
      if (!input.action) {
        throw new Error("Action must be provided");
      }
      if (!['getToken', 'getAccount', 'getHolders'].includes(input.action)) {
        throw new Error("Action must be one of: getToken, getAccount, getHolders");
      }
      if (!input.params) {
        throw new Error("Parameters must be provided");
      }

      switch (input.action) {
        case 'getToken': {
          const params = input.params as SPLTokenInfoInput;
          if (!params.mint) {
            throw new Error("Token mint address must be provided");
          }
          break;
        }
        case 'getAccount': {
          const params = input.params as SPLTokenAccountInput;
          if (!params.account) {
            throw new Error("Token account address must be provided");
          }
          break;
        }
        case 'getHolders': {
          const params = input.params as SPLTokenHoldersInput;
          if (!params.mint) {
            throw new Error("Token mint address must be provided");
          }
          if (params.limit && (params.limit < 1 || params.limit > 1000)) {
            throw new Error("Limit must be between 1 and 1000");
          }
          if (params.offset && params.offset < 0) {
            throw new Error("Offset must be non-negative");
          }
          break;
        }
      }

      return true;
    };

    const toolConfig: ToolConfig<SPLTokenToolInput, SPLTokenResponse<SPLTokenData | SPLTokenAccountData | SPLTokenHolderData[]>> = {
      name: config.name || 'spl-token-tool',
      description: config.description || 'Interacts with Solana SPL Token program',
      requiredTools: config.requiredTools || [],
      inputSchema: inputSchema as ZodType<SPLTokenToolInput>,
      outputSchema: responseSchema as ZodType<SPLTokenResponse<SPLTokenData | SPLTokenAccountData | SPLTokenHolderData[]>>,
      execute: async (input: SPLTokenToolInput) => {
        validateInput(input);
        return this.executeAction(input);
      },
    };

    this.tool = new Tool<SPLTokenToolInput, SPLTokenResponse<SPLTokenData | SPLTokenAccountData | SPLTokenHolderData[]>>(toolConfig);
  }

  private async executeAction(input: SPLTokenToolInput): Promise<SPLTokenResponse<SPLTokenData | SPLTokenAccountData | SPLTokenHolderData[]>> {
    try {
      let method: string;
      let params: any[];

      switch (input.action) {
        case 'getToken': {
          const tokenParams = input.params as SPLTokenInfoInput;
          method = 'getToken';
          params = [tokenParams.mint];
          break;
        }
        case 'getAccount': {
          const accountParams = input.params as SPLTokenAccountInput;
          method = 'getTokenAccount';
          params = [accountParams.account];
          break;
        }
        case 'getHolders': {
          const holdersParams = input.params as SPLTokenHoldersInput;
          method = 'getTokenLargestAccounts';
          params = [
            holdersParams.mint,
            {
              limit: holdersParams.limit || 100,
              offset: holdersParams.offset || 0,
            },
          ];
          break;
        }
        default:
          throw new Error(`Unsupported action: ${input.action}`);
      }

      const response = await fetch(this.rpcEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        }),
      });

      if (!response.ok) {
        throw new Error(`RPC request failed: ${response.statusText}`);
      }

      const { result, error } = await response.json();
      if (error) {
        throw new Error(`RPC error: ${error.message}`);
      }

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error executing SPL Token action:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(input: SPLTokenToolInput): Promise<SPLTokenResponse<SPLTokenData | SPLTokenAccountData | SPLTokenHolderData[]>> {
    return this.tool.execute(input);
  }

  static create(config: SPLTokenToolConfig): Tool<SPLTokenToolInput, SPLTokenResponse<SPLTokenData | SPLTokenAccountData | SPLTokenHolderData[]>> {
    const instance = new SPLTokenTool(config);
    return instance.tool;
  }
}