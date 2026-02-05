# Crypto Sectors Dashboard

Real-time crypto market visualization by sector (20 sectors, 173 tokens).

**Live:** https://sectormap.dpdns.org
**Repo:** https://github.com/Sanexxxx777/crypto-dashboard

## Tech Stack
- Express.js server with API proxy + caching
- Vanilla JS (class-based frontend)
- CoinGecko API (server-side, Basic plan)
- Alternative.me API (Fear & Greed Index)
- Groq API (Llama 3.3 70B) for AI features
- Google Apps Script for Sheets integration

## Structure
```
crypto-dashboard/
├── server.js           # Express + API proxy + cache + momentum + AI, port 3001
├── GoogleAppsScript.gs # Google Sheets integration (Rating + Portfolio)
├── src/
│   └── aiHelper.js     # Groq AI integration (digests, explanations, chat)
├── public/
│   ├── index.html      # SPA entry point
│   ├── config.js       # Sectors, colors, tokens, icons, momentum config
│   ├── app.js          # CryptoDashboard class + i18n + momentum UI
│   ├── styles.css      # Dark/light themes + momentum styles
│   ├── signals.html    # Signal history page
│   └── ai.html         # AI Analyst page (chat + digests)
├── telegram-bot/       # Telegram alerts bot (v3.0 AI-powered)
│   ├── sector_alerts_bot.py  # Main bot with AI digests
│   ├── config.toml     # Config (gitignored)
│   └── state.json      # Cooldowns state
├── data/               # Auto-created data storage
│   ├── snapshots/      # Daily price snapshots (YYYY-MM-DD.json)
│   ├── signals.json    # Signal history
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
# Full deploy (excluding node_modules, .git)
rsync -avz --exclude 'node_modules' --exclude '.git' . trading:~/crypto-dashboard/

# Restart services
ssh trading "pm2 restart crypto-dashboard sector-alerts"

# Check logs
ssh trading "pm2 logs crypto-dashboard --lines 20 --nostream"
ssh trading "pm2 logs sector-alerts --lines 20 --nostream"
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
| `/api/signals` | GET/POST signal history |
| `/api/ai/status` | AI availability check |
| `/api/ai/daily-digest` | POST: AI daily market analysis |
| `/api/ai/weekly-digest` | POST: AI weekly deep analysis |
| `/api/ai/ask` | POST: Ask AI about market |
| `/api/ai/explain` | POST: Explain signal with AI |

## Server Info
- Host: `trading` (45.82.95.142)
- Path: `/root/crypto-dashboard/`
- Process: PM2 (`pm2 restart crypto-dashboard`)
- Telegram bot: PM2 (`pm2 restart sector-alerts`)
- Tunnel: Cloudflare → sectormap.dpdns.org
- Port: 3001 (internal)

## Telegram Alerts Bot v3.0
AI-powered алерты по крипто-секторам:

| Тип | Описание | Cooldown |
|-----|----------|----------|
| **Token Surge/Dump** | Токен ±15% за 24ч | 6ч |
| **Early Breakout** | Flat 7d → рост 24h (ранний сигнал!) | 24ч |
| **Alpha Detection** | Токен обгоняет сектор >10% | 12ч |
| **Sector Rotation** | Деньги входят/выходят из сектора | 12ч |
| **Market State** | Переход bull/bear | — |
| **AI Daily Digest** | Утренний AI-обзор (9:00 UTC) | 24ч |
| **AI Weekly Digest** | Глубокий AI-анализ (пн 9:00) | 7д |

```bash
# Deploy
rsync -avz telegram-bot/ trading:~/crypto-dashboard/telegram-bot/
ssh trading "pm2 restart sector-alerts"
ssh trading "pm2 logs sector-alerts --lines 20 --nostream"
```

## Important Notes
- Cache TTL: 30 seconds (server + frontend sync)
- CoinGecko API key in server.js (Basic plan)
- Fear & Greed from Alternative.me (free, no key)
- Groq API key in `ecosystem.config.js` (gitignored)
- User preferences in localStorage (theme, lang, sidebar)
- Sorting: sectors and tokens by 24h profitability (descending)
- SVG icons throughout (no emojis)

## Environment Variables
| Variable | Description | Location |
|----------|-------------|----------|
| `GROQ_API_KEY` | AI API key (Llama 3.3) | ecosystem.config.js |
| `COINGECKO_API_KEY` | Market data | server.js (hardcoded) |
| `SIGNALS_API_KEY` | Signal write access | server.js |

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
v3.0.0 (2026-02-05)

### Changelog v3.0.0 — AI Integration
- **AI-powered Digests** (Groq Llama 3.3 70B)
  - Daily digest: утренний AI-обзор рынка (9:00 UTC)
  - Weekly digest: глубокий AI-анализ недели (пн 9:00 UTC)
  - Signal explanations: AI объясняет каждый сигнал
- **AI Analyst Page** — `/ai.html`
  - Чат с AI о рынке и секторах
  - Генерация дайджестов по запросу
  - Быстрые вопросы о горячих/холодных секторах
- **Signals History Page** — `/signals.html`
  - История всех сигналов с фильтрацией
  - Статистика по типам сигналов
- **API Endpoints**
  - `POST /api/ai/daily-digest` — генерация дневного дайджеста
  - `POST /api/ai/weekly-digest` — генерация недельного дайджеста
  - `POST /api/ai/ask` — вопрос к AI
  - `POST /api/ai/explain` — объяснение сигнала
  - `GET /api/ai/status` — статус AI
- **Telegram Bot v3.0** — AI-powered alerts
  - AI daily/weekly digests в Telegram
  - Fallback на простые отчёты если AI недоступен

### Changelog v2.4.0
- **Telegram Alerts Bot** — sector_alerts_bot.py
  - Token surge/dump alerts (±15% 24h, 6h cooldown)
  - Sector divergence alerts (>5% vs market, 12h cooldown)
  - Market state change notifications (bull/bear)
  - Daily reports at 9:00 UTC
  - PM2: `sector-alerts`

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
