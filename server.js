/**
 * Crypto Sectors Dashboard - Server
 * Express server with CoinGecko API proxy, caching, and Momentum Rating
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== DATA DIRECTORY SETUP ====================
const DATA_DIR = path.join(__dirname, 'data');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');
const BULL_PHASES_FILE = path.join(DATA_DIR, 'bull_phases.json');
const MOMENTUM_FILE = path.join(DATA_DIR, 'momentum.json');

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

// CoinGecko API configuration - Basic plan ($29/mo)
// 100k calls/month, 250/min rate limit
const COINGECKO_API_KEY = 'CG-XYGuN7yVwECrpsrLw65M14mr';
const COINGECKO_BASE_URL = 'https://pro-api.coingecko.com/api/v3';

// Cache configuration - 30 seconds with batch 200 (~86k calls/month)
const CACHE_TTL = 30 * 1000; // 30 seconds
const cache = {
  data: null,
  timestamp: 0,
  isRefreshing: false
};

// Google Sheets API key (for external access)
const SHEETS_API_KEY = process.env.SHEETS_API_KEY || 'crypto-dashboard-2024';

// Statistics for monitoring
const stats = {
  websiteRequests: 0,
  sheetsRequests: 0,
  cacheHits: 0,
  startTime: Date.now()
};

// Sectors configuration for /api/sheets
const SECTORS = {
  'Layer 1': ['ethereum', 'solana', 'binancecoin', 'cardano', 'tron', 'avalanche-2', 'toncoin', 'polkadot', 'cosmos', 'sui'],
  'Layer 2': ['arbitrum', 'optimism', 'matic-network', 'mantle', 'immutable-x', 'starknet', 'zksync', 'manta-network', 'metis-token', 'loopring'],
  'DEX': ['uniswap', 'raydium', 'jupiter-exchange-solana', 'pancakeswap-token', 'curve-dao-token', 'aerodrome-finance', 'velodrome-finance', 'orca', 'camelot-token', 'sushiswap'],
  'DEX Aggregators': ['1inch', 'jupiter-exchange-solana', 'paraswap', 'cowswap', 'openocean-finance', 'dodo', 'kyber-network-crystal', 'hashflow', 'unizen', 'rango'],
  'Derivatives': ['hyperliquid', 'gmx', 'dydx-chain', 'gains-network', 'synthetix-network-token', 'drift-protocol', 'vertex-protocol', 'aevo-exchange', 'ribbon-finance', 'lyra-finance'],
  'Lending': ['aave', 'compound-governance-token', 'venus', 'radiant-capital', 'morpho', 'euler', 'benqi', 'kamino', 'silo-finance', 'spark'],
  'Liquid Staking': ['lido-dao', 'rocket-pool', 'jito-governance-token', 'frax-share', 'ether-fi', 'ankr', 'stader', 'marinade', 'stride', 'stakewise'],
  'Stablecoins': ['maker', 'ethena', 'frax-share', 'liquity', 'rai', 'alchemix', 'angle-protocol', 'reserve-rights-token', 'spell-token', 'frax'],
  'Asset Management': ['yearn-finance', 'convex-finance', 'instadapp', 'sommelier', 'enzyme-finance', 'rari-governance-token', 'badger-dao', 'harvest-finance', 'idle-finance', 'vesper-finance'],
  'Infrastructure': ['bittensor', 'render-token', 'internet-computer', 'the-graph', 'filecoin', 'arweave', 'akash-network', 'theta-token', 'livepeer', 'pocket-network'],
  'Oracles': ['chainlink', 'band-protocol', 'api3', 'dia-data', 'uma', 'tellor', 'nest-protocol', 'dos-network', 'razor-network', 'witnet'],
  'Bridges': ['wormhole', 'stargate-finance', 'layerzero', 'across-protocol', 'synapse-2', 'celer-network', 'hop-protocol', 'multichain', 'connext', 'router-protocol'],
  'DePIN': ['helium', 'iotex', 'hivemapper', 'grass', 'dimo', 'render-token', 'filecoin', 'theta-token', 'akash-network', 'nosana'],
  'NFT Marketplaces': ['blur', 'looks-rare', 'x2y2', 'rarible', 'superrare', 'magic-eden', 'tensor', 'zora', 'foundation', 'manifold-finance'],
  'Gaming': ['immutable-x', 'gala', 'the-sandbox', 'axie-infinity', 'ronin', 'beam-2', 'illuvium', 'enjincoin', 'ultra', 'echelon-prime'],
  'Social': ['friend-tech', 'lens-protocol', 'cyberconnect', 'hooked-protocol', 'galxe', 'mask-network', 'status', 'rally-2', 'whale', 'chiliz'],
  'Prediction Markets': ['polymarket', 'gnosis', 'augur', 'azuro', 'thales', 'hedgehog-markets', 'zeitgeist', 'polkamarkets', 'omen', 'sx-network'],
  'RWA': ['ondo-finance', 'mantra-dao', 'centrifuge', 'goldfinch', 'maple', 'clearpool', 'pendle', 'polymesh', 'truefi', 'realio-network'],
  'Memes': ['dogecoin', 'shiba-inu', 'pepe', 'dogwifcoin', 'bonk', 'floki', 'brett-based', 'mog-coin', 'popcat', 'book-of-meme'],
  'AI Agents': ['artificial-superintelligence-alliance', 'virtuals-protocol', 'ai16z', 'goatseus-maximus', 'fartcoin', 'griffain', 'zerebro', 'ai-rig-complex', 'cookie', 'aixbt']
};

// All token IDs from config (will be populated on first request)
let allTokenIds = null;

// ==================== MOMENTUM RATING SYSTEM ====================

// Bull phase detection configuration
const BULL_CONFIG = {
  START_THRESHOLD: 5,    // BTC 24h > +5% to start bull phase
  CONTINUE_THRESHOLD: 2, // BTC 24h > +2% to continue
  END_THRESHOLD: 2,      // BTC 24h < +2% to end
  BTC_ID: 'bitcoin'
};

// Current market state
let marketState = {
  state: 'neutral', // 'neutral', 'bull', 'bear'
  btc24h: 0,
  currentPhase: null, // Active bull phase tracking
  lastCheck: null
};

// Load persisted data
function loadBullPhases() {
  try {
    if (fs.existsSync(BULL_PHASES_FILE)) {
      return JSON.parse(fs.readFileSync(BULL_PHASES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[Momentum] Error loading bull phases:', e.message);
  }
  return [];
}

function saveBullPhases(phases) {
  try {
    fs.writeFileSync(BULL_PHASES_FILE, JSON.stringify(phases, null, 2));
  } catch (e) {
    console.error('[Momentum] Error saving bull phases:', e.message);
  }
}

function loadMomentumData() {
  try {
    if (fs.existsSync(MOMENTUM_FILE)) {
      return JSON.parse(fs.readFileSync(MOMENTUM_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[Momentum] Error loading momentum data:', e.message);
  }
  return { tokens: {}, sectors: {}, lastCalculated: null };
}

function saveMomentumData(data) {
  try {
    fs.writeFileSync(MOMENTUM_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[Momentum] Error saving momentum data:', e.message);
  }
}

// Save snapshot
function saveSnapshot(data) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const filePath = path.join(SNAPSHOTS_DIR, `${dateStr}.json`);

  try {
    let daySnapshots = [];
    if (fs.existsSync(filePath)) {
      daySnapshots = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    const snapshot = {
      timestamp: now.toISOString(),
      tokens: data.map(t => ({
        id: t.id,
        symbol: t.symbol,
        price: t.current_price,
        mcap: t.market_cap,
        change24h: t.price_change_percentage_24h_in_currency
      }))
    };

    daySnapshots.push(snapshot);
    fs.writeFileSync(filePath, JSON.stringify(daySnapshots, null, 2));
    console.log(`[Snapshot] Saved at ${now.toLocaleTimeString()}`);
  } catch (e) {
    console.error('[Snapshot] Error saving:', e.message);
  }
}

// Get BTC data from cache
function getBTCData() {
  if (!cache.data) return null;
  return cache.data.find(t => t.id === BULL_CONFIG.BTC_ID);
}

// Check and update market state
function updateMarketState() {
  const btc = getBTCData();
  if (!btc) return;

  const btc24h = btc.price_change_percentage_24h_in_currency || 0;
  marketState.btc24h = btc24h;
  marketState.lastCheck = new Date().toISOString();

  let bullPhases = loadBullPhases();

  // Bull phase detection logic
  if (marketState.state === 'neutral' || marketState.state === 'bear') {
    // Check for bull phase start
    if (btc24h >= BULL_CONFIG.START_THRESHOLD) {
      marketState.state = 'bull';
      marketState.currentPhase = {
        startTime: new Date().toISOString(),
        startBtcPrice: btc.current_price,
        peakBtc24h: btc24h,
        tokens: captureTokenPerformance()
      };
      console.log(`[Bull Phase] STARTED - BTC +${btc24h.toFixed(2)}%`);
    } else if (btc24h < -BULL_CONFIG.START_THRESHOLD) {
      marketState.state = 'bear';
    } else {
      marketState.state = 'neutral';
    }
  } else if (marketState.state === 'bull') {
    // Update peak if higher
    if (btc24h > marketState.currentPhase.peakBtc24h) {
      marketState.currentPhase.peakBtc24h = btc24h;
    }

    // Check for bull phase end
    if (btc24h < BULL_CONFIG.CONTINUE_THRESHOLD) {
      // End the bull phase
      const phase = {
        ...marketState.currentPhase,
        endTime: new Date().toISOString(),
        endBtcPrice: btc.current_price,
        btcGain: ((btc.current_price - marketState.currentPhase.startBtcPrice) / marketState.currentPhase.startBtcPrice) * 100,
        tokenPerformance: calculatePhasePerformance(marketState.currentPhase.tokens)
      };

      bullPhases.push(phase);
      saveBullPhases(bullPhases);

      console.log(`[Bull Phase] ENDED - Duration: ${getPhaseLength(phase)}, BTC gain: +${phase.btcGain.toFixed(2)}%`);

      // Recalculate momentum scores
      calculateMomentumScores(bullPhases);

      marketState.state = btc24h < -BULL_CONFIG.END_THRESHOLD ? 'bear' : 'neutral';
      marketState.currentPhase = null;
    }
  }
}

// Capture current token performance
function captureTokenPerformance() {
  if (!cache.data) return {};
  const performance = {};
  cache.data.forEach(t => {
    performance[t.id] = {
      price: t.current_price,
      mcap: t.market_cap
    };
  });
  return performance;
}

// Calculate performance during a phase
function calculatePhasePerformance(startTokens) {
  if (!cache.data || !startTokens) return {};
  const performance = {};

  cache.data.forEach(t => {
    const start = startTokens[t.id];
    if (start && start.price > 0) {
      const gain = ((t.current_price - start.price) / start.price) * 100;
      performance[t.id] = {
        symbol: t.symbol,
        gain: gain,
        startPrice: start.price,
        endPrice: t.current_price
      };
    }
  });

  return performance;
}

// Calculate phase length in days
function getPhaseLength(phase) {
  const start = new Date(phase.startTime);
  const end = new Date(phase.endTime);
  const days = (end - start) / (1000 * 60 * 60 * 24);
  return days < 1 ? `${Math.round(days * 24)}h` : `${days.toFixed(1)}d`;
}

// Calculate Momentum Scores for all tokens
function calculateMomentumScores(bullPhases) {
  if (bullPhases.length < 1) return;

  const tokenStats = {};
  const btcGains = [];

  // Collect data from all phases
  bullPhases.forEach((phase, phaseIndex) => {
    const btcGain = phase.btcGain || 0;
    btcGains.push(btcGain);

    if (!phase.tokenPerformance) return;

    // Get all gains for this phase to determine top 20%
    const allGains = Object.values(phase.tokenPerformance).map(p => p.gain).sort((a, b) => b - a);
    const top20Threshold = allGains[Math.floor(allGains.length * 0.2)] || 0;

    Object.entries(phase.tokenPerformance).forEach(([tokenId, data]) => {
      if (!tokenStats[tokenId]) {
        tokenStats[tokenId] = {
          symbol: data.symbol,
          gains: [],
          betas: [],
          isTop20: [],
          phaseCount: 0
        };
      }

      const stats = tokenStats[tokenId];
      stats.gains.push(data.gain);
      stats.betas.push(btcGain > 0 ? data.gain / btcGain : 0);
      stats.isTop20.push(data.gain >= top20Threshold);
      stats.phaseCount++;
    });
  });

  // Calculate scores
  const momentumData = { tokens: {}, sectors: {}, lastCalculated: new Date().toISOString() };
  const phaseCount = bullPhases.length;

  Object.entries(tokenStats).forEach(([tokenId, stats]) => {
    // Average Beta (gain relative to BTC)
    const avgBeta = stats.betas.reduce((a, b) => a + b, 0) / stats.betas.length;

    // Consistency (% of phases in top 20%)
    const consistency = stats.isTop20.filter(Boolean).length / stats.phaseCount;

    // Average Gain
    const avgGain = stats.gains.reduce((a, b) => a + b, 0) / stats.gains.length;

    // Recency-weighted gain (last 5 phases weighted more)
    const recentPhases = stats.gains.slice(-5);
    const weights = recentPhases.map((_, i) => (i + 1) / recentPhases.length);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const recencyGain = recentPhases.reduce((sum, gain, i) => sum + gain * weights[i], 0) / totalWeight;

    // Normalize components to 0-100 scale
    const normBeta = Math.min(100, Math.max(0, (avgBeta / 5) * 100)); // Assume max beta of 5x
    const normConsistency = consistency * 100;
    const normRecency = Math.min(100, Math.max(0, (recencyGain / 50) * 100)); // Assume max 50% gain
    const normAvgGain = Math.min(100, Math.max(0, (avgGain / 50) * 100));

    // Final score: Beta×0.35 + Consistency×0.25 + Recency×0.20 + AvgGain×0.20
    const score = Math.round(
      normBeta * 0.35 +
      normConsistency * 0.25 +
      normRecency * 0.20 +
      normAvgGain * 0.20
    );

    // Determine tier
    let tier;
    if (score >= 90) tier = 'S';
    else if (score >= 75) tier = 'A';
    else if (score >= 60) tier = 'B';
    else if (score >= 45) tier = 'C';
    else if (score >= 30) tier = 'D';
    else tier = 'F';

    momentumData.tokens[tokenId] = {
      symbol: stats.symbol,
      score,
      tier,
      beta: avgBeta,
      consistency: consistency * 100,
      avgGain,
      recencyGain,
      phaseCount: stats.phaseCount
    };
  });

  // Calculate sector momentum
  const sectorTokens = {
    'Layer 1': ['ethereum', 'solana', 'binancecoin', 'cardano', 'tron', 'avalanche-2', 'toncoin', 'polkadot', 'cosmos', 'sui'],
    'Layer 2': ['arbitrum', 'optimism', 'matic-network', 'mantle', 'immutable-x', 'starknet', 'zksync', 'manta-network', 'metis-token', 'loopring'],
    'DEX': ['uniswap', 'raydium', 'jupiter-exchange-solana', 'pancakeswap-token', 'curve-dao-token', 'aerodrome-finance', 'velodrome-finance', 'orca', 'camelot-token', 'sushiswap'],
    'Memes': ['dogecoin', 'shiba-inu', 'pepe', 'dogwifcoin', 'bonk', 'floki', 'brett-based', 'mog-coin', 'popcat', 'book-of-meme'],
    'AI Agents': ['artificial-superintelligence-alliance', 'virtuals-protocol', 'ai16z', 'goatseus-maximus', 'fartcoin', 'griffain', 'zerebro', 'ai-rig-complex', 'cookie', 'aixbt'],
    'Gaming': ['immutable-x', 'gala', 'the-sandbox', 'axie-infinity', 'ronin', 'beam-2', 'illuvium', 'enjincoin', 'ultra', 'echelon-prime'],
    'DePIN': ['helium', 'iotex', 'hivemapper', 'grass', 'dimo', 'render-token', 'filecoin', 'theta-token', 'akash-network', 'nosana'],
    'Lending': ['aave', 'compound-governance-token', 'venus', 'radiant-capital', 'morpho', 'euler', 'benqi', 'kamino', 'silo-finance', 'spark'],
    'Derivatives': ['hyperliquid', 'gmx', 'dydx-chain', 'gains-network', 'synthetix-network-token', 'drift-protocol', 'vertex-protocol', 'aevo-exchange', 'ribbon-finance', 'lyra-finance'],
    'Liquid Staking': ['lido-dao', 'rocket-pool', 'jito-governance-token', 'frax-share', 'ether-fi', 'ankr', 'stader', 'marinade', 'stride', 'stakewise']
  };

  Object.entries(sectorTokens).forEach(([sector, tokens]) => {
    const sectorScores = tokens
      .map(id => momentumData.tokens[id]?.score)
      .filter(s => s !== undefined);

    if (sectorScores.length > 0) {
      momentumData.sectors[sector] = {
        avgScore: Math.round(sectorScores.reduce((a, b) => a + b, 0) / sectorScores.length),
        tokenCount: sectorScores.length
      };
    }
  });

  saveMomentumData(momentumData);
  console.log(`[Momentum] Calculated scores for ${Object.keys(momentumData.tokens).length} tokens`);

  return momentumData;
}

// Initialize mock data for development
function initializeMockData() {
  const existingPhases = loadBullPhases();
  if (existingPhases.length > 0) {
    console.log(`[Momentum] Loaded ${existingPhases.length} existing bull phases`);
    calculateMomentumScores(existingPhases);
    return;
  }

  console.log('[Momentum] Generating mock bull phases for development...');

  // Generate 12 mock bull phases
  const mockPhases = [];
  const baseDate = new Date('2024-06-01');

  // Token performance multipliers (how much they pump relative to BTC)
  const tokenMultipliers = {
    'bonk': { base: 3.2, variance: 0.8 },
    'dogwifcoin': { base: 3.0, variance: 0.7 },
    'pepe': { base: 2.8, variance: 0.9 },
    'floki': { base: 2.5, variance: 0.6 },
    'solana': { base: 2.2, variance: 0.4 },
    'sui': { base: 2.1, variance: 0.5 },
    'virtuals-protocol': { base: 2.8, variance: 0.9 },
    'ai16z': { base: 2.6, variance: 0.8 },
    'render-token': { base: 2.0, variance: 0.5 },
    'arbitrum': { base: 1.8, variance: 0.4 },
    'optimism': { base: 1.7, variance: 0.4 },
    'aave': { base: 1.5, variance: 0.3 },
    'uniswap': { base: 1.4, variance: 0.3 },
    'ethereum': { base: 1.2, variance: 0.2 },
    'cardano': { base: 1.1, variance: 0.3 },
    'dogecoin': { base: 2.4, variance: 0.7 },
    'shiba-inu': { base: 2.3, variance: 0.8 },
    'popcat': { base: 3.1, variance: 0.9 },
    'book-of-meme': { base: 2.9, variance: 1.0 },
    'mog-coin': { base: 2.7, variance: 0.8 },
    'brett-based': { base: 2.6, variance: 0.7 },
    'fartcoin': { base: 2.5, variance: 0.9 },
    'goatseus-maximus': { base: 2.4, variance: 0.8 },
    'aixbt': { base: 2.3, variance: 0.7 },
    'hyperliquid': { base: 2.0, variance: 0.5 },
    'jupiter-exchange-solana': { base: 1.9, variance: 0.4 },
    'raydium': { base: 1.8, variance: 0.5 },
    'jito-governance-token': { base: 1.7, variance: 0.4 },
    'gala': { base: 1.6, variance: 0.5 },
    'immutable-x': { base: 1.5, variance: 0.4 },
    'helium': { base: 1.4, variance: 0.4 },
    'chainlink': { base: 1.3, variance: 0.3 },
    'polkadot': { base: 1.2, variance: 0.3 },
    'cosmos': { base: 1.1, variance: 0.3 }
  };

  for (let i = 0; i < 12; i++) {
    const startDate = new Date(baseDate.getTime() + i * 15 * 24 * 60 * 60 * 1000);
    const duration = 1 + Math.random() * 4; // 1-5 days
    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
    const btcGain = 5 + Math.random() * 15; // 5-20%

    const tokenPerformance = {};

    Object.entries(tokenMultipliers).forEach(([tokenId, mult]) => {
      const multiplier = mult.base + (Math.random() - 0.5) * mult.variance * 2;
      const gain = btcGain * multiplier;
      tokenPerformance[tokenId] = {
        symbol: tokenId.split('-')[0].toUpperCase().slice(0, 5),
        gain: gain,
        startPrice: 1,
        endPrice: 1 + gain / 100
      };
    });

    // Add some lower performers
    ['maker', 'compound-governance-token', 'liquity', 'binancecoin', 'tron'].forEach(id => {
      const gain = btcGain * (0.5 + Math.random() * 0.5);
      tokenPerformance[id] = {
        symbol: id.split('-')[0].toUpperCase().slice(0, 5),
        gain: gain,
        startPrice: 1,
        endPrice: 1 + gain / 100
      };
    });

    mockPhases.push({
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      startBtcPrice: 40000 + i * 2000,
      endBtcPrice: (40000 + i * 2000) * (1 + btcGain / 100),
      peakBtc24h: btcGain + Math.random() * 3,
      btcGain: btcGain,
      tokenPerformance
    });
  }

  saveBullPhases(mockPhases);
  calculateMomentumScores(mockPhases);
  console.log(`[Momentum] Generated ${mockPhases.length} mock bull phases`);
}

// Middleware
app.use(compression());
app.use(express.json());

// CORS for Google Sheets
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-API-Key');
  next();
});

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

    // Fetch in batches of 200 (CoinGecko allows up to 250)
    const batchSize = 200;
    const allData = [];

    for (let i = 0; i < allTokenIds.length; i += batchSize) {
      const batch = allTokenIds.slice(i, i + batchSize);
      const url = `${COINGECKO_BASE_URL}/coins/markets?vs_currency=usd&ids=${batch.join(',')}&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h,7d,30d`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'x-cg-pro-api-key': COINGECKO_API_KEY
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

    // Save snapshot and update market state
    saveSnapshot(allData);
    updateMarketState();

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
  stats.websiteRequests++;

  try {
    // Return cached data if valid
    if (isCacheValid()) {
      stats.cacheHits++;
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
    isRefreshing: cache.isRefreshing,
    stats: {
      uptime: Math.round((Date.now() - stats.startTime) / 1000 / 60) + ' min',
      websiteRequests: stats.websiteRequests,
      sheetsRequests: stats.sheetsRequests,
      cacheHits: stats.cacheHits,
      hitRate: stats.cacheHits > 0 ?
        Math.round(stats.cacheHits / (stats.websiteRequests + stats.sheetsRequests) * 100) + '%' : '0%'
    }
  });
});

/**
 * GOOGLE SHEETS ENDPOINT
 *
 * Returns data in format optimized for Google Apps Script.
 * Use in Apps Script:
 *
 * function loadData() {
 *   const url = 'https://sectormap.dpdns.org/api/sheets?key=crypto-dashboard-2024';
 *   const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
 *   return JSON.parse(response.getContentText());
 * }
 */
