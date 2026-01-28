# Crypto Sectors Dashboard

Real-time crypto market visualization by sector (20 sectors, 173 tokens).

**Live:** https://sectormap.dpdns.org
**Repo:** https://github.com/Sanexxxx777/crypto-dashboard

## Tech Stack
- Express.js server with API proxy + caching
- Vanilla JS (class-based frontend)
- CoinGecko API (server-side, Basic plan)
- Alternative.me API (Fear & Greed Index)
- Google Apps Script for Sheets integration

## Structure
```
crypto-dashboard/
├── server.js           # Express + API proxy + cache + momentum, port 3001
├── GoogleAppsScript.gs # Google Sheets integration (Rating + Portfolio)
├── public/
│   ├── index.html      # SPA entry point
│   ├── config.js       # Sectors, colors, tokens, icons, momentum config
│   ├── app.js          # CryptoDashboard class + i18n + momentum UI
│   └── styles.css      # Dark/light themes + momentum styles
├── data/               # Auto-created data storage
│   ├── snapshots/      # Daily price snapshots (YYYY-MM-DD.json)
│   ├── bull_phases.json # Historical bull phase data
│   └── momentum.json   # Calculated momentum scores
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
# Copy all files
scp -r public server.js package.json poly:/root/crypto-dashboard/

# Or single file update
scp public/app.js poly:/root/crypto-dashboard/public/

# Restart
ssh poly "pm2 restart crypto-dashboard"

# Check logs
ssh poly "pm2 logs crypto-dashboard --lines 20 --nostream"
```

## Features
- 4 views: Overview, Heatmap, All Sectors, **Momentum** (Сила роста)
- 24h/7d/30d period switching
- Search with token preview dropdown
- Quick sectors bar (compact horizontal dashboard)
- Heatmap sorting (market cap, 24h/7d/30d change, name)
- Heatmap text with black outline for visibility
- Collapsible sidebar (icons-only mode)
- Dark/light theme toggle
- Language switcher (RU/EN)
- Token detail modal with CoinGecko links + momentum data
- Fear & Greed Index indicator in header
- Market state indicator (bull/neutral/bear) with SVG icons
- FAQ section in Momentum view

## Momentum Rating System
Historical "rally strength" rating for tokens during bull phases.

**Bull Phase Detection:**
- Start: BTC 24h > +5%
- Continue: BTC 24h > +2%
- End: BTC 24h < +2%

**Momentum Score (0-100):**
```
Score = Beta×0.35 + Consistency×0.25 + Recency×0.20 + AvgGain×0.20
```
- Beta: gain relative to BTC
- Consistency: % of phases in top 20%
- Recency: weighted recent performance
- AvgGain: average absolute gain

**Tiers:** S (90+), A (75+), B (60+), C (45+), D (30+), F (<30)

## API Endpoints
| Endpoint | Description |
|----------|-------------|
| `/api/markets` | Cached token data (173 tokens) |
| `/api/sheets` | Google Sheets optimized data |
| `/api/cache-status` | Cache monitoring |
| `/api/market-state` | Current bull/neutral/bear state |
| `/api/momentum` | Token/sector momentum scores |
| `/api/bull-phases` | Historical bull phase data |
| `/api/fear-greed` | Fear & Greed Index (30min cache) |

## Server Info
- Host: `poly` (185.147.127.126)
- Path: `/root/crypto-dashboard/`
- Process: PM2 (`pm2 restart crypto-dashboard`)
- Tunnel: Cloudflare → sectormap.dpdns.org
- Port: 3001 (internal)

## Important Notes
- Cache TTL: 30 seconds (server + frontend sync)
- CoinGecko demo API key in server.js (rate limited)
- Fear & Greed from Alternative.me (free, no key)
- User preferences in localStorage (theme, lang, sidebar)
- Sorting: sectors and tokens by 24h profitability (descending)
- SVG icons throughout (no emojis)

## Google Sheets Integration
`GoogleAppsScript.gs` — автообновляемая таблица с рейтингами.

**Листы:**
- `Dashboard` — портфель (14 токенов) + обзор секторов
- `Rating` — Alpha Score по всем токенам + рекомендации

**Alpha Score (0-100):**
- Top3: частота в топ-3 сектора
- GreenDays: дни роста
- AvgGain: средняя доходность
- MoonDays: дни +15%+

**Рекомендации:** UNDERVALUED_IN_HOT, BOUNCE_POTENTIAL, MOMENTUM, SLEEPERS

## Version
v2.3.0 (2026-01-28)

### Changelog v2.3.0
- **Google Sheets integration** — GoogleAppsScript.gs with Rating + Portfolio
- **Alpha Score system** — composite token rating (0-100)
- **Recommendations engine** — 4 types of trading signals
- **New tokens**: giza (AI Agents), apex-token-2 (Derivatives)
- **Fixed IDs**: virtual-protocol, maple
- Total tokens: 173 (was 170)

### v2.2.1 (2026-01-27)
- Sorting by profitability: sectors and tokens sorted by 24h change (most profitable first)
- Heatmap default sort: 24h (was mcap)
- Cache/refresh interval: 30 sec (fixed incorrect "5 min" display)
- Donate hint: "Автор всегда открыт к поддержке"

### v2.2.0 (2026-01-23)
- Fear & Greed Index indicator with animated gauge
- Custom SVG icons for market states (rocket/balance/trending-down)
- SVG icons for card titles (trophy, bar-chart, trend-up, question)
- Heatmap text with black outline for better visibility
- FAQ section in Momentum view (4 Q&A items)
- Russian translation for Momentum nav ("Сила роста")
- Fixed card hover animation edge cutoff
- data-i18n attribute support for automatic translations

### v2.1.0 (2026-01-23)
- **Momentum Rating System** - Historical rally performance analysis
- Bull phase detection (BTC 24h based triggers)
- Momentum scores with S/A/B/C/D/F tiers
- New "Momentum" view with top performers, sector rankings, phase history
- Market state indicator in header (bull/neutral/bear)
- Momentum data in token modal
- Price snapshots saved every 30 sec
- Mock data generator for development (12 bull phases)

### v2.0.1 (2026-01-22)
- Fixed JS error: removed references to deleted refreshBtn element

### v2.0.0 (2026-01-21)
- Server-side caching (30 sec TTL, handles 100+ users)
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
