import zod from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../../tool.js';

// Interfaces
export interface CrossmintNFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export interface CrossmintNFTData {
  id: string;
  chain: string;
  contractAddress: string;
  tokenId: string;
  owner: string;
  metadata: CrossmintNFTMetadata;
  status: 'pending' | 'minting' | 'success' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface CrossmintWalletData {
  id: string;
  chain: string;
  address: string;
  status: 'active' | 'inactive';
  balance: {
    native: string;
    tokens: Array<{
      address: string;
      symbol: string;
      amount: string;
    }>;
  };
}

export interface CrossmintResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface CrossmintToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  apiEndpoint: string;
  apiKey: string;
  clientId: string;
}

// Constants
const SUPPORTED_CHAINS = ['solana'] as const;
export type ChainType = typeof SUPPORTED_CHAINS[number];

export type CrossmintMintNFTInput = {
  chain: ChainType;
  recipient: string;
  metadata: CrossmintNFTMetadata;
  collection?: {
    contractAddress: string;
  };
};

export type CrossmintGetNFTInput = {
  chain: ChainType;
  contractAddress: string;
  tokenId: string;
};

export type CrossmintGetWalletInput = {
  chain: ChainType;
  address: string;
};

export type CrossmintToolInput = {
  action: 'mintNFT' | 'getNFT' | 'getWallet';
  params: CrossmintMintNFTInput | CrossmintGetNFTInput | CrossmintGetWalletInput;
};

// Zod Schemas for validation
const nftMetadataSchema = zod.object({
  name: zod.string(),
  description: zod.string(),
  image: zod.string(),
  attributes: zod.array(zod.object({
    trait_type: zod.string(),
    value: zod.string().optional(),
  })).optional(),
});

const nftDataSchema = zod.object({
  id: zod.string(),
  chain: zod.string(),
  contractAddress: zod.string(),
  tokenId: zod.string(),
  owner: zod.string(),
  metadata: nftMetadataSchema,
  status: zod.string(),
  createdAt: zod.string(),
  updatedAt: zod.string(),
});

const walletDataSchema = zod.object({
  id: zod.string(),
  chain: zod.string(),
  address: zod.string(),
  status: zod.string(),
  balance: zod.object({
    native: zod.string(),
    tokens: zod.array(zod.object({
      address: zod.string(),
      symbol: zod.string(),
      amount: zod.string(),
    })),
  }),
});

const responseSchema = zod.object({
  success: zod.boolean(),
  data: zod.any(), // We'll validate the specific data type in the execute method
  timestamp: zod.string(),
});

const inputSchema = zod.object({
  action: zod.string(),
  params: zod.object({
    chain: zod.string(),
    // Optional fields for all possible params
    recipient: zod.string().optional(),
    metadata: nftMetadataSchema.optional(),
    collection: zod.object({
      contractAddress: zod.string(),
    }).optional(),
    contractAddress: zod.string().optional(),
    tokenId: zod.string().optional(),
    address: zod.string().optional(),
  }),
});

export class CrossmintTool {
  private readonly tool: Tool<CrossmintToolInput, CrossmintResponse<CrossmintNFTData | CrossmintWalletData>>;
  private readonly apiEndpoint: string;
  private readonly apiKey: string;
  private readonly clientId: string;

  constructor(config: CrossmintToolConfig) {
    this.apiEndpoint = config.apiEndpoint;
    this.apiKey = config.apiKey;
    this.clientId = config.clientId;

    const validateInput = (input: CrossmintToolInput): boolean => {
      if (!input.action) {
        throw new Error("Action must be provided");
      }
      if (!input.params) {
        throw new Error("Parameters must be provided");
      }
      if (!SUPPORTED_CHAINS.includes(input.params.chain)) {
        throw new Error(`Chain must be one of: ${SUPPORTED_CHAINS.join(', ')}`);
      }

      switch (input.action) {
        case 'mintNFT': {
          const params = input.params as CrossmintMintNFTInput;
          if (!params.recipient || !params.metadata) {
            throw new Error("Recipient and metadata are required for minting NFT");
          }
          break;
        }
        case 'getNFT': {
          const params = input.params as CrossmintGetNFTInput;
          if (!params.contractAddress || !params.tokenId) {
            throw new Error("Contract address and token ID are required for getting NFT");
          }
          break;
        }
        case 'getWallet': {
          const params = input.params as CrossmintGetWalletInput;
          if (!params.address) {
            throw new Error("Address is required for getting wallet");
          }
          break;
        }
        default:
          throw new Error(`Unsupported action: ${input.action}`);
      }

      return true;
    };

    const toolConfig: ToolConfig<CrossmintToolInput, CrossmintResponse<CrossmintNFTData | CrossmintWalletData>> = {
      name: config.name || 'crossmint-tool',
      description: config.description || 'Interacts with Crossmint API for NFT and wallet operations',
      requiredTools: config.requiredTools || [],
      inputSchema: inputSchema as unknown as ZodType<CrossmintToolInput>,
      outputSchema: responseSchema as ZodType<CrossmintResponse<CrossmintNFTData | CrossmintWalletData>>,
      execute: async (input: CrossmintToolInput) => {
        validateInput(input);
        return this.executeAction(input);
      },
    };

    this.tool = new Tool<CrossmintToolInput, CrossmintResponse<CrossmintNFTData | CrossmintWalletData>>(toolConfig);
  }

  private async executeAction(input: CrossmintToolInput): Promise<CrossmintResponse<CrossmintNFTData | CrossmintWalletData>> {
    try {
      const headers = {
        'x-api-key': this.apiKey,
        'x-client-id': this.clientId,
        'Content-Type': 'application/json',
      };

      let endpoint: string;
      let method: string;
      let body: any;

      switch (input.action) {
        case 'mintNFT': {
          const params = input.params as CrossmintMintNFTInput;
          endpoint = `${this.apiEndpoint}/${params.chain}/nft/mint`;
          method = 'POST';
          body = {
            recipient: params.recipient,
            metadata: params.metadata,
            ...(params.collection && { collection: params.collection }),
          };
          break;
        }
        case 'getNFT': {
          const params = input.params as CrossmintGetNFTInput;
          endpoint = `${this.apiEndpoint}/${params.chain}/nft/${params.contractAddress}/${params.tokenId}`;
          method = 'GET';
          break;
        }
        case 'getWallet': {
          const params = input.params as CrossmintGetWalletInput;
          endpoint = `${this.apiEndpoint}/${params.chain}/wallet/${params.address}`;
          method = 'GET';
          break;
        }
        default:
          throw new Error(`Unsupported action: ${input.action}`);
      }

      const response = await fetch(endpoint, {
        method,
        headers,
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
      console.error('Error executing Crossmint action:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(input: CrossmintToolInput): Promise<CrossmintResponse<CrossmintNFTData | CrossmintWalletData>> {
    return this.tool.execute(input);
  }

  static create(config: CrossmintToolConfig): Tool<CrossmintToolInput, CrossmintResponse<CrossmintNFTData | CrossmintWalletData>> {
    const instance = new CrossmintTool(config);
    return instance.tool;
  }
}