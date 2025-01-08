import zod from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../../tool.js';

// Interfaces
export interface PumpFunNFTData {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  primarySaleHappened: boolean;
  isMutable: boolean;
  editionNonce: number | null;
  tokenStandard: string;
  collection: {
    verified: boolean;
    key: string;
  } | null;
  uses: {
    useMethod: string;
    remaining: number;
    total: number;
  } | null;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  owner: string;
  delegate: string | null;
  frozen: boolean;
  supply: number;
  supply_mint: string | null;
}

export interface PumpFunCollectionData {
  address: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url: string;
  twitter: string | null;
  discord: string | null;
  website: string | null;
  creators: Array<{
    address: string;
    share: number;
    verified: boolean;
  }>;
  stats: {
    items: number;
    owners: number;
    floor: number;
    volume24h: number;
    volumeTotal: number;
  };
}

export interface PumpFunListingData {
  id: string;
  mint: string;
  seller: string;
  price: number;
  currency: string;
  expiry: number | null;
  signature: string | null;
  status: 'active' | 'sold' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface PumpFunResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface PumpFunToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  apiEndpoint: string;
  apiKey: string;
}

export type PumpFunNFTInput = {
  mint: string;
};

export type PumpFunCollectionInput = {
  address: string;
};

export type PumpFunListingsInput = {
  collection?: string;
  owner?: string;
  status?: 'active' | 'sold' | 'cancelled';
  limit?: number;
  offset?: number;
};

export type PumpFunToolInput = {
  action: 'getNFT' | 'getCollection' | 'getListings';
  params: PumpFunNFTInput | PumpFunCollectionInput | PumpFunListingsInput;
};

// Zod Schemas for validation
const nftAttributeSchema = zod.object({
  trait_type: zod.string(),
  value: zod.any(), // We'll validate the type in runtime
});

const nftDataSchema = zod.object({
  mint: zod.string(),
  name: zod.string(),
  symbol: zod.string(),
  uri: zod.string(),
  sellerFeeBasisPoints: zod.number(),
  primarySaleHappened: zod.boolean(),
  isMutable: zod.boolean(),
  editionNonce: zod.number().optional(),
  tokenStandard: zod.string(),
  collection: zod.object({
    verified: zod.boolean(),
    key: zod.string(),
  }).optional(),
  uses: zod.object({
    useMethod: zod.string(),
    remaining: zod.number(),
    total: zod.number(),
  }).optional(),
  attributes: zod.array(nftAttributeSchema),
  owner: zod.string(),
  delegate: zod.string().optional(),
  frozen: zod.boolean(),
  supply: zod.number(),
  supply_mint: zod.string().optional(),
});

const collectionDataSchema = zod.object({
  address: zod.string(),
  name: zod.string(),
  symbol: zod.string(),
  description: zod.string(),
  image: zod.string(),
  external_url: zod.string(),
  twitter: zod.string().optional(),
  discord: zod.string().optional(),
  website: zod.string().optional(),
  creators: zod.array(zod.object({
    address: zod.string(),
    share: zod.number(),
    verified: zod.boolean(),
  })),
  stats: zod.object({
    items: zod.number(),
    owners: zod.number(),
    floor: zod.number(),
    volume24h: zod.number(),
    volumeTotal: zod.number(),
  }),
});

