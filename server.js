/**
 * Crypto Sectors Dashboard - Server
 * Express server with CoinGecko API proxy, caching, and Momentum Rating
 */

require('dotenv').config();

const Sentry = require("@sentry/node");
Sentry.init({ dsn: "https://bfe364105f901733843a4bed522ef195@o4510836114194432.ingest.de.sentry.io/4510836135952464" });

const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

// AI Helper (Groq)
let aiHelper = null;
try {
  aiHelper = require('./src/aiHelper');
} catch (e) {
  console.log('[AI] Module not loaded:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== DATA DIRECTORY SETUP ====================
const DATA_DIR = path.join(__dirname, 'data');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');
const BULL_PHASES_FILE = path.join(DATA_DIR, 'bull_phases.json');
const MOMENTUM_FILE = path.join(DATA_DIR, 'momentum.json');
const SIGNALS_FILE = path.join(DATA_DIR, 'signals.json');
const DIGESTS_FILE = path.join(DATA_DIR, 'digests.json');

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

// Initialize signals file
if (!fs.existsSync(SIGNALS_FILE)) {
  fs.writeFileSync(SIGNALS_FILE, JSON.stringify({ signals: [] }, null, 2));
}

// Initialize digests file
if (!fs.existsSync(DIGESTS_FILE)) {
  fs.writeFileSync(DIGESTS_FILE, JSON.stringify({ daily: null, weekly: null }, null, 2));
}

// CoinGecko API configuration - Basic plan ($29/mo)
// 100k calls/month, 250/min rate limit
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || '';
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

// SSE clients for real-time notifications
const sseClients = new Set();

// Sectors configuration for /api/sheets
const SECTORS = {
  'Layer 1': ['ethereum', 'solana', 'binancecoin', 'cardano', 'tron', 'avalanche-2', 'toncoin', 'polkadot', 'cosmos', 'sui'],
  'Layer 2': ['arbitrum', 'optimism', 'matic-network', 'mantle', 'immutable-x', 'starknet', 'zksync', 'manta-network', 'metis-token', 'loopring'],
  'DEX': ['uniswap', 'raydium', 'jupiter-exchange-solana', 'pancakeswap-token', 'curve-dao-token', 'aerodrome-finance', 'velodrome-finance', 'orca', 'camelot-token', 'sushiswap'],
  'DEX Aggregators': ['1inch', 'jupiter-exchange-solana', 'paraswap', 'cowswap', 'openocean-finance', 'dodo', 'kyber-network-crystal', 'hashflow', 'unizen', 'rango'],
  'Derivatives': ['hyperliquid', 'gmx', 'dydx-chain', 'gains-network', 'synthetix-network-token', 'drift-protocol', 'vertex-protocol', 'aevo-exchange', 'ribbon-finance', 'lyra-finance', 'apex-token-2'],
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
  'AI Agents': ['artificial-superintelligence-alliance', 'virtual-protocol', 'ai16z', 'goatseus-maximus', 'fartcoin', 'griffain', 'zerebro', 'ai-rig-complex', 'cookie', 'aixbt', 'giza']
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
    const recencyGain = totalWeight > 0
      ? recentPhases.reduce((sum, gain, i) => sum + gain * weights[i], 0) / totalWeight
      : 0;

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
    'AI Agents': ['artificial-superintelligence-alliance', 'virtual-protocol', 'ai16z', 'goatseus-maximus', 'fartcoin', 'griffain', 'zerebro', 'ai-rig-complex', 'cookie', 'aixbt', 'giza'],
    'Gaming': ['immutable-x', 'gala', 'the-sandbox', 'axie-infinity', 'ronin', 'beam-2', 'illuvium', 'enjincoin', 'ultra', 'echelon-prime'],
    'DePIN': ['helium', 'iotex', 'hivemapper', 'grass', 'dimo', 'render-token', 'filecoin', 'theta-token', 'akash-network', 'nosana'],
    'Lending': ['aave', 'compound-governance-token', 'venus', 'radiant-capital', 'morpho', 'euler', 'benqi', 'kamino', 'silo-finance', 'spark'],
    'Derivatives': ['hyperliquid', 'gmx', 'dydx-chain', 'gains-network', 'synthetix-network-token', 'drift-protocol', 'vertex-protocol', 'aevo-exchange', 'ribbon-finance', 'lyra-finance', 'apex-token-2'],
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
    'virtual-protocol': { base: 2.8, variance: 0.9 },
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
        'drift-protocol', 'vertex-protocol', 'aevo-exchange', 'ribbon-finance', 'lyra-finance', 'apex-token-2',
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
        'artificial-superintelligence-alliance', 'virtual-protocol', 'ai16z', 'goatseus-maximus', 'fartcoin',
        'griffain', 'zerebro', 'ai-rig-complex', 'cookie', 'aixbt', 'giza'
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

// ==================== SIGNALS API ====================

// API key for posting signals (from telegram bot)
const SIGNALS_API_KEY = process.env.SIGNALS_API_KEY || 'sector-alerts-2024';

// Load signals from file
function loadSignals() {
  try {
    if (fs.existsSync(SIGNALS_FILE)) {
      return JSON.parse(fs.readFileSync(SIGNALS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[Signals] Error loading:', e.message);
  }
  return { signals: [] };
}

// Save signals to file
function saveSignals(data) {
  try {
    fs.writeFileSync(SIGNALS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[Signals] Error saving:', e.message);
  }
}

// POST /api/signals - Add new signal (from telegram bot)
app.post('/api/signals', (req, res) => {
  const apiKey = req.query.key || req.headers['x-api-key'];
  if (apiKey !== SIGNALS_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const signal = req.body;
  if (!signal || !signal.type) {
    return res.status(400).json({ error: 'Invalid signal data' });
  }

  // Add timestamp if not present
  signal.timestamp = signal.timestamp || new Date().toISOString();
  signal.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const data = loadSignals();
  data.signals.unshift(signal); // Add to beginning

  // Keep only last 500 signals
  if (data.signals.length > 500) {
    data.signals = data.signals.slice(0, 500);
  }

  saveSignals(data);
  console.log(`[Signals] New signal: ${signal.type} - ${signal.token || signal.sector || 'market'}`);

  // Broadcast to SSE clients
  broadcastSSE({
    type: 'signal',
    signal: {
      id: signal.id,
      type: signal.type,
      token: signal.token,
      sector: signal.sector,
      change_24h: signal.change_24h,
      reason: signal.reason,
      timestamp: signal.timestamp
    }
  });

  res.json({ success: true, id: signal.id });
});

// GET /api/signals - Get signal history
app.get('/api/signals', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const type = req.query.type; // Filter by type
  const token = req.query.token; // Filter by token

  const data = loadSignals();
  let signals = data.signals;

  // Apply filters
  if (type) {
    signals = signals.filter(s => s.type === type);
  }
  if (token) {
    signals = signals.filter(s => s.token && s.token.toLowerCase().includes(token.toLowerCase()));
  }

  // Paginate
  const total = signals.length;
  signals = signals.slice(offset, offset + limit);

  res.json({
    signals,
    total,
    limit,
    offset
  });
});

// ==================== AI ENDPOINTS ====================

// Simple rate limiter for AI endpoints (1 request per 5 sec per IP)
const aiRateLimits = new Map();
function aiRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const lastRequest = aiRateLimits.get(ip);
  if (lastRequest && now - lastRequest < 5000) {
    return res.status(429).json({ error: 'Too many requests. Wait 5 seconds.' });
  }
  aiRateLimits.set(ip, now);
  // Cleanup old entries every 100 requests
  if (aiRateLimits.size > 1000) {
    const cutoff = now - 60000;
    for (const [key, ts] of aiRateLimits) {
      if (ts < cutoff) aiRateLimits.delete(key);
    }
  }
  next();
}

// ==================== AI DIGEST PERSISTENCE ====================

function loadDigests() {
  try {
    if (fs.existsSync(DIGESTS_FILE)) {
      return JSON.parse(fs.readFileSync(DIGESTS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[AI] Error loading digests:', e.message);
  }
  return { daily: null, weekly: null };
}

function saveDigest(type, content) {
  const digests = loadDigests();
  digests[type] = {
    content,
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString('ru-RU')
  };
  fs.writeFileSync(DIGESTS_FILE, JSON.stringify(digests, null, 2));
  console.log(`[AI] ${type} digest saved`);
}

// GET /api/ai/last-digests - Get last saved digests
app.get('/api/ai/last-digests', (req, res) => {
  const digests = loadDigests();
  res.json(digests);
});

// GET /api/ai/status - Check AI availability
app.get('/api/ai/status', (req, res) => {
  if (!aiHelper) {
    return res.json({ available: false, error: 'AI module not loaded' });
  }
  res.json(aiHelper.getStatus());
});

// POST /api/ai/daily-digest - Generate daily digest
app.post('/api/ai/daily-digest', aiRateLimit, async (req, res) => {
  if (!aiHelper || !aiHelper.isAvailable) {
    return res.status(503).json({ error: 'AI not available' });
  }

  try {
    // Gather data
    const sectors = await getSectorsSummary();
    const todaySignals = getTodaySignals();
    const marketState = getMarketState();
    const fearGreed = await getFearGreedIndex();

    const result = await aiHelper.generateDailyDigest({
      sectors,
      signals: todaySignals,
      marketState: marketState?.state,
      fearGreed
    });

    if (result.success) {
      saveDigest('daily', result.digest);
    }

    res.json(result);
  } catch (error) {
    console.error('[AI] Daily digest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/weekly-digest - Generate weekly digest
app.post('/api/ai/weekly-digest', aiRateLimit, async (req, res) => {
  if (!aiHelper || !aiHelper.isAvailable) {
    return res.status(503).json({ error: 'AI not available' });
  }

  try {
    // Gather data
    const sectors = await getSectorsSummary();
    const weekSignals = getWeekSignals();
    const momentum = loadMomentumData();

    const result = await aiHelper.generateWeeklyDigest({
      sectors,
      signals: weekSignals,
      weeklyStats: {},
      momentum
    });

    if (result.success) {
      saveDigest('weekly', result.digest);
    }

    res.json(result);
  } catch (error) {
    console.error('[AI] Weekly digest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/explain - Explain a signal
app.post('/api/ai/explain', aiRateLimit, async (req, res) => {
  if (!aiHelper || !aiHelper.isAvailable) {
    return res.status(503).json({ error: 'AI not available' });
  }

  const { signal } = req.body;
  if (!signal) {
    return res.status(400).json({ error: 'Signal data required' });
  }

  try {
    const sectors = await getSectorsSummary();
    const sectorData = sectors.find(s => s.name === signal.sector);
    const result = await aiHelper.explainSignal(signal, sectorData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/ask - Ask AI a question
app.post('/api/ai/ask', aiRateLimit, async (req, res) => {
  if (!aiHelper || !aiHelper.isAvailable) {
    return res.status(503).json({ error: 'AI not available' });
  }

  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Question required' });
  }

  try {
    // Build market context
    const sectors = await getSectorsSummary();
    const marketState = getMarketState();
    const fearGreed = await getFearGreedIndex();

    const context = buildMarketContext(sectors, marketState, fearGreed);
    const result = await aiHelper.askQuestion(question, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: Get sectors summary for AI
async function getSectorsSummary() {
  // Ensure cache is fresh
  if (!isCacheValid()) {
    await fetchAllMarketData();
  }

  if (!cache.data) return [];

  const sectorSummary = [];
  for (const [sectorName, tokenIds] of Object.entries(SECTORS)) {
    const tokens = cache.data.filter(t => tokenIds.includes(t.id));
    if (tokens.length === 0) continue;

    const avgChange24h = tokens.reduce((sum, t) => sum + (t.price_change_percentage_24h || 0), 0) / tokens.length;
    const avgChange7d = tokens.reduce((sum, t) => sum + (t.price_change_percentage_7d_in_currency || 0), 0) / tokens.length;
    const totalMcap = tokens.reduce((sum, t) => sum + (t.market_cap || 0), 0);

    sectorSummary.push({
      name: sectorName,
      change_24h: avgChange24h,
      change_7d: avgChange7d,
      market_cap: totalMcap,
      tokens_count: tokens.length
    });
  }

  return sectorSummary;
}

// Helper: Get today's signals
function getTodaySignals() {
  const data = loadSignals();
  const today = new Date().toDateString();
  return data.signals.filter(s => new Date(s.timestamp).toDateString() === today);
}

// Helper: Get week's signals
function getWeekSignals() {
  const data = loadSignals();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return data.signals.filter(s => new Date(s.timestamp).getTime() > weekAgo);
}

// Helper: Get market state
function getMarketState() {
  const momentum = loadMomentumData();
  if (momentum && momentum.currentPhase) {
    return { state: 'bull', phase: momentum.currentPhase };
  }
  // TODO: determine bear/neutral from BTC data
  return { state: 'neutral' };
}

// Helper: Get Fear & Greed Index
async function getFearGreedIndex() {
  try {
    // Check cache
    if (fearGreedCache.data && (Date.now() - fearGreedCache.timestamp < FEAR_GREED_TTL)) {
      return fearGreedCache.data;
    }

    // Fetch from Alternative.me API
    const response = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!response.ok) return fearGreedCache.data || null;

    const data = await response.json();
    const fngData = data.data?.[0];
    if (!fngData) return fearGreedCache.data || null;

    const result = {
      value: parseInt(fngData.value),
      classification: fngData.value_classification,
      timestamp: fngData.timestamp
    };

    fearGreedCache = { data: result, timestamp: Date.now() };
    return result;
  } catch (e) {
    return fearGreedCache.data || null;
  }
}

// Helper: Build market context for AI questions
function buildMarketContext(sectors, marketState, fearGreed) {
  let context = `Состояние рынка: ${marketState?.state || 'unknown'}\n`;
  context += `Fear & Greed: ${fearGreed?.value || 'N/A'} (${fearGreed?.classification || 'N/A'})\n\n`;
  context += `Секторы (по 24h):\n`;

  sectors
    .sort((a, b) => (b.change_24h || 0) - (a.change_24h || 0))
    .slice(0, 10)
    .forEach(s => {
      context += `• ${s.name}: ${s.change_24h > 0 ? '+' : ''}${s.change_24h?.toFixed(1)}%\n`;
    });

  return context;
}

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

// ==================== SSE (Server-Sent Events) ====================

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send initial heartbeat
  res.write('data: {"type":"connected"}\n\n');

  sseClients.add(res);
  console.log(`[SSE] Client connected (total: ${sseClients.size})`);

  req.on('close', () => {
    sseClients.delete(res);
    console.log(`[SSE] Client disconnected (total: ${sseClients.size})`);
  });

  // Keep-alive every 30s
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  req.on('close', () => clearInterval(keepAlive));
});

// Broadcast event to all SSE clients
function broadcastSSE(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// ==================== FILTERED API ====================

app.get('/api/filtered', async (req, res) => {
  try {
    const data = isCacheValid() ? cache.data : await fetchAndCache();
    if (!data) {
      return res.status(503).json({ error: 'No data available' });
    }

    // Parse query filters
    const sectors = req.query.sectors ? req.query.sectors.split(',') : null;
    const minChange = parseFloat(req.query.minChange) || null;
    const maxChange = parseFloat(req.query.maxChange) || null;
    const minVolume = parseFloat(req.query.minVolume) || null;
    const minMcap = parseFloat(req.query.minMcap) || null;
    const search = req.query.search ? req.query.search.toLowerCase() : null;

    // Build sector-token lookup
    const tokenToSector = {};
    for (const [sectorName, tokenIds] of Object.entries(SECTORS)) {
      for (const id of tokenIds) {
        tokenToSector[id] = sectorName;
      }
    }

    // Filter tokens
    let filtered = data.filter(token => {
      // Sector filter
      if (sectors) {
        const tokenSector = tokenToSector[token.id];
        if (!tokenSector || !sectors.includes(tokenSector)) return false;
      }

      // Price change filter
      const change24h = token.price_change_percentage_24h_in_currency;
      if (minChange !== null && (change24h === null || Math.abs(change24h) < minChange)) return false;
      if (maxChange !== null && change24h !== null && Math.abs(change24h) > maxChange) return false;

      // Volume filter
      if (minVolume !== null && (token.total_volume || 0) < minVolume) return false;

      // Market cap filter
      if (minMcap !== null && (token.market_cap || 0) < minMcap) return false;

      // Search filter
      if (search) {
        const name = (token.name || '').toLowerCase();
        const symbol = (token.symbol || '').toLowerCase();
        if (!name.includes(search) && !symbol.includes(search)) return false;
      }

      return true;
    });

    res.json({
      success: true,
      total: filtered.length,
      data: filtered
    });

  } catch (error) {
    console.error('[Filtered] Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
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

// ==================== AI DIGEST AUTO-GENERATION ====================

async function generateAndSaveDigest(type) {
  if (!aiHelper || !aiHelper.isAvailable) {
    console.log(`[AI] Skipping ${type} digest: AI not available`);
    return;
  }

  try {
    console.log(`[AI] Auto-generating ${type} digest...`);
    const sectors = await getSectorsSummary();

    if (type === 'daily') {
      const todaySignals = getTodaySignals();
      const marketState = getMarketState();
      const fearGreed = await getFearGreedIndex();
      const result = await aiHelper.generateDailyDigest({
        sectors,
        signals: todaySignals,
        marketState: marketState?.state,
        fearGreed
      });
      if (result.success) {
        saveDigest('daily', result.digest);
        console.log('[AI] Daily digest auto-generated successfully');
      }
    } else {
      const weekSignals = getWeekSignals();
      const momentum = loadMomentumData();
      const result = await aiHelper.generateWeeklyDigest({
        sectors,
        signals: weekSignals,
        weeklyStats: {},
        momentum
      });
      if (result.success) {
        saveDigest('weekly', result.digest);
        console.log('[AI] Weekly digest auto-generated successfully');
      }
    }
  } catch (e) {
    console.error(`[AI] Auto-generate ${type} digest error:`, e.message);
  }
}

function scheduleDigests() {
  // Check every minute if it's time to generate
  setInterval(() => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const utcDay = now.getUTCDay(); // 0=Sun, 1=Mon

    // Daily digest at 9:00 UTC
    if (utcHour === 9 && utcMinute === 0) {
      const digests = loadDigests();
      const lastDaily = digests.daily?.timestamp;
      const hourAgo = Date.now() - 3600000;
      if (!lastDaily || new Date(lastDaily).getTime() < hourAgo) {
        generateAndSaveDigest('daily');
      }
    }

    // Weekly digest on Monday 9:05 UTC
    if (utcDay === 1 && utcHour === 9 && utcMinute === 5) {
      const digests = loadDigests();
      const lastWeekly = digests.weekly?.timestamp;
      const dayAgo = Date.now() - 86400000;
      if (!lastWeekly || new Date(lastWeekly).getTime() < dayAgo) {
        generateAndSaveDigest('weekly');
      }
    }
  }, 60000); // Check every 60 seconds

  console.log('[AI] Digest scheduler started (daily 9:00 UTC, weekly Mon 9:05 UTC)');
}

// Sentry error handler (must be after all routes)
Sentry.setupExpressErrorHandler(app);

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Crypto Sectors Dashboard v3.3 - AI POWERED              ║
║                                                           ║
║   Server: http://localhost:${PORT}                          ║
║                                                           ║
║   Endpoints:                                              ║
║   • /api/markets      - Website data                      ║
║   • /api/sheets       - Google Sheets data                ║
║   • /api/cache-status - Cache monitoring + stats          ║
║   • /api/fear-greed   - Fear & Greed Index                ║
║   • /api/momentum     - Momentum ratings                  ║
║   • /api/signals      - Sector alerts history (NEW!)      ║
║                                                           ║
║   Pages:                                                  ║
║   • /signals.html     - Signal history viewer             ║
║                                                           ║
║   Cache TTL: 30 seconds (shared by website + sheets)      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Initialize momentum data (load or generate mock)
  initializeMockData();

  // Pre-fetch data on startup
  fetchAndCacheAllData();

  // Background refresh every 30 seconds
  setInterval(fetchAndCacheAllData, CACHE_TTL);

  // Schedule AI digest auto-generation
  scheduleDigests();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  process.exit(0);
});
