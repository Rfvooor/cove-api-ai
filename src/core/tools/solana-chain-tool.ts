import { Connection, PublicKey, AccountInfo, ParsedTransactionWithMeta, ConfirmedSignatureInfo, GetProgramAccountsFilter, TokenAccountsFilter } from '@solana/web3.js';
import z from 'zod';
import type { ZodType } from 'zod';
import { Tool, type ToolConfig } from '../tool.js';

// Constants
const COMMITMENT_VALUES = ['processed', 'confirmed', 'finalized'] as const;
type CommitmentType = typeof COMMITMENT_VALUES[number];

// Input type using discriminated union
type GetAccountInfoParams = {
  address: string;
  commitment?: CommitmentType;
};

type GetTransactionParams = {
  signature: string;
  commitment?: CommitmentType;
};

type GetProgramAccountsParams = {
  programId: string;
  filters?: Array<{
    memcmp?: {
      offset: number;
      bytes: string;
    };
    dataSize?: number;
  }>;
};

type GetTokenAccountsParams = {
  ownerAddress: string;
  mint?: string;
};

type GetBlockParams = {
  slot: number;
  commitment?: CommitmentType;
};

type SolanaChainToolInput = {
  operation: 'getAccountInfo';
  params: GetAccountInfoParams;
} | {
  operation: 'getTransaction';
  params: GetTransactionParams;
} | {
  operation: 'getProgramAccounts';
  params: GetProgramAccountsParams;
} | {
  operation: 'getTokenAccounts';
  params: GetTokenAccountsParams;
} | {
  operation: 'getBlock';
  params: GetBlockParams;
};

// Simple input schema for basic validation
const inputSchema = z.object({
  operation: z.string(),
  params: z.any()
});

// Output schema
const outputSchema = z.object({
  success: z.boolean(),
  data: z.any(),
  error: z.string().optional()
});

export type SolanaChainToolOutput = {
  success: boolean;
  data: any;
  error?: string;
};

export interface SolanaChainToolConfig {
  name?: string;
  description?: string;
  requiredTools?: string[];
  rpcEndpoint: string;
  commitment?: CommitmentType;
}

interface AccountWithPubkey {
  pubkey: PublicKey;
  account: AccountInfo<Buffer>;
}

export class SolanaChainTool {
  private readonly tool: Tool<SolanaChainToolInput, SolanaChainToolOutput>;
  private readonly connection: Connection;
  private readonly defaultCommitment: CommitmentType;
  private readonly name: string;
  constructor(config: SolanaChainToolConfig) {
    this.connection = new Connection(config.rpcEndpoint);
    this.defaultCommitment = config.commitment || 'confirmed';
    this.name = config.name || 'solana-chain-tool';

    const toolConfig: ToolConfig<SolanaChainToolInput, SolanaChainToolOutput> = {
      name: this.name,
      description: config.description || 'Fetches on-chain data from Solana using web3.js',
      requiredTools: config.requiredTools || [],
      inputSchema: inputSchema as ZodType<SolanaChainToolInput>,
      outputSchema,
      execute: async (input: SolanaChainToolInput) => {
        try {
          switch (input.operation) {
            case 'getAccountInfo':
              return await this.getAccountInfo(input.params);
            case 'getTransaction':
              return await this.getTransaction(input.params);
            case 'getProgramAccounts':
              return await this.getProgramAccounts(input.params);
            case 'getTokenAccounts':
              return await this.getTokenAccounts(input.params);
            case 'getBlock':
              return await this.getBlock(input.params);
            default:
              throw new Error(`Unsupported operation: ${(input as any).operation}`);
          }
        } catch (error) {
          return {
            success: false,
            data: null,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    };

    this.tool = new Tool<SolanaChainToolInput, SolanaChainToolOutput>(toolConfig);
  }

  private async getAccountInfo(params: GetAccountInfoParams): Promise<SolanaChainToolOutput> {
    const pubkey = new PublicKey(params.address);
    const info = await this.connection.getAccountInfo(
      pubkey,
      params.commitment || this.defaultCommitment
    );

    if (!info) {
      return {
        success: false,
        data: null,
        error: 'Account not found',
      };
    }

    return {
      success: true,
      data: {
        lamports: info.lamports,
        owner: info.owner.toBase58(),
        executable: info.executable,
        rentEpoch: info.rentEpoch,
        data: Array.from(info.data),
      },
    };
  }

  private async getTransaction(params: GetTransactionParams): Promise<SolanaChainToolOutput> {
    const tx = await this.connection.getParsedTransaction(
      params.signature,
      {
        commitment: params.commitment || this.defaultCommitment,
        maxSupportedTransactionVersion: 0,
      }
    );

    if (!tx) {
      return {
        success: false,
        data: null,
        error: 'Transaction not found',
      };
    }

    return {
      success: true,
      data: tx,
    };
  }

  private async getProgramAccounts(params: GetProgramAccountsParams): Promise<SolanaChainToolOutput> {
    const filters: GetProgramAccountsFilter[] = params.filters?.map((filter) => ({
      ...filter,
      memcmp: filter.memcmp ? {
        offset: filter.memcmp.offset,
        bytes: filter.memcmp.bytes,
      } : undefined,
    })) || [];

    const accounts = await this.connection.getProgramAccounts(
      new PublicKey(params.programId),
      {
        filters,
      }
    );

    return {
      success: true,
      data: accounts.map(({ pubkey, account }: AccountWithPubkey) => ({
        pubkey: pubkey.toBase58(),
        account: {
          lamports: account.lamports,
          owner: account.owner.toBase58(),
          executable: account.executable,
          rentEpoch: account.rentEpoch,
          data: Array.from(account.data),
        },
      })),
    };
  }

  private async getTokenAccounts(params: GetTokenAccountsParams): Promise<SolanaChainToolOutput> {
    const ownerPubkey = new PublicKey(params.ownerAddress);
    let filter: TokenAccountsFilter = {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    };

    if (params.mint) {
      filter = {
        mint: new PublicKey(params.mint),
      };
    }

    const { value: accounts } = await this.connection.getTokenAccountsByOwner(
      ownerPubkey,
      filter
    );

    return {
      success: true,
      data: accounts.map(({ pubkey, account }: AccountWithPubkey) => ({
        pubkey: pubkey.toBase58(),
        account: {
          lamports: account.lamports,
          owner: account.owner.toBase58(),
          executable: account.executable,
          rentEpoch: account.rentEpoch,
          data: Array.from(account.data),
        },
      })),
    };
  }

  private async getBlock(params: GetBlockParams): Promise<SolanaChainToolOutput> {
    const block = await this.connection.getBlock(
      params.slot,
      {
        commitment: params.commitment || this.defaultCommitment,
        maxSupportedTransactionVersion: 0,
      }
    );

    if (!block) {
      return {
        success: false,
        data: null,
        error: 'Block not found',
      };
    }

    return {
      success: true,
      data: block,
    };
  }

  async execute(input: SolanaChainToolInput): Promise<SolanaChainToolOutput> {
    return this.tool.execute(input);
  }

  static create(config: SolanaChainToolConfig): Tool<SolanaChainToolInput, SolanaChainToolOutput> {
    const instance = new SolanaChainTool(config);
    return instance.tool;
  }
}