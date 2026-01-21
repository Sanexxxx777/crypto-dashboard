/**
 * Crypto Sectors Dashboard - Server
 * Express server with CoinGecko API proxy and caching
 */

const express = require('express');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// CoinGecko API configuration (server-side only)
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || 'CG-adnEn1bsVtmWiRj2E9eQ4KmB';
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = {
  data: null,
  timestamp: 0,
  isRefreshing: false
};

// All token IDs from config (will be populated on first request)
let allTokenIds = null;

// Middleware
app.use(compression());
app.use(express.json());

// Fetch all market data and cache it
async function fetchAndCacheAllData() {
  if (cache.isRefreshing) return cache.data;

  cache.isRefreshing = true;

  try {
    // Token IDs from all sectors
    if (!allTokenIds) {
      allTokenIds = [
        // Layer 1
        'ethereum', 'solana', 'binancecoin', 'cardano', 'tron',
        'avalanche-2', 'toncoin', 'polkadot', 'cosmos', 'sui',
        // Layer 2
        'arbitrum', 'optimism', 'matic-network', 'mantle', 'immutable-x',
        'starknet', 'zksync', 'manta-network', 'metis-token', 'loopring',
        // DEX
        'uniswap', 'raydium', 'jupiter-exchange-solana', 'pancakeswap-token', 'curve-dao-token',
        'aerodrome-finance', 'velodrome-finance', 'orca', 'camelot-token', 'sushiswap',
        // DEX Aggregators
        '1inch', 'paraswap', 'cowswap', 'openocean-finance',
        'dodo', 'kyber-network-crystal', 'hashflow', 'unizen', 'rango',
        // Derivatives
        'hyperliquid', 'gmx', 'dydx-chain', 'gains-network', 'synthetix-network-token',
        'drift-protocol', 'vertex-protocol', 'aevo-exchange', 'ribbon-finance', 'lyra-finance',
        // Lending
        'aave', 'compound-governance-token', 'venus', 'radiant-capital', 'morpho',
        'euler', 'benqi', 'kamino', 'silo-finance', 'spark',
        // Liquid Staking
        'lido-dao', 'rocket-pool', 'jito-governance-token', 'frax-share', 'ether-fi',
        'ankr', 'stader', 'marinade', 'stride', 'stakewise',
        // Stablecoins
        'maker', 'ethena', 'liquity', 'rai',
        'alchemix', 'angle-protocol', 'reserve-rights-token', 'spell-token', 'frax',
        // Asset Management
        'yearn-finance', 'convex-finance', 'instadapp', 'sommelier', 'enzyme-finance',
        'rari-governance-token', 'badger-dao', 'harvest-finance', 'idle-finance', 'vesper-finance',
        // Infrastructure
        'bittensor', 'render-token', 'internet-computer', 'the-graph', 'filecoin',
        'arweave', 'akash-network', 'theta-token', 'livepeer', 'pocket-network',
        // Oracles
        'chainlink', 'band-protocol', 'api3', 'dia-data', 'uma',
        'tellor', 'nest-protocol', 'dos-network', 'razor-network', 'witnet',
        // Bridges
        'wormhole', 'stargate-finance', 'layerzero', 'across-protocol', 'synapse-2',
        'celer-network', 'hop-protocol', 'multichain', 'connext', 'router-protocol',
        // DePIN
        'helium', 'iotex', 'hivemapper', 'grass', 'dimo', 'nosana',
        // NFT Marketplaces
        'blur', 'looks-rare', 'x2y2', 'rarible', 'superrare',
        'magic-eden', 'tensor', 'zora', 'foundation', 'manifold-finance',
        // Gaming
        'gala', 'the-sandbox', 'axie-infinity', 'ronin',
        'beam-2', 'illuvium', 'enjincoin', 'ultra', 'echelon-prime',
        // Social
        'friend-tech', 'lens-protocol', 'cyberconnect', 'hooked-protocol', 'galxe',
        'mask-network', 'status', 'rally-2', 'whale', 'chiliz',
        // Prediction Markets
        'polymarket', 'gnosis', 'augur', 'azuro', 'thales',
        'hedgehog-markets', 'zeitgeist', 'polkamarkets', 'omen', 'sx-network',
        // RWA
        'ondo-finance', 'mantra-dao', 'centrifuge', 'goldfinch', 'maple',
        'clearpool', 'pendle', 'polymesh', 'truefi', 'realio-network',
        // Memes
        'dogecoin', 'shiba-inu', 'pepe', 'dogwifcoin', 'bonk',
        'floki', 'brett-based', 'mog-coin', 'popcat', 'book-of-meme',
        // AI Agents
        'artificial-superintelligence-alliance', 'virtuals-protocol', 'ai16z', 'goatseus-maximus', 'fartcoin',
        'griffain', 'zerebro', 'ai-rig-complex', 'cookie', 'aixbt'
      ];
    }

    // Fetch in batches of 50
    const batchSize = 50;
    const allData = [];

    for (let i = 0; i < allTokenIds.length; i += batchSize) {
      const batch = allTokenIds.slice(i, i + batchSize);
      const url = `${COINGECKO_BASE_URL}/coins/markets?vs_currency=usd&ids=${batch.join(',')}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h,7d,30d`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'x-cg-demo-api-key': COINGECKO_API_KEY
        }
      });

      if (response.ok) {
        const data = await response.json();
        allData.push(...data);
      }

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < allTokenIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    cache.data = allData;
    cache.timestamp = Date.now();
    console.log(`[Cache] Updated with ${allData.length} tokens at ${new Date().toLocaleTimeString()}`);

    return allData;
  } catch (error) {
    console.error('[Cache] Error fetching data:', error.message);
    return cache.data; // Return old data if fetch fails
  } finally {
    cache.isRefreshing = false;
  }
}

