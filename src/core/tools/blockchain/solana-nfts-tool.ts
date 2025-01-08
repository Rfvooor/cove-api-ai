import zod from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../../tool.js';

// Interfaces
export interface SolanaNFTMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url?: string;
  animation_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: string;
    creators?: Array<{
      address: string;
      share: number;
      verified: boolean;
    }>;
  };
  collection?: {
    name: string;
    family: string;
    verified: boolean;
  };
  seller_fee_basis_points: number;
}

export interface SolanaNFTData {
  mint: string;
  owner: string;
  updateAuthority: string;
  primarySaleHappened: boolean;
  isMutable: boolean;
  editionNonce: number | null;
  masterEdition?: {
    maxSupply: number | null;
    supply: number;
  };
  metadata: SolanaNFTMetadata;
  tokenStandard: string;
  uses?: {
    useMethod: string;
    remaining: number;
    total: number;
  };
}

export interface SolanaNFTCollectionData {
  address: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  itemCount: number;
  ownerCount: number;
  floorPrice?: number;
  volume24h?: number;
  volumeTotal?: number;
  creators: Array<{
    address: string;
    share: number;
    verified: boolean;
  }>;
  verified: boolean;
}

export interface SolanaNFTActivityData {
  signature: string;
  type: 'mint' | 'sale' | 'list' | 'delist' | 'transfer';
  source: string;
  tokenMint: string;
  collection?: string;
  seller?: string;
  buyer?: string;
  price?: number;
  timestamp: number;
}

export interface SolanaNFTResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface SolanaNFTToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  rpcEndpoint: string;
}

export type SolanaNFTInfoInput = {
  mint: string;
};

export type SolanaNFTCollectionInput = {
  address: string;
};

export type SolanaNFTOwnerInput = {
  owner: string;
  collection?: string;
  limit?: number;
  offset?: number;
};

export type SolanaNFTActivityInput = {
  mint?: string;
  collection?: string;
  type?: ('mint' | 'sale' | 'list' | 'delist' | 'transfer')[];
  limit?: number;
  before?: number;
};

export type SolanaNFTToolInput = {
  action: 'getNFT' | 'getCollection' | 'getOwnerNFTs' | 'getActivity';
  params: SolanaNFTInfoInput | SolanaNFTCollectionInput | SolanaNFTOwnerInput | SolanaNFTActivityInput;
};

// Zod Schemas for validation
const nftMetadataSchema = zod.object({
  name: zod.string(),
  symbol: zod.string(),
  description: zod.string(),
  image: zod.string(),
  external_url: zod.string().optional(),
  animation_url: zod.string().optional(),
  attributes: zod.array(zod.object({
    trait_type: zod.string(),
    value: zod.any(), // We'll validate the type in runtime
  })),
  properties: zod.object({
    files: zod.array(zod.object({
      uri: zod.string(),
      type: zod.string(),
    })),
    category: zod.string(),
    creators: zod.array(zod.object({
      address: zod.string(),
      share: zod.number(),
      verified: zod.boolean(),
    })).optional(),
  }),
  collection: zod.object({
    name: zod.string(),
    family: zod.string(),
    verified: zod.boolean(),
  }).optional(),
  seller_fee_basis_points: zod.number(),
});

const nftDataSchema = zod.object({
  mint: zod.string(),
  owner: zod.string(),
  updateAuthority: zod.string(),
  primarySaleHappened: zod.boolean(),
  isMutable: zod.boolean(),
  editionNonce: zod.number().optional(),
  masterEdition: zod.object({
    maxSupply: zod.number().optional(),
    supply: zod.number(),
  }).optional(),
  metadata: nftMetadataSchema,
  tokenStandard: zod.string(),
  uses: zod.object({
    useMethod: zod.string(),
    remaining: zod.number(),
    total: zod.number(),
  }).optional(),
});

const collectionDataSchema = zod.object({
  address: zod.string(),
  name: zod.string(),
  symbol: zod.string(),
  description: zod.string(),
  image: zod.string(),
  itemCount: zod.number(),
  ownerCount: zod.number(),
  floorPrice: zod.number().optional(),
  volume24h: zod.number().optional(),
  volumeTotal: zod.number().optional(),
  creators: zod.array(zod.object({
    address: zod.string(),
    share: zod.number(),
    verified: zod.boolean(),
  })),
  verified: zod.boolean(),
});

