import zod from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../../tool.js';

// Interfaces
export interface MagicEdenNFTData {
  mintAddress: string;
  owner: string;
  supply: number;
  collection: string;
  name: string;
  updateAuthority: string;
  primarySaleHappened: boolean;
  sellerFeeBasisPoints: number;
  image: string;
  animationUrl?: string;
  externalUrl?: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: string;
    creators: Array<{
      address: string;
      share: number;
    }>;
  };
  price?: number;
  escrowPubkey?: string;
  owner_address?: string;
  listStatus?: 'listed' | 'unlisted';
}

export interface MagicEdenCollectionData {
  symbol: string;
  name: string;
  description: string;
  image: string;
  twitter?: string;
  discord?: string;
  website?: string;
  categories: string[];
  floorPrice?: number;
  listedCount?: number;
  volumeAll: number;
  volume24hr: number;
  avgPrice24hr?: number;
  stats: {
    floor: number;
    listed: number;
    volume24hr: number;
    volumeAll: number;
  };
}

export interface MagicEdenListingData {
  pdaAddress: string;
  auctionHouse: string;
  tokenAddress: string;
  tokenMint: string;
  seller: string;
  tokenSize: number;
  price: number;
  rarity?: {
    moonrank?: number;
    howrare?: number;
  };
  extra: {
    img: string;
  };
}

export interface MagicEdenActivityData {
  signature: string;
  type: 'list' | 'delist' | 'buyNow' | 'bid' | 'cancelBid';
  source: string;
  tokenMint: string;
  collection: string;
  slot: number;
  blockTime: number;
  buyer?: string;
  seller?: string;
  price?: number;
}

export interface MagicEdenResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface MagicEdenToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  apiEndpoint: string;
  apiKey: string;
}

export type MagicEdenNFTInput = {
  mintAddress: string;
};

export type MagicEdenCollectionInput = {
  symbol: string;
};

export type MagicEdenListingsInput = {
  symbol: string;
  limit?: number;
  offset?: number;
  listingType?: 'all' | 'single';
};

export type MagicEdenActivityInput = {
  symbol: string;
  type?: ('list' | 'delist' | 'buyNow' | 'bid' | 'cancelBid')[];
  limit?: number;
  offset?: number;
};

export type MagicEdenToolInput = {
  action: 'getNFT' | 'getCollection' | 'getListings' | 'getActivity';
  params: MagicEdenNFTInput | MagicEdenCollectionInput | MagicEdenListingsInput | MagicEdenActivityInput;
};

// Zod Schemas for validation
const nftAttributeSchema = zod.object({
  trait_type: zod.string(),
  value: zod.string(),
});

const nftFileSchema = zod.object({
  uri: zod.string(),
  type: zod.string(),
});

const nftCreatorSchema = zod.object({
  address: zod.string(),
  share: zod.number(),
});

const nftDataSchema = zod.object({
  mintAddress: zod.string(),
  owner: zod.string(),
  supply: zod.number(),
  collection: zod.string(),
  name: zod.string(),
  updateAuthority: zod.string(),
  primarySaleHappened: zod.boolean(),
  sellerFeeBasisPoints: zod.number(),
  image: zod.string(),
  animationUrl: zod.string().optional(),
  externalUrl: zod.string().optional(),
  attributes: zod.array(nftAttributeSchema),
  properties: zod.object({
    files: zod.array(nftFileSchema),
    category: zod.string(),
    creators: zod.array(nftCreatorSchema),
  }),
  price: zod.number().optional(),
  escrowPubkey: zod.string().optional(),
  owner_address: zod.string().optional(),
  listStatus: zod.string().optional(),
});

const collectionDataSchema = zod.object({
  symbol: zod.string(),
  name: zod.string(),
  description: zod.string(),
  image: zod.string(),
  twitter: zod.string().optional(),
  discord: zod.string().optional(),
  website: zod.string().optional(),
  categories: zod.array(zod.string()),
  floorPrice: zod.number().optional(),
  listedCount: zod.number().optional(),
  volumeAll: zod.number(),
  volume24hr: zod.number(),
  avgPrice24hr: zod.number().optional(),
  stats: zod.object({
    floor: zod.number(),
    listed: zod.number(),
    volume24hr: zod.number(),
    volumeAll: zod.number(),
  }),
});

const listingDataSchema = zod.object({
  pdaAddress: zod.string(),
  auctionHouse: zod.string(),
  tokenAddress: zod.string(),
  tokenMint: zod.string(),
  seller: zod.string(),
  tokenSize: zod.number(),
  price: zod.number(),
  rarity: zod.object({
    moonrank: zod.number().optional(),
    howrare: zod.number().optional(),
  }).optional(),
  extra: zod.object({
    img: zod.string(),
  }),
});

