/**
 * Crypto Sectors Dashboard Configuration
 * Based on Token Terminal taxonomy (Jan 2025)
 */

const CONFIG = {
  API_ENDPOINT: '/api/markets', // Server-side proxy (API key hidden)
  REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
  BATCH_SIZE: 50,
  BATCH_DELAY: 1500, // 1.5 seconds between batches
  MAX_RETRIES: 3, // Max retry attempts for rate limiting
};

// Momentum Rating Configuration
const MOMENTUM_CONFIG = {
  // Score tier thresholds and colors
  TIERS: {
    S: { min: 90, color: '#FFD700', label: 'S', description: 'Исторически пампится сильнее всех' },
    A: { min: 75, color: '#22C55E', label: 'A', description: 'Сильный участник ралли' },
    B: { min: 60, color: '#3B82F6', label: 'B', description: 'Выше среднего' },
    C: { min: 45, color: '#A855F7', label: 'C', description: 'Средний, следует за рынком' },
    D: { min: 30, color: '#F97316', label: 'D', description: 'Слабая корреляция' },
    F: { min: 0, color: '#EF4444', label: 'F', description: 'Минимальная корреляция с ралли' }
  },

  // Market state colors and SVG icons
  MARKET_STATE: {
    bull: {
      color: '#22C55E',
      bgColor: 'rgba(34, 197, 94, 0.15)',
      // Rocket icon - upward momentum
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`
    },
    neutral: {
      color: '#A855F7',
      bgColor: 'rgba(168, 85, 247, 0.15)',
      // Balance/scale icon - equilibrium
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 8l7-5 7 5"/><path d="M3 13l5-5v7a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3V8l5 5"/><circle cx="5" cy="17" r="2"/><circle cx="19" cy="17" r="2"/></svg>`
    },
    bear: {
      color: '#EF4444',
      bgColor: 'rgba(239, 68, 68, 0.15)',
      // Trending down icon - downward momentum
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>`
    }
  },

  // Beta interpretation
  BETA_LEVELS: {
    high: { min: 2.5, description: 'Высокий бета' },
    medium: { min: 1.5, description: 'Средний бета' },
    low: { min: 0, description: 'Низкий бета' }
  }
};

// Sector colors for visual identification
const SECTOR_COLORS = {
  'Layer 1':            '#FFD700',
  'Layer 2':            '#40E0D0',
  'DEX':                '#B19CD9',
  'DEX Aggregators':    '#9370DB',
  'Lending':            '#77DD77',
  'Derivatives':        '#98FB98',
  'Liquid Staking':     '#FF69B4',
  'Stablecoins':        '#87CEEB',
  'Asset Management':   '#DEB887',
  'NFT Marketplaces':   '#FF7F50',
  'RWA':                '#FFB347',
  'Bridges':            '#20B2AA',
  'Infrastructure':     '#4DA6FF',
  'DePIN':              '#32CD32',
  'Social':             '#FF6B6B',
  'Gaming':             '#FF4500',
  'Memes':              '#DDA0DD',
  'Oracles':            '#6495ED',
  'Prediction Markets': '#DA70D6',
  'AI Agents':          '#00CED1'
};

// Sector icons (SVG)
const SECTOR_ICONS = {
  'Layer 1': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
  'Layer 2': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 12l10 5 10-5" opacity="0.5"/></svg>`,
  'DEX': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  'DEX Aggregators': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/><path d="M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>`,
  'Lending': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="8" y1="14" x2="16" y2="14"/></svg>`,
  'Derivatives': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-5"/><circle cx="20" cy="11" r="1" fill="currentColor"/></svg>`,
  'Liquid Staking': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2c0 0-8 6-8 12a8 8 0 1 0 16 0c0-6-8-12-8-12z"/><path d="M12 22c-2 0-4-1.5-4-4 0-2.5 4-6 4-6s4 3.5 4 6c0 2.5-2 4-4 4z" opacity="0.5"/></svg>`,
  'Stablecoins': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M14.5 9a2.5 2.5 0 0 0-5 0c0 1.5 2.5 2 2.5 3.5a2.5 2.5 0 0 1-5 0"/><line x1="12" y1="5" x2="12" y2="7"/><line x1="12" y1="17" x2="12" y2="19"/></svg>`,
  'Asset Management': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M12 12v4"/><path d="M8 12h8"/></svg>`,
  'NFT Marketplaces': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15l-5-5L5 21"/></svg>`,
  'RWA': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/><path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/></svg>`,
  'Bridges': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19h16"/><path d="M4 15a8 8 0 0 1 16 0"/><line x1="8" y1="15" x2="8" y2="19"/><line x1="16" y1="15" x2="16" y2="19"/><line x1="12" y1="11" x2="12" y2="19"/></svg>`,
  'Infrastructure': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/><path d="M10 7h4M10 17h4M7 10v4M17 10v4"/></svg>`,
  'DePIN': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="3"/><path d="M12 8v4"/><circle cx="5" cy="19" r="3"/><path d="M7.5 16.5L10 14"/><circle cx="19" cy="19" r="3"/><path d="M16.5 16.5L14 14"/><circle cx="12" cy="12" r="2"/></svg>`,
  'Social': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="11" r="3"/><path d="M17 14a3 3 0 0 1 3 3v2"/></svg>`,
  'Gaming': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="4"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="16" cy="10" r="1" fill="currentColor"/><circle cx="18" cy="12" r="1" fill="currentColor"/></svg>`,
  'Memes': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9" stroke-width="3" stroke-linecap="round"/><line x1="15" y1="9" x2="15.01" y2="9" stroke-width="3" stroke-linecap="round"/></svg>`,
  'Oracles': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>`,
  'Prediction Markets': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/><path d="M16 16l2 2"/></svg>`,
  'AI Agents': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="10" r="1.5" fill="currentColor"/><path d="M8 15c0 0 1.5 2 4 2s4-2 4-2"/><path d="M12 2v2M12 20v2"/></svg>`
};

// Token lists per sector (CoinGecko IDs)
const SECTORS = {
  'Layer 1': [
    'ethereum', 'solana', 'binancecoin', 'cardano', 'tron',
    'avalanche-2', 'toncoin', 'polkadot', 'cosmos', 'sui'
  ],
  
  'Layer 2': [
    'arbitrum', 'optimism', 'matic-network', 'mantle', 'immutable-x',
    'starknet', 'zksync', 'manta-network', 'metis-token', 'loopring'
  ],
  
  'DEX': [
    'uniswap', 'raydium', 'jupiter-exchange-solana', 'pancakeswap-token', 'curve-dao-token',
    'aerodrome-finance', 'velodrome-finance', 'orca', 'camelot-token', 'sushiswap'
  ],
  
  'DEX Aggregators': [
    '1inch', 'jupiter-exchange-solana', 'paraswap', 'cowswap', 'openocean-finance',
    'dodo', 'kyber-network-crystal', 'hashflow', 'unizen', 'rango'
  ],
  
  'Derivatives': [
    'hyperliquid', 'gmx', 'dydx-chain', 'gains-network', 'synthetix-network-token',
    'drift-protocol', 'vertex-protocol', 'aevo-exchange', 'ribbon-finance', 'lyra-finance'
  ],
  
  'Lending': [
    'aave', 'compound-governance-token', 'venus', 'radiant-capital', 'morpho',
    'euler', 'benqi', 'kamino', 'silo-finance', 'spark'
  ],
  
  'Liquid Staking': [
    'lido-dao', 'rocket-pool', 'jito-governance-token', 'frax-share', 'ether-fi',
    'ankr', 'stader', 'marinade', 'stride', 'stakewise'
  ],
  
  'Stablecoins': [
    'maker', 'ethena', 'frax-share', 'liquity', 'rai',
    'alchemix', 'angle-protocol', 'reserve-rights-token', 'spell-token', 'frax'
  ],
  
  'Asset Management': [
    'yearn-finance', 'convex-finance', 'instadapp', 'sommelier', 'enzyme-finance',
    'rari-governance-token', 'badger-dao', 'harvest-finance', 'idle-finance', 'vesper-finance'
  ],
  
  'Infrastructure': [
    'bittensor', 'render-token', 'internet-computer', 'the-graph', 'filecoin',
    'arweave', 'akash-network', 'theta-token', 'livepeer', 'pocket-network'
  ],
  
  'Oracles': [
    'chainlink', 'band-protocol', 'api3', 'dia-data', 'uma',
    'tellor', 'nest-protocol', 'dos-network', 'razor-network', 'witnet'
  ],
  
  'Bridges': [
    'wormhole', 'stargate-finance', 'layerzero', 'across-protocol', 'synapse-2',
    'celer-network', 'hop-protocol', 'multichain', 'connext', 'router-protocol'
  ],
  
  'DePIN': [
    'helium', 'iotex', 'hivemapper', 'grass', 'dimo',
    'render-token', 'filecoin', 'theta-token', 'akash-network', 'nosana'
  ],
  
  'NFT Marketplaces': [
    'blur', 'looks-rare', 'x2y2', 'rarible', 'superrare',
    'magic-eden', 'tensor', 'zora', 'foundation', 'manifold-finance'
  ],
  
  'Gaming': [
    'immutable-x', 'gala', 'the-sandbox', 'axie-infinity', 'ronin',
    'beam-2', 'illuvium', 'enjincoin', 'ultra', 'echelon-prime'
  ],
  
  'Social': [
    'friend-tech', 'lens-protocol', 'cyberconnect', 'hooked-protocol', 'galxe',
    'mask-network', 'status', 'rally-2', 'whale', 'chiliz'
  ],
  
  'Prediction Markets': [
    'polymarket', 'gnosis', 'augur', 'azuro', 'thales',
    'hedgehog-markets', 'zeitgeist', 'polkamarkets', 'omen', 'sx-network'
  ],
  
  'RWA': [
    'ondo-finance', 'mantra-dao', 'centrifuge', 'goldfinch', 'maple',
    'clearpool', 'pendle', 'polymesh', 'truefi', 'realio-network'
  ],
  
  'Memes': [
    'dogecoin', 'shiba-inu', 'pepe', 'dogwifcoin', 'bonk',
    'floki', 'brett-based', 'mog-coin', 'popcat', 'book-of-meme'
  ],
  
  'AI Agents': [
    'artificial-superintelligence-alliance', 'virtuals-protocol', 'ai16z', 'goatseus-maximus', 'fartcoin',
    'griffain', 'zerebro', 'ai-rig-complex', 'cookie', 'aixbt'
  ]
};

// Export for use in app.js
window.CONFIG = CONFIG;
window.MOMENTUM_CONFIG = MOMENTUM_CONFIG;
window.SECTOR_COLORS = SECTOR_COLORS;
window.SECTOR_ICONS = SECTOR_ICONS;
window.SECTORS = SECTORS;
