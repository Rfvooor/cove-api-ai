import zod from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../../tool.js';

// Interfaces
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: any[];
  id: number;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface JsonRpcToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  endpoints: Record<string, string>;
}

// Constants
const SUPPORTED_CHAINS = [
  'solana'
] as const;
export type ChainType = typeof SUPPORTED_CHAINS[number];

// Common RPC methods
export const ETHEREUM_METHODS = [
  'eth_blockNumber',
  'eth_getBalance',
  'eth_getTransactionCount',
  'eth_getBlockByNumber',
  'eth_getTransactionByHash',
  'eth_call',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_getCode',
  'eth_getLogs'
] as const;

export const SOLANA_METHODS = [
  'getBalance',
  'getBlockHeight',
  'getBlockProduction',
  'getBlockCommitment',
  'getBlocks',
  'getBlockTime',
  'getClusterNodes',
  'getEpochInfo',
  'getGenesisHash',
  'getHealth',
  'getIdentity',
  'getInflationGovernor',
  'getInflationRate',
  'getInflationReward',
  'getLatestBlockhash',
  'getLeaderSchedule',
  'getMinimumBalanceForRentExemption',
  'getMultipleAccounts',
  'getProgramAccounts',
  'getRecentPerformanceSamples',
  'getSignatureStatuses',
  'getSlot',
  'getSlotLeader',
  'getStakeActivation',
  'getSupply',
  'getTokenAccountBalance',
  'getTokenAccountsByDelegate',
  'getTokenAccountsByOwner',
  'getTokenLargestAccounts',
  'getTokenSupply',
  'getTransaction',
  'getTransactionCount',
  'getVersion',
  'getVoteAccounts'
] as const;

export type EthereumMethod = typeof ETHEREUM_METHODS[number];
export type SolanaMethod = typeof SOLANA_METHODS[number];

export type JsonRpcToolInput = {
  chain: ChainType;
  method: string;
  params: any[];
};

// Type guards
const isEthereumMethod = (method: string): method is EthereumMethod => {
  return (ETHEREUM_METHODS as readonly string[]).includes(method);
};

const isSolanaMethod = (method: string): method is SolanaMethod => {
  return (SOLANA_METHODS as readonly string[]).includes(method);
};

const isEthereumChain = (chain: string): boolean => {
  return ['ethereum', 'polygon', 'binance', 'arbitrum', 'optimism', 'avalanche'].includes(chain);
};

// Zod Schemas for validation
const responseSchema = zod.object({
  jsonrpc: zod.literal('2.0'),
  id: zod.number(),
  result: zod.any().optional(),
  error: zod.object({
    code: zod.number(),
    message: zod.string(),
    data: zod.any().optional(),
  }).optional(),
});

const inputSchema = zod.object({
  chain: zod.string(),
  method: zod.string(),
  params: zod.array(zod.any()),
});

export class JsonRpcTool {
  private readonly tool: Tool<JsonRpcToolInput, JsonRpcResponse>;
  private readonly endpoints: Record<string, string>;
  private requestId: number;

  constructor(config: JsonRpcToolConfig) {
    this.endpoints = config.endpoints;
    this.requestId = 1;

    const validateInput = (input: JsonRpcToolInput): boolean => {
      if (!input.chain) {
        throw new Error("Chain must be provided");
      }
      if (!SUPPORTED_CHAINS.includes(input.chain as ChainType)) {
        throw new Error(`Chain must be one of: ${SUPPORTED_CHAINS.join(', ')}`);
      }
      if (!this.endpoints[input.chain]) {
        throw new Error(`No endpoint configured for chain: ${input.chain}`);
      }
      if (!input.method) {
        throw new Error("Method must be provided");
      }
      
      // Validate method based on chain type
      if (isEthereumChain(input.chain)) {
        if (!isEthereumMethod(input.method)) {
          throw new Error(`Invalid Ethereum RPC method: ${input.method}. Must be one of: ${ETHEREUM_METHODS.join(', ')}`);
        }
      } else if (input.chain === 'solana') {
        if (!isSolanaMethod(input.method)) {
          throw new Error(`Invalid Solana RPC method: ${input.method}. Must be one of: ${SOLANA_METHODS.join(', ')}`);
        }
      }

      return true;
    };

    const toolConfig: ToolConfig<JsonRpcToolInput, JsonRpcResponse> = {
      name: config.name || 'jsonrpc-tool',
      description: config.description || 'Makes JSON-RPC calls to blockchain nodes',
      requiredTools: config.requiredTools || [],
      inputSchema: inputSchema as ZodType<JsonRpcToolInput>,
      outputSchema: responseSchema,
      execute: async (input: JsonRpcToolInput) => {
        validateInput(input);
        return this.makeRpcCall(input);
      },
    };

    this.tool = new Tool<JsonRpcToolInput, JsonRpcResponse>(toolConfig);
  }

  private async makeRpcCall(input: JsonRpcToolInput): Promise<JsonRpcResponse> {
    try {
      const endpoint = this.endpoints[input.chain];
      const requestId = this.requestId++;

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: input.method,
        params: input.params,
        id: requestId,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`RPC request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return responseSchema.parse(data);
    } catch (error) {
      console.error('Error making JSON-RPC call:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async execute(input: JsonRpcToolInput): Promise<JsonRpcResponse> {
    return this.tool.execute(input);
  }

  static create(config: JsonRpcToolConfig): Tool<JsonRpcToolInput, JsonRpcResponse> {
    const instance = new JsonRpcTool(config);
    return instance.tool;
  }
}