app.get('/api/sheets', async (req, res) => {
  stats.sheetsRequests++;

  // API key validation
  const apiKey = req.query.key || req.headers['x-api-key'];
  if (SHEETS_API_KEY && apiKey !== SHEETS_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  try {
    // Return cached data if valid, otherwise fetch
    let data = cache.data;
    if (!isCacheValid()) {
      data = await fetchAndCacheAllData();
    } else {
      stats.cacheHits++;
    }

    if (!data || data.length === 0) {
      return res.status(503).json({ error: 'Data temporarily unavailable' });
    }

    // Build response optimized for Google Sheets
    const dataMap = {};
    data.forEach(coin => {
      dataMap[coin.id] = {
        id: coin.id,
        symbol: (coin.symbol || '').toUpperCase(),
        name: coin.name,
        price: coin.current_price,
        market_cap: coin.market_cap,
        volume_24h: coin.total_volume,
        change_24h: coin.price_change_percentage_24h_in_currency,
        change_7d: coin.price_change_percentage_7d_in_currency,
        change_30d: coin.price_change_percentage_30d_in_currency,
        high_24h: coin.high_24h,
        low_24h: coin.low_24h,
        ath: coin.ath,
        ath_change_percentage: coin.ath_change_percentage,
        image: coin.image
      };
    });

    // Include sector stats
    const sectorStats = {};
    Object.entries(SECTORS).forEach(([sectorName, tokens]) => {
      let totalMcap = 0, sum24 = 0, sum7d = 0, sum30d = 0, count = 0;
      let best24h = { symbol: '-', value: -Infinity };

      tokens.forEach(id => {
        const coin = dataMap[id];
        if (coin) {
          totalMcap += coin.market_cap || 0;
          if (coin.change_24h != null) {
            sum24 += coin.change_24h;
            count++;
            if (coin.change_24h > best24h.value) {
              best24h = { symbol: coin.symbol, value: coin.change_24h };
            }
          }
          if (coin.change_7d != null) sum7d += coin.change_7d;
          if (coin.change_30d != null) sum30d += coin.change_30d;
        }
      });

      sectorStats[sectorName] = {
        mcap: totalMcap,
        avg24h: count > 0 ? sum24 / count : 0,
        avg7d: count > 0 ? sum7d / count : 0,
        avg30d: count > 0 ? sum30d / count : 0,
        tokenCount: count,
        best: best24h.value > -Infinity ? best24h : null
      };
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      cacheAge: Math.round((Date.now() - cache.timestamp) / 1000),
      tokenCount: data.length,
      data: dataMap,
      sectors: sectorStats,
      sectorTokens: SECTORS
    });

  } catch (error) {
    console.error('[API/sheets] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch data', message: error.message });
  }
});