const listingDataSchema = zod.object({
  id: zod.string(),
  mint: zod.string(),
  seller: zod.string(),
  price: zod.number(),
  currency: zod.string(),
  expiry: zod.number().optional(),
  signature: zod.string().optional(),
  status: zod.string(),
  createdAt: zod.string(),
  updatedAt: zod.string(),
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

export class PumpFunTool {
  private readonly tool: Tool<PumpFunToolInput, PumpFunResponse<PumpFunNFTData | PumpFunCollectionData | PumpFunListingData[]>>;
  private readonly apiEndpoint: string;
  private readonly apiKey: string;

  constructor(config: PumpFunToolConfig) {
    this.apiEndpoint = config.apiEndpoint;
    this.apiKey = config.apiKey;

    const validateInput = (input: PumpFunToolInput): boolean => {
      if (!input.action) {
        throw new Error("Action must be provided");
      }
      if (!['getNFT', 'getCollection', 'getListings'].includes(input.action)) {
        throw new Error("Action must be one of: getNFT, getCollection, getListings");
      }
      if (!input.params) {
        throw new Error("Parameters must be provided");
      }

      switch (input.action) {
        case 'getNFT': {
          const params = input.params as PumpFunNFTInput;
          if (!params.mint) {
            throw new Error("NFT mint address must be provided");
          }
          break;
        }
        case 'getCollection': {
          const params = input.params as PumpFunCollectionInput;
          if (!params.address) {
            throw new Error("Collection address must be provided");
          }
          break;
        }
        case 'getListings': {
          const params = input.params as PumpFunListingsInput;
          if (!params.collection && !params.owner) {
            throw new Error("Either collection address or owner address must be provided");
          }
          if (params.status && !['active', 'sold', 'cancelled'].includes(params.status)) {
            throw new Error("Status must be one of: active, sold, cancelled");
          }
          if (params.limit && (params.limit < 1 || params.limit > 100)) {
            throw new Error("Limit must be between 1 and 100");
          }
          if (params.offset && params.offset < 0) {
            throw new Error("Offset must be non-negative");
          }
          break;
        }
      }

      return true;
    };

    const toolConfig: ToolConfig<PumpFunToolInput, PumpFunResponse<PumpFunNFTData | PumpFunCollectionData | PumpFunListingData[]>> = {
      name: config.name || 'pumpfun-tool',
      description: config.description || 'Interacts with PumpFun API for NFT data and trading',
      requiredTools: config.requiredTools || [],
      inputSchema: inputSchema as ZodType<PumpFunToolInput>,
      outputSchema: responseSchema as ZodType<PumpFunResponse<PumpFunNFTData | PumpFunCollectionData | PumpFunListingData[]>>,
      execute: async (input: PumpFunToolInput) => {
        validateInput(input);
        return this.executeAction(input);
      },
    };

    this.tool = new Tool<PumpFunToolInput, PumpFunResponse<PumpFunNFTData | PumpFunCollectionData | PumpFunListingData[]>>(toolConfig);
  }

  private async executeAction(input: PumpFunToolInput): Promise<PumpFunResponse<PumpFunNFTData | PumpFunCollectionData | PumpFunListingData[]>> {
    try {
      let endpoint: string;
      let queryParams = new URLSearchParams();

      switch (input.action) {
        case 'getNFT': {
          const params = input.params as PumpFunNFTInput;
          endpoint = `${this.apiEndpoint}/nfts/${params.mint}`;
          break;
        }
        case 'getCollection': {
          const params = input.params as PumpFunCollectionInput;
          endpoint = `${this.apiEndpoint}/collections/${params.address}`;
          break;
        }
        case 'getListings': {
          const params = input.params as PumpFunListingsInput;
          endpoint = `${this.apiEndpoint}/listings`;
          if (params.collection) {
            queryParams.append('collection', params.collection);
          }
          if (params.owner) {
            queryParams.append('owner', params.owner);
          }
          if (params.status) {
            queryParams.append('status', params.status);
          }
          if (params.limit) {
            queryParams.append('limit', params.limit.toString());
          }
          if (params.offset) {
            queryParams.append('offset', params.offset.toString());
          }
          break;
        }
        default:
          throw new Error(`Unsupported action: ${input.action}`);
      }

      const url = queryParams.toString() ? `${endpoint}?${queryParams.toString()}` : endpoint;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': this.apiKey,
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
      console.error('Error executing PumpFun action:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(input: PumpFunToolInput): Promise<PumpFunResponse<PumpFunNFTData | PumpFunCollectionData | PumpFunListingData[]>> {
    return this.tool.execute(input);
  }

  static create(config: PumpFunToolConfig): Tool<PumpFunToolInput, PumpFunResponse<PumpFunNFTData | PumpFunCollectionData | PumpFunListingData[]>> {
    const instance = new PumpFunTool(config);
    return instance.tool;
  }
}