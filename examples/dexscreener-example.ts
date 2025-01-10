import { DexScreenerTool } from '../src/core/tools/dexscreener-tool.js';

async function main() {
  // Initialize the DexScreener tool
  const dexScreener = new DexScreenerTool({
    name: 'dexscreener',
    description: 'Example usage of DexScreener tool',
    rateLimitPerMinute: 300
  });

  try {
    // Example 1: Get pair data for a specific pair
    console.log('Fetching pair data...');
    const pairResult = await dexScreener.execute({
      operation: 'getPairsByChainAndPair',
      chainId: 'ethereum',
      pairAddress: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640' // USDC-ETH pair
    });
    console.log('Pair data:', JSON.stringify(pairResult, null, 2));

    // Example 2: Search for pairs
    console.log('\nSearching for pairs...');
    const searchResult = await dexScreener.execute({
      operation: 'searchPairs',
      query: 'USDC'
    });
    console.log('Search results:', JSON.stringify(searchResult, null, 2));

    // Example 3: Get all pairs for a token
    console.log('\nFetching token pairs...');
    const tokenResult = await dexScreener.execute({
      operation: 'getTokenPairs',
      tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' // USDC token
    });
    console.log('Token pairs:', JSON.stringify(tokenResult, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);