// ==================== MOMENTUM API ENDPOINTS ====================

// Fear & Greed Index cache
let fearGreedCache = { data: null, timestamp: 0 };
const FEAR_GREED_TTL = 30 * 60 * 1000; // 30 minutes

// Get Fear & Greed Index
app.get('/api/fear-greed', async (req, res) => {
  try {
    // Check cache
    if (fearGreedCache.data && (Date.now() - fearGreedCache.timestamp < FEAR_GREED_TTL)) {
      return res.json(fearGreedCache.data);
    }

    // Fetch from Alternative.me API
    const response = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!response.ok) {
      throw new Error('Failed to fetch Fear & Greed Index');
    }

    const data = await response.json();
    const fngData = data.data?.[0];

    if (!fngData) {
      throw new Error('Invalid Fear & Greed data');
    }

    const result = {
      value: parseInt(fngData.value),
      classification: fngData.value_classification,
      timestamp: fngData.timestamp,
      lastUpdate: new Date().toISOString()
    };

    // Cache result
    fearGreedCache = { data: result, timestamp: Date.now() };

    res.json(result);
  } catch (error) {
    console.error('[Fear&Greed] Error:', error.message);
    // Return cached data if available, even if stale
    if (fearGreedCache.data) {
      return res.json(fearGreedCache.data);
    }
    res.status(500).json({ error: 'Failed to fetch Fear & Greed Index' });
  }
});

