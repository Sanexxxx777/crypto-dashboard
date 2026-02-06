# Crypto Sectors Alert Bot v4.1

Telegram-бот для мониторинга крипто-секторов. Мультипользовательский.

## Tech Stack
- Python 3.10+, python-telegram-bot 21+, aiohttp, tomli

## Structure
```
telegram-bot/
├── sector_alerts_bot.py   # AlertEngine + SectorAlertsBot
├── user_manager.py        # UserManager (JSON persistence)
├── config.toml            # Config (gitignored)
├── config.example.toml    # Template
├── requirements.txt       # Dependencies
├── state.json             # Cooldowns (gitignored)
├── users.json             # User prefs (gitignored)
└── .gitignore
```

## Commands
| Команда | Описание |
|---------|----------|
| `/start` | Приветствие + гайд |
| `/status` | Обзор рынка (секторы + токены) |
| `/alerts` | Вкл/выкл типы алертов (inline) |
| `/filters` | Фильтры: монеты, мин. %, объём |
| `/settings` | Язык, тихие часы |
| `/test` | Тестовый алерт |
| `/admin` | Админ-панель (ID: 698379097) |
| `/broadcast` | Рассылка всем |

## Alert Types (10)
| Тип | Описание | Кулдаун | Default |
|-----|----------|---------|---------|
| pump | Токен +15% 24ч | 6ч | ON |
| dump | Токен −15% 24ч | 6ч | ON |
| early_breakout | Флэт 7д → рост 24ч | 24ч | ON |
| alpha | Токен vs сектор >10% | 12ч | ON |
| rotation_in | Деньги входят в сектор | 24ч | ON |
| rotation_out | Деньги выходят | 24ч | OFF |
| sector_divergence | Сектор vs рынок | 12ч | OFF |
| market_state | Bull/bear переход | — | ON |
| daily_report | AI-обзор (9:00 UTC) | 24ч | ON |
| weekly_report | AI-анализ (пн 9:00) | 7д | ON |

## Architecture
- **AlertEngine** — проверка алертов, API, кулдауны, дедупликация (MD5)
- **SectorAlertsBot** — команды, рассылка, job_queue
- **UserManager** — JSON, фильтры, quiet hours, alert types

## Deploy
```bash
rsync -avz telegram-bot/ trading:~/crypto-dashboard/telegram-bot/
ssh trading "pm2 restart sector-alerts"
ssh trading "pm2 logs sector-alerts --lines 20 --nostream"
```
