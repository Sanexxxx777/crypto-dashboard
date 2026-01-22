# Crypto Sectors Dashboard

Real-time crypto market visualization by sector (20 sectors, ~170 tokens).

**Live:** https://sectormap.dpdns.org
**Repo:** https://github.com/Sanexxxx777/crypto-dashboard

## Tech Stack
- Express.js server with API proxy + caching
- Vanilla JS (class-based frontend)
- CoinGecko API (server-side, demo key)

## Structure
```
crypto-dashboard/
├── server.js           # Express + API proxy + cache, port 3001
├── public/
│   ├── index.html      # SPA entry point
│   ├── config.js       # Sectors, colors, tokens, icons
│   ├── app.js          # CryptoDashboard class + i18n
│   └── styles.css      # Dark/light themes
```

## Run Locally
```bash
npm install
npm start              # Production (port 3001)
npm run dev            # Development with nodemon

# With custom API key:
COINGECKO_API_KEY=your-key npm start
```

## Deploy to Server
```bash
# Copy files
scp -r public server.js package.json poly:/root/crypto-dashboard/

# Or single file update
scp public/app.js poly:/root/crypto-dashboard/public/

# Restart
ssh poly "pm2 restart crypto-dashboard"

# Check logs
ssh poly "pm2 logs crypto-dashboard --lines 20 --nostream"
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
- Pre-fetches all 170 tokens on startup
- Background refresh via setInterval
- `/api/markets` - cached token data (single request for all)
- `/api/cache-status` - cache monitoring
- Handles unlimited concurrent users (API called only once per 5 min)

## Server Info
- Host: `poly` (185.147.127.126)
- Path: `/root/crypto-dashboard/`
- Process: PM2 (`pm2 restart crypto-dashboard`)
- Tunnel: Cloudflare → sectormap.dpdns.org
- Port: 3001 (internal)

## Important Notes
- CoinGecko demo API key is in server.js (rate limited)
- Refresh button was removed to prevent API overuse
- All user preferences saved to localStorage (theme, language, sidebar state)
- SECTORS config in config.js defines token groupings

## Version
v2.0.1 (2026-01-22)

### Changelog v2.0.1
- Fixed JS error: removed references to deleted refreshBtn element

### v2.0.0 (2026-01-21)
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