// Get market state (current bull/neutral/bear status)
app.get('/api/market-state', (req, res) => {
  const btc = getBTCData();
  res.json({
    state: marketState.state,
    btc24h: marketState.btc24h,
    btcPrice: btc?.current_price || null,
    isInBullPhase: marketState.state === 'bull',
    currentPhase: marketState.currentPhase ? {
      startTime: marketState.currentPhase.startTime,
      duration: marketState.currentPhase.startTime ?
        Math.round((Date.now() - new Date(marketState.currentPhase.startTime).getTime()) / (1000 * 60 * 60)) + 'h' : null,
      peakBtc24h: marketState.currentPhase.peakBtc24h
    } : null,
    lastCheck: marketState.lastCheck
  });
});

// Get momentum ratings
app.get('/api/momentum', (req, res) => {
  const momentum = loadMomentumData();
  const bullPhases = loadBullPhases();

  // Sort tokens by score
  const sortedTokens = Object.entries(momentum.tokens || {})
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.score - a.score);

  // Sort sectors by avgScore
  const sortedSectors = Object.entries(momentum.sectors || {})
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.avgScore - a.avgScore);

  res.json({
    tokens: sortedTokens,
    sectors: sortedSectors,
    phaseCount: bullPhases.length,
    avgPhaseDuration: calculateAvgPhaseDuration(bullPhases),
    lastCalculated: momentum.lastCalculated
  });
});