const activityDataSchema = zod.object({
  signature: zod.string(),
  type: zod.string(),
  source: zod.string(),
  tokenMint: zod.string(),
  collection: zod.string(),
  slot: zod.number(),
  blockTime: zod.number(),
  buyer: zod.string().optional(),
  seller: zod.string().optional(),
  price: zod.number().optional(),
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

export class MagicEdenTool {
  private readonly tool: Tool<MagicEdenToolInput, MagicEdenResponse<MagicEdenNFTData | MagicEdenCollectionData | MagicEdenListingData[] | MagicEdenActivityData[]>>;
  private readonly apiEndpoint: string;
  private readonly apiKey: string;

  constructor(config: MagicEdenToolConfig) {
    this.apiEndpoint = config.apiEndpoint;
    this.apiKey = config.apiKey;

    const validateInput = (input: MagicEdenToolInput): boolean => {
      if (!input.action) {
        throw new Error("Action must be provided");
      }
      if (!['getNFT', 'getCollection', 'getListings', 'getActivity'].includes(input.action)) {
        throw new Error("Action must be one of: getNFT, getCollection, getListings, getActivity");
      }
      if (!input.params) {
        throw new Error("Parameters must be provided");
      }

      switch (input.action) {
        case 'getNFT': {
          const params = input.params as MagicEdenNFTInput;
          if (!params.mintAddress) {
            throw new Error("NFT mint address must be provided");
          }
          break;
        }
        case 'getCollection': {
          const params = input.params as MagicEdenCollectionInput;
          if (!params.symbol) {
            throw new Error("Collection symbol must be provided");
          }
          break;
        }
        case 'getListings': {
          const params = input.params as MagicEdenListingsInput;
          if (!params.symbol) {
            throw new Error("Collection symbol must be provided");
          }
          if (params.limit && (params.limit < 1 || params.limit > 100)) {
            throw new Error("Limit must be between 1 and 100");
          }
          if (params.offset && params.offset < 0) {
            throw new Error("Offset must be non-negative");
          }
          if (params.listingType && !['all', 'single'].includes(params.listingType)) {
            throw new Error("Listing type must be either 'all' or 'single'");
          }
          break;
        }
        case 'getActivity': {
          const params = input.params as MagicEdenActivityInput;
          if (!params.symbol) {
            throw new Error("Collection symbol must be provided");
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

    const toolConfig: ToolConfig<MagicEdenToolInput, MagicEdenResponse<MagicEdenNFTData | MagicEdenCollectionData | MagicEdenListingData[] | MagicEdenActivityData[]>> = {
      name: config.name || 'magiceden-tool',
      description: config.description || 'Interacts with Magic Eden NFT marketplace',
      requiredTools: config.requiredTools || [],
      inputSchema: inputSchema as ZodType<MagicEdenToolInput>,
      outputSchema: responseSchema as ZodType<MagicEdenResponse<MagicEdenNFTData | MagicEdenCollectionData | MagicEdenListingData[] | MagicEdenActivityData[]>>,
      execute: async (input: MagicEdenToolInput) => {
        validateInput(input);
        return this.executeAction(input);
      },
    };

    this.tool = new Tool<MagicEdenToolInput, MagicEdenResponse<MagicEdenNFTData | MagicEdenCollectionData | MagicEdenListingData[] | MagicEdenActivityData[]>>(toolConfig);
  }

  private async executeAction(input: MagicEdenToolInput): Promise<MagicEdenResponse<MagicEdenNFTData | MagicEdenCollectionData | MagicEdenListingData[] | MagicEdenActivityData[]>> {
    try {
      let endpoint: string;
      let queryParams = new URLSearchParams();

      switch (input.action) {
        case 'getNFT': {
          const params = input.params as MagicEdenNFTInput;
          endpoint = `${this.apiEndpoint}/tokens/${params.mintAddress}`;
          break;
        }
        case 'getCollection': {
          const params = input.params as MagicEdenCollectionInput;
          endpoint = `${this.apiEndpoint}/collections/${params.symbol}`;
          break;
        }
        case 'getListings': {
          const params = input.params as MagicEdenListingsInput;
          endpoint = `${this.apiEndpoint}/collections/${params.symbol}/listings`;
          if (params.limit) {
            queryParams.append('limit', params.limit.toString());
          }
          if (params.offset) {
            queryParams.append('offset', params.offset.toString());
          }
          if (params.listingType) {
            queryParams.append('listingType', params.listingType);
          }
          break;
        }
        case 'getActivity': {
          const params = input.params as MagicEdenActivityInput;
          endpoint = `${this.apiEndpoint}/collections/${params.symbol}/activities`;
          if (params.type && params.type.length > 0) {
            queryParams.append('type', params.type.join(','));
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
          'Authorization': `Bearer ${this.apiKey}`,
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
      console.error('Error executing Magic Eden action:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(input: MagicEdenToolInput): Promise<MagicEdenResponse<MagicEdenNFTData | MagicEdenCollectionData | MagicEdenListingData[] | MagicEdenActivityData[]>> {
    return this.tool.execute(input);
  }

  static create(config: MagicEdenToolConfig): Tool<MagicEdenToolInput, MagicEdenResponse<MagicEdenNFTData | MagicEdenCollectionData | MagicEdenListingData[] | MagicEdenActivityData[]>> {
    const instance = new MagicEdenTool(config);
    return instance.tool;
  }
}