// Check if cache is valid
function isCacheValid() {
  return cache.data && (Date.now() - cache.timestamp < CACHE_TTL);
}

// API Proxy endpoint - serves cached data
app.get('/api/markets', async (req, res) => {
  try {
    // Return cached data if valid
    if (isCacheValid()) {
      const { ids } = req.query;

      // If specific IDs requested, filter cached data
      if (ids) {
        const requestedIds = ids.split(',');
        const filtered = cache.data.filter(coin => requestedIds.includes(coin.id));
        return res.json(filtered);
      }

      return res.json(cache.data);
    }

    // Fetch fresh data
    const data = await fetchAndCacheAllData();

    if (!data || data.length === 0) {
      return res.status(503).json({ error: 'Data temporarily unavailable' });
    }

    const { ids } = req.query;
    if (ids) {
      const requestedIds = ids.split(',');
      const filtered = data.filter(coin => requestedIds.includes(coin.id));
      return res.json(filtered);
    }

    res.json(data);
  } catch (error) {
    console.error('API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Cache status endpoint
app.get('/api/cache-status', (req, res) => {
  res.json({
    hasData: !!cache.data,
    tokenCount: cache.data?.length || 0,
    lastUpdate: cache.timestamp ? new Date(cache.timestamp).toISOString() : null,
    ageSeconds: cache.timestamp ? Math.floor((Date.now() - cache.timestamp) / 1000) : null,
    isRefreshing: cache.isRefreshing
  });
});

// Static files with cache control
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   Crypto Sectors Dashboard                       ║
║                                                  ║
║   Server running at:                             ║
║   → http://localhost:${PORT}                       ║
║                                                  ║
║   Features:                                      ║
║   • 20 crypto sectors (~150 tokens)              ║
║   • Server-side caching (5 min TTL)              ║
║   • Handles unlimited concurrent users           ║
║   • Dark/Light themes + RU/EN                    ║
║                                                  ║
╚══════════════════════════════════════════════════╝
  `);

  // Pre-fetch data on startup
  fetchAndCacheAllData();

  // Background refresh every 5 minutes
  setInterval(fetchAndCacheAllData, CACHE_TTL);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  process.exit(0);
});