// Get bull phases history
app.get('/api/bull-phases', (req, res) => {
  const bullPhases = loadBullPhases();
  const limit = parseInt(req.query.limit) || 10;

  // Get recent phases with top performers
  const recentPhases = bullPhases.slice(-limit).reverse().map(phase => {
    const topPerformers = Object.entries(phase.tokenPerformance || {})
      .sort((a, b) => b[1].gain - a[1].gain)
      .slice(0, 5)
      .map(([id, data]) => ({
        id,
        symbol: data.symbol,
        gain: data.gain
      }));

    return {
      startTime: phase.startTime,
      endTime: phase.endTime,
      btcGain: phase.btcGain,
      duration: getPhaseLength(phase),
      topPerformers
    };
  });

  res.json({
    phases: recentPhases,
    totalCount: bullPhases.length
  });
});

// Helper: Calculate average phase duration
function calculateAvgPhaseDuration(phases) {
  if (phases.length === 0) return '0d';

  const totalDays = phases.reduce((sum, phase) => {
    const start = new Date(phase.startTime);
    const end = new Date(phase.endTime);
    return sum + (end - start) / (1000 * 60 * 60 * 24);
  }, 0);

  const avg = totalDays / phases.length;
  return avg < 1 ? `${Math.round(avg * 24)}h` : `${avg.toFixed(1)}d`;
}

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
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Crypto Sectors Dashboard v3.1 - UNIFIED API             ║
║                                                           ║
║   Server: http://localhost:${PORT}                          ║
║                                                           ║
║   Endpoints:                                              ║
║   • /api/markets      - Website data                      ║
║   • /api/sheets       - Google Sheets data                ║
║   • /api/cache-status - Cache monitoring + stats          ║
║   • /api/fear-greed   - Fear & Greed Index                ║
║   • /api/momentum     - Momentum ratings                  ║
║                                                           ║
║   Cache TTL: 30 seconds (shared by website + sheets)      ║
║   Sheets API Key: ${SHEETS_API_KEY}                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Initialize momentum data (load or generate mock)
  initializeMockData();

  // Pre-fetch data on startup
  fetchAndCacheAllData();

  // Background refresh every 30 seconds
  setInterval(fetchAndCacheAllData, CACHE_TTL);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  process.exit(0);
});
