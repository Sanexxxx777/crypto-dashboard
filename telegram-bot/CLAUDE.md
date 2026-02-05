# Crypto Sectors Alert Bot

Telegram бот для алертов по крипто-секторам.

## Алерты

1. **Token Surge/Dump** - токен +15%/-15% за 24ч (cooldown 6ч)
2. **Sector Divergence** - сектор опережает/отстаёт от рынка на >5% (cooldown 12ч)
3. **Market State Change** - переход bull/bear/neutral
4. **Daily Report** - ежедневный отчёт в заданный час UTC

## Tech Stack
- Python 3.10+
- aiohttp (async HTTP)
- tomli (TOML config)

## Files
```
telegram-bot/
├── sector_alerts_bot.py   # Основной код
├── config.toml            # Конфиг (gitignored)
├── config.example.toml    # Пример конфига
├── state.json             # Состояние (cooldowns)
└── CLAUDE.md              # Документация
```

## Setup

```bash
# Установка зависимостей
pip install aiohttp tomli

# Создать конфиг
cp config.example.toml config.toml
# Заполнить bot_token и chat_id

# Тест (один раз)
python3 sector_alerts_bot.py --once

# Запуск
python3 sector_alerts_bot.py
```

## Deploy (server)

```bash
# Rsync
rsync -avz /Users/sasha/Projects/crypto-dashboard/telegram-bot/ trading:~/crypto-dashboard/telegram-bot/

# PM2
ssh trading "cd ~/crypto-dashboard/telegram-bot && pm2 start sector_alerts_bot.py --name sector-alerts --interpreter python3"

# Logs
ssh trading "pm2 logs sector-alerts --lines 50"
```

## Config

| Параметр | Default | Описание |
|----------|---------|----------|
| `token_surge_pct` | 15.0 | Порог роста токена |
| `token_dump_pct` | -15.0 | Порог падения токена |
| `sector_diff_pct` | 5.0 | Порог разницы сектора с рынком |
| `check_interval` | 300 | Интервал проверки (сек) |
| `daily_report_hour` | 9 | Час UTC для отчёта |
| `min_mcap_usd` | 50M | Минимум mcap для алертов |

## API Endpoints (используемые)

- `/api/sheets` - основные данные (токены + секторы)
- `/api/market-state` - состояние рынка (bull/bear)

## State

`state.json` хранит:
- `last_market_state` - последнее состояние рынка
- `last_daily_report` - дата последнего отчёта
- `alerted_tokens` - cooldowns токенов
- `alerted_sectors` - cooldowns секторов
