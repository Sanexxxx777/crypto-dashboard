# Crypto Sectors Dashboard

Real-time crypto market visualization by sector (20 sectors, ~170 tokens).

**Live:** https://sectormap.dpdns.org

## Tech Stack
- Express.js server with API proxy + caching
- Vanilla JS (class-based frontend)
- CoinGecko API (server-side)

## Structure
```
crypto-dashboard/
├── server.js           # Express + API proxy + cache, port 3001
├── public/
│   ├── index.html      # SPA entry point
│   ├── config.js       # Sectors, colors, tokens
│   ├── app.js          # CryptoDashboard class + i18n
│   └── styles.css      # Dark/light themes
```

## Run
```bash
npm install
npm start          # Production (port 3001)
npm run dev        # Development with nodemon

# With custom API key:
COINGECKO_API_KEY=your-key npm start
```

## Features
- 3 views: Overview table, Heatmap, All Sectors
- 24h/7d/30d period switching
- Search with token preview dropdown
- Quick sectors bar (compact horizontal dashboard)
- Heatmap sorting (market cap, 24h/7d/30d change, name)
- Collapsible sidebar (icons-only mode)
- Dark/light theme toggle
- Language switcher (RU/EN)
- Token detail modal with CoinGecko links

## API & Caching
- Server-side cache (5 min TTL)
- Pre-fetches all tokens on startup
- Background refresh via setInterval
- `/api/markets` - cached token data
- `/api/cache-status` - cache monitoring
- Handles unlimited concurrent users

## Deploy
Server: `poly` (185.147.127.126)
Path: `/root/crypto-dashboard/`
Process: PM2 (`pm2 restart crypto-dashboard`)
Tunnel: Cloudflare (sectormap.dpdns.org)

## Version
v2.0.0 (2026-01-21)

### Changelog v2.0.0
- Server-side caching (5 min TTL, handles 100+ users)
- Language switcher (Russian/English)
- Collapsible sidebar with state persistence
- Search dropdown with token preview
- Quick sectors bar (horizontal pills)
- Heatmap sector sorting
- Light theme contrast improvements
- Removed refresh button (API limits)
- Fixed horizontal scroll issues

### v1.1.0 (2025-01-20)
- Server-side API proxy for security
- Search functionality
- Rate limit handling (3 retries)