const activityDataSchema = zod.object({
  signature: zod.string(),
  type: zod.string(),
  source: zod.string(),
  tokenMint: zod.string(),
  collection: zod.string().optional(),
  seller: zod.string().optional(),
  buyer: zod.string().optional(),
  price: zod.number().optional(),
  timestamp: zod.number(),
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

export class SolanaNFTTool {
  private readonly tool: Tool<SolanaNFTToolInput, SolanaNFTResponse<SolanaNFTData | SolanaNFTCollectionData | SolanaNFTData[] | SolanaNFTActivityData[]>>;
  private readonly rpcEndpoint: string;

  constructor(config: SolanaNFTToolConfig) {
    this.rpcEndpoint = config.rpcEndpoint;

    const validateInput = (input: SolanaNFTToolInput): boolean => {
      if (!input.action) {
        throw new Error("Action must be provided");
      }
      if (!['getNFT', 'getCollection', 'getOwnerNFTs', 'getActivity'].includes(input.action)) {
        throw new Error("Action must be one of: getNFT, getCollection, getOwnerNFTs, getActivity");
      }
      if (!input.params) {
        throw new Error("Parameters must be provided");
      }

      switch (input.action) {
        case 'getNFT': {
          const params = input.params as SolanaNFTInfoInput;
          if (!params.mint) {
            throw new Error("NFT mint address must be provided");
          }
          break;
        }
        case 'getCollection': {
          const params = input.params as SolanaNFTCollectionInput;
          if (!params.address) {
            throw new Error("Collection address must be provided");
          }
          break;
        }
        case 'getOwnerNFTs': {
          const params = input.params as SolanaNFTOwnerInput;
          if (!params.owner) {
            throw new Error("Owner address must be provided");
          }
          if (params.limit && (params.limit < 1 || params.limit > 1000)) {
            throw new Error("Limit must be between 1 and 1000");
          }
          if (params.offset && params.offset < 0) {
            throw new Error("Offset must be non-negative");
          }
          break;
        }
        case 'getActivity': {
          const params = input.params as SolanaNFTActivityInput;
          if (!params.mint && !params.collection) {
            throw new Error("Either NFT mint or collection address must be provided");
          }
          if (params.limit && (params.limit < 1 || params.limit > 100)) {
            throw new Error("Limit must be between 1 and 100");
          }
          break;
        }
      }

      return true;
    };

    const toolConfig: ToolConfig<SolanaNFTToolInput, SolanaNFTResponse<SolanaNFTData | SolanaNFTCollectionData | SolanaNFTData[] | SolanaNFTActivityData[]>> = {
      name: config.name || 'solana-nfts-tool',
      description: config.description || 'Interacts with Solana NFTs and collections',
      requiredTools: config.requiredTools || [],
      inputSchema: inputSchema as ZodType<SolanaNFTToolInput>,
      outputSchema: responseSchema as ZodType<SolanaNFTResponse<SolanaNFTData | SolanaNFTCollectionData | SolanaNFTData[] | SolanaNFTActivityData[]>>,
      execute: async (input: SolanaNFTToolInput) => {
        validateInput(input);
        return this.executeAction(input);
      },
    };

    this.tool = new Tool<SolanaNFTToolInput, SolanaNFTResponse<SolanaNFTData | SolanaNFTCollectionData | SolanaNFTData[] | SolanaNFTActivityData[]>>(toolConfig);
  }

  private async executeAction(input: SolanaNFTToolInput): Promise<SolanaNFTResponse<SolanaNFTData | SolanaNFTCollectionData | SolanaNFTData[] | SolanaNFTActivityData[]>> {
    try {
      let method: string;
      let params: any[];

      switch (input.action) {
        case 'getNFT': {
          const nftParams = input.params as SolanaNFTInfoInput;
          method = 'getNFTByMint';
          params = [nftParams.mint];
          break;
        }
        case 'getCollection': {
          const collectionParams = input.params as SolanaNFTCollectionInput;
          method = 'getCollection';
          params = [collectionParams.address];
          break;
        }
        case 'getOwnerNFTs': {
          const ownerParams = input.params as SolanaNFTOwnerInput;
          method = 'getOwnerNFTs';
          params = [
            ownerParams.owner,
            {
              collection: ownerParams.collection,
              limit: ownerParams.limit || 100,
              offset: ownerParams.offset || 0,
            },
          ];
          break;
        }
        case 'getActivity': {
          const activityParams = input.params as SolanaNFTActivityInput;
          method = 'getNFTActivity';
          params = [{
            mint: activityParams.mint,
            collection: activityParams.collection,
            types: activityParams.type,
            limit: activityParams.limit || 50,
            before: activityParams.before,
          }];
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
      console.error('Error executing Solana NFTs action:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(input: SolanaNFTToolInput): Promise<SolanaNFTResponse<SolanaNFTData | SolanaNFTCollectionData | SolanaNFTData[] | SolanaNFTActivityData[]>> {
    return this.tool.execute(input);
  }

  static create(config: SolanaNFTToolConfig): Tool<SolanaNFTToolInput, SolanaNFTResponse<SolanaNFTData | SolanaNFTCollectionData | SolanaNFTData[] | SolanaNFTActivityData[]>> {
    const instance = new SolanaNFTTool(config);
    return instance.tool;
  }
}