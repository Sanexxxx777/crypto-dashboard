#!/usr/bin/env python3
"""
Crypto Sectors Alert Bot v4.1
==============================
Telegram-бот для мониторинга крипто-секторов.
Мультипользовательский, с командами, админ-панелью и фильтрами.

Команды:
  /start    — Приветствие + быстрый гайд
  /help     — Список команд
  /status   — Обзор рынка
  /alerts   — Управление алертами
  /settings — Настройки
  /filters  — Фильтры алертов
  /test     — Тестовый алерт

Админ (ID: 698379097):
  /admin      — Админ-панель
  /broadcast  — Рассылка всем

Типы алертов:
  1. pump/dump         — Резкое движение ±15% за 24ч
  2. early_breakout    — Флэт 7д → рост 24ч
  3. alpha             — Токен обгоняет свой сектор
  4. rotation_in/out   — Ротация денег между секторами
  5. sector_divergence — Сектор расходится с рынком
  6. market_state      — Смена фазы bull/bear
  7. daily_report      — AI-обзор утром (9:00 UTC)
  8. weekly_report     — AI-анализ недели (пн 9:00 UTC)
"""

import argparse
import asyncio
import hashlib
import json
import logging
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

try:
    import aiohttp
    import tomli
except ImportError:
    print("Install dependencies: pip install aiohttp tomli")
    sys.exit(1)

try:
    from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
    from telegram.ext import (
        Application, CommandHandler, CallbackQueryHandler,
        ContextTypes, MessageHandler, filters
    )
    HAS_PTB = True
except ImportError:
    HAS_PTB = False
    print("[WARN] python-telegram-bot not installed. Running in send-only mode.")
    print("       Install: pip install python-telegram-bot")

from user_manager import UserManager, ADMIN_ID

# === LOGGING ===
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

# === PATHS ===
SCRIPT_DIR = Path(__file__).parent
CONFIG_FILE = SCRIPT_DIR / "config.toml"
STATE_FILE = SCRIPT_DIR / "state.json"


# === ALERT TYPE LABELS ===

ALERT_LABELS = {
    "pump":               "▲ Памп (+15%)",
    "dump":               "▼ Дамп (−15%)",
    "early_breakout":     "◆ Пробой",
    "alpha":              "★ Альфа-токен",
    "rotation_in":        "↻ Ротация IN",
    "rotation_out":       "↻ Ротация OUT",
    "sector_divergence":  "≠ Дивергенция",
    "market_state":       "◉ Смена фазы",
    "daily_report":       "▸ Дневной отчёт",
    "weekly_report":      "▸ Недельный отчёт",
}


@dataclass
class Config:
    """Bot configuration"""
    bot_token: str = ""
    chat_id: str = ""

    # API
    api_url: str = "https://sectormap.dpdns.org/api/sheets"
    api_key: str = "crypto-dashboard-2024"
    signals_api_url: str = "https://sectormap.dpdns.org/api/signals"
    signals_api_key: str = "sector-alerts-2024"
    ai_api_url: str = "https://sectormap.dpdns.org/api/ai"
    use_ai_digests: bool = True

    # Alert thresholds
    token_surge_pct: float = 15.0
    token_dump_pct: float = -15.0
    breakout_flat_max: float = 5.0
    breakout_surge_min: float = 8.0
    rotation_7d_threshold: float = 3.0
    rotation_24h_threshold: float = 2.0
    alpha_min_pct: float = 10.0
    sector_diff_pct: float = 5.0

    # Timing
    check_interval: int = 300
    daily_report_hour: int = 9
    weekly_report_day: int = 0  # Monday

    # Filters
    min_mcap_usd: float = 50_000_000
    ignore_tokens: list = field(default_factory=list)
    ignore_sectors: list = field(default_factory=list)

    # Bot mode
    bot_enabled: bool = True


@dataclass
class State:
    """Persistent state between runs"""
    last_market_state: str = "neutral"
    last_daily_report: str = ""
    last_weekly_report: str = ""
    alerted_tokens: dict = field(default_factory=dict)
    alerted_sectors: dict = field(default_factory=dict)
    alerted_breakouts: dict = field(default_factory=dict)
    alerted_alphas: dict = field(default_factory=dict)
    alerted_rotations: dict = field(default_factory=dict)
    total_alerts_sent: int = 0


def load_config() -> Config:
    if not CONFIG_FILE.exists():
        logger.error(f"Config not found: {CONFIG_FILE}")
        sys.exit(1)

    with open(CONFIG_FILE, "rb") as f:
        data = tomli.load(f)

    cfg = Config()
    tg = data.get("telegram", {})
    cfg.bot_token = tg.get("bot_token", "")
    cfg.chat_id = str(tg.get("chat_id", ""))

    api = data.get("api", {})
    cfg.api_url = api.get("url", cfg.api_url)
    cfg.api_key = api.get("key", cfg.api_key)

    alerts = data.get("alerts", {})
    for key in ["token_surge_pct", "token_dump_pct", "breakout_flat_max",
                "breakout_surge_min", "rotation_7d_threshold", "rotation_24h_threshold",
                "alpha_min_pct", "sector_diff_pct"]:
        if key in alerts:
            setattr(cfg, key, alerts[key])

    timing = data.get("timing", {})
    cfg.check_interval = timing.get("check_interval", cfg.check_interval)
    cfg.daily_report_hour = timing.get("daily_report_hour", cfg.daily_report_hour)
    cfg.weekly_report_day = timing.get("weekly_report_day", cfg.weekly_report_day)

    filters_cfg = data.get("filters", {})
    cfg.min_mcap_usd = filters_cfg.get("min_mcap_usd", cfg.min_mcap_usd)
    cfg.ignore_tokens = filters_cfg.get("ignore_tokens", [])
    cfg.ignore_sectors = filters_cfg.get("ignore_sectors", [])

    return cfg


def load_state() -> State:
    if STATE_FILE.exists():
        try:
            data = json.loads(STATE_FILE.read_text())
            state = State()
            for key in ["last_market_state", "last_daily_report", "last_weekly_report",
                        "alerted_tokens", "alerted_sectors", "alerted_breakouts",
                        "alerted_alphas", "alerted_rotations", "total_alerts_sent"]:
                if key in data:
                    setattr(state, key, data[key])
            return state
        except Exception as e:
            logger.warning(f"Error loading state: {e}")
    return State()


def save_state(state: State):
    data = {
        "last_market_state": state.last_market_state,
        "last_daily_report": state.last_daily_report,
        "last_weekly_report": state.last_weekly_report,
        "alerted_tokens": state.alerted_tokens,
        "alerted_sectors": state.alerted_sectors,
        "alerted_breakouts": state.alerted_breakouts,
        "alerted_alphas": state.alerted_alphas,
        "alerted_rotations": state.alerted_rotations,
        "total_alerts_sent": state.total_alerts_sent,
    }
    STATE_FILE.write_text(json.dumps(data, indent=2))


# ==================== HELPERS ====================

def fmt_price(price: float) -> str:
    """Format price smartly."""
    if price >= 1:
        return f"${price:,.2f}"
    elif price >= 0.01:
        return f"${price:.4f}"
    else:
        return f"${price:.6f}"


def fmt_mcap(mcap: float) -> str:
    """Format market cap."""
    if mcap >= 1e9:
        return f"${mcap/1e9:.1f}B"
    return f"${mcap/1e6:.0f}M"


def fmt_change(val: float) -> str:
    """Format change with sign."""
    return f"+{val:.1f}%" if val > 0 else f"{val:.1f}%"


# ==================== ADMIN DECORATOR ====================

def admin_only(func):
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.effective_user.id != ADMIN_ID:
            await update.message.reply_text("⛔ Доступ запрещён")
            return
        return await func(update, context)
    return wrapper


# ==================== ALERT ENGINE ====================

class AlertEngine:
    """Ядро проверки алертов (независимо от Telegram)."""

    def __init__(self, config: Config, state: State):
        self.config = config
        self.state = state
        self.session: Optional[aiohttp.ClientSession] = None
        self.sector_tokens_map: dict = {}
        self._sent_hashes: dict = {}

    async def start(self):
        self.session = aiohttp.ClientSession()

    async def stop(self):
        if self.session:
            await self.session.close()

    def _dedup_check(self, text: str) -> bool:
        msg_hash = hashlib.md5(text.encode()).hexdigest()[:12]
        now = datetime.now(timezone.utc)
        if msg_hash in self._sent_hashes:
            last_sent = self._sent_hashes[msg_hash]
            if (now - last_sent).total_seconds() < 3600:
                return True
        self._sent_hashes[msg_hash] = now
        if len(self._sent_hashes) > 500:
            cutoff = now.timestamp() - 7200
            self._sent_hashes = {
                k: v for k, v in self._sent_hashes.items()
                if v.timestamp() > cutoff
            }
        return False

    async def save_signal(self, signal_data: dict) -> bool:
        url = f"{self.config.signals_api_url}?key={self.config.signals_api_key}"
        try:
            async with self.session.post(url, json=signal_data, timeout=10) as resp:
                return resp.status == 200
        except Exception as e:
            logger.warning(f"Signal save error: {e}")
            return False

    async def fetch_data(self) -> Optional[dict]:
        url = f"{self.config.api_url}?key={self.config.api_key}"
        try:
            async with self.session.get(url, timeout=30) as resp:
                if resp.status == 200:
                    return await resp.json()
                logger.error(f"API error {resp.status}")
                return None
        except Exception as e:
            logger.error(f"API exception: {e}")
            return None

    async def fetch_market_state(self) -> Optional[dict]:
        url = self.config.api_url.replace("/sheets", "/market-state")
        try:
            async with self.session.get(url, timeout=10) as resp:
                if resp.status == 200:
                    return await resp.json()
                return None
        except Exception:
            return None

    async def fetch_momentum(self) -> Optional[dict]:
        url = self.config.api_url.replace("/sheets", "/momentum")
        try:
            async with self.session.get(url, timeout=10) as resp:
                if resp.status == 200:
                    return await resp.json()
                return None
        except Exception:
            return None

    async def fetch_ai_digest(self, digest_type: str = "daily") -> Optional[str]:
        if not self.config.use_ai_digests:
            return None
        endpoint = "daily-digest" if digest_type == "daily" else "weekly-digest"
        url = f"{self.config.ai_api_url}/{endpoint}"
        try:
            async with self.session.post(url, json={}, timeout=60) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("success"):
                        return data.get("digest")
                return None
        except Exception as e:
            logger.warning(f"AI digest error: {e}")
            return None

    def _cooldown_check(self, cache: dict, key: str, hours: float) -> bool:
        last = cache.get(key)
        if not last:
            return True
        try:
            last_ts = datetime.fromisoformat(last)
            now = datetime.now(timezone.utc)
            return (now - last_ts).total_seconds() / 3600 >= hours
        except Exception:
            return True

    def _mark_alerted(self, cache: dict, key: str):
        cache[key] = datetime.now(timezone.utc).isoformat()

    def _get_token_sector(self, token_id: str) -> Optional[str]:
        for sector, tokens in self.sector_tokens_map.items():
            if token_id in tokens:
                return sector
        return None

    async def check_alerts(self) -> list[dict]:
        results = []

        data = await self.fetch_data()
        if not data or not data.get("success"):
            logger.warning("Failed to fetch data")
            return results

        tokens = data.get("data", {})
        sectors = data.get("sectors", {})
        self.sector_tokens_map = data.get("sectorTokens", {})

        all_changes = [t.get("change_24h") for t in tokens.values() if t.get("change_24h") is not None]
        market_avg_24h = sum(all_changes) / len(all_changes) if all_changes else 0

        results.extend(await self._check_token_surges(tokens))
        results.extend(await self._check_early_breakouts(tokens))
        results.extend(await self._check_alpha_tokens(tokens, sectors))
        results.extend(await self._check_sector_rotation(sectors))
        results.extend(self._check_sector_divergence(sectors, market_avg_24h))

        market_alert = await self._check_market_state_change()
        if market_alert:
            results.append(market_alert)

        daily = await self._check_daily_report(sectors, tokens)
        if daily:
            results.append(daily)

        weekly = await self._check_weekly_report(sectors, tokens)
        if weekly:
            results.append(weekly)

        return results

    async def get_market_status(self) -> str:
        """Сводка для команды /status."""
        data = await self.fetch_data()
        if not data or not data.get("success"):
            return "○ Не удалось загрузить данные"

        tokens = data.get("data", {})
        sectors = data.get("sectors", {})
        market_state = await self.fetch_market_state()

        state_name = (market_state or {}).get("state", "neutral")
        btc_24h = (market_state or {}).get("btc24h", 0)
        state_emoji = {"bull": "◉", "bear": "◉", "neutral": "◎"}.get(state_name, "◎")
        state_ru = {"bull": "Бычий", "bear": "Медвежий", "neutral": "Нейтральный"}.get(state_name, "Нейтральный")

        # Top 5 sectors
        sorted_sectors = sorted(sectors.items(), key=lambda x: x[1].get("avg24h", 0), reverse=True)
        top_sectors = []
        for name, s in sorted_sectors[:5]:
            avg = s.get("avg24h", 0)
            icon = "▲" if avg > 0 else "▼"
            top_sectors.append(f"  {icon} {name}: {fmt_change(avg)}")

        worst_sectors = []
        for name, s in sorted_sectors[-3:]:
            avg = s.get("avg24h", 0)
            icon = "▲" if avg > 0 else "▼"
            worst_sectors.append(f"  {icon} {name}: {fmt_change(avg)}")

        # Top 5 tokens
        sorted_tokens = sorted(
            [(k, v) for k, v in tokens.items() if v.get("change_24h") is not None],
            key=lambda x: x[1].get("change_24h", 0),
            reverse=True
        )
        top_tokens = []
        for k, t in sorted_tokens[:5]:
            sym = t.get("symbol", k.upper())
            ch = t.get("change_24h", 0)
            top_tokens.append(f"  ▲ {sym}: {fmt_change(ch)}")

        worst_tokens = []
        for k, t in sorted_tokens[-3:]:
            sym = t.get("symbol", k.upper())
            ch = t.get("change_24h", 0)
            worst_tokens.append(f"  ▼ {sym}: {fmt_change(ch)}")

        return (
            f"{state_emoji} <b>Рынок: {state_ru}</b>\n"
            f"BTC 24ч: <b>{fmt_change(btc_24h)}</b>\n"
            f"\n"
            f"▲ <b>Топ-5 секторов (24ч):</b>\n" + "\n".join(top_sectors) +
            f"\n\n▼ <b>Худшие 3:</b>\n" + "\n".join(worst_sectors) +
            f"\n\n★ <b>Топ-5 токенов:</b>\n" + "\n".join(top_tokens) +
            f"\n\n▼ <b>Худшие 3:</b>\n" + "\n".join(worst_tokens)
        )

    # --- Alert checks ---

    async def _check_token_surges(self, tokens: dict) -> list[dict]:
        results = []
        cfg = self.config
        for token_id, token in tokens.items():
            if token_id in cfg.ignore_tokens:
                continue
            mcap = token.get("market_cap") or 0
            if mcap < cfg.min_mcap_usd:
                continue
            change_24h = token.get("change_24h")
            if change_24h is None:
                continue
            if not self._cooldown_check(self.state.alerted_tokens, token_id, 6):
                continue

            symbol = token.get("symbol", token_id.upper())
            name = token.get("name", symbol)
            price = token.get("price", 0)
            sector = self._get_token_sector(token_id)
            sector_str = f" · {sector}" if sector else ""

            if change_24h >= cfg.token_surge_pct:
                msg = (
                    f"▲ <b>{symbol} {fmt_change(change_24h)}</b>{sector_str}\n"
                    f"├ Цена: {fmt_price(price)}\n"
                    f"├ Капитал: {fmt_mcap(mcap)}\n"
                    f"└ {name}"
                )
                meta = {"token": symbol, "change_pct": change_24h, "mcap": mcap}
                results.append({"type": "pump", "message": msg, "meta": meta})
                self._mark_alerted(self.state.alerted_tokens, token_id)
                await self.save_signal({"type": "TOKEN_SURGE", "token": symbol, "sector": sector,
                                        "change_24h": change_24h, "price": price, "mcap": mcap,
                                        "reason": f"+{change_24h:.1f}% за 24ч"})

            elif change_24h <= cfg.token_dump_pct:
                msg = (
                    f"▼ <b>{symbol} {fmt_change(change_24h)}</b>{sector_str}\n"
                    f"├ Цена: {fmt_price(price)}\n"
                    f"├ Капитал: {fmt_mcap(mcap)}\n"
                    f"└ {name}"
                )
                meta = {"token": symbol, "change_pct": change_24h, "mcap": mcap}
                results.append({"type": "dump", "message": msg, "meta": meta})
                self._mark_alerted(self.state.alerted_tokens, token_id)
                await self.save_signal({"type": "TOKEN_DUMP", "token": symbol, "sector": sector,
                                        "change_24h": change_24h, "price": price, "mcap": mcap,
                                        "reason": f"{change_24h:.1f}% за 24ч"})

        return results

    async def _check_early_breakouts(self, tokens: dict) -> list[dict]:
        results = []
        cfg = self.config
        for token_id, token in tokens.items():
            if token_id in cfg.ignore_tokens:
                continue
            mcap = token.get("market_cap") or 0
            if mcap < cfg.min_mcap_usd:
                continue
            change_24h = token.get("change_24h")
            change_7d = token.get("change_7d")
            if change_24h is None or change_7d is None:
                continue

            change_7d_before = change_7d - change_24h
            was_flat = abs(change_7d_before) <= cfg.breakout_flat_max
            is_surging = change_24h >= cfg.breakout_surge_min

            if was_flat and is_surging:
                if not self._cooldown_check(self.state.alerted_breakouts, token_id, 24):
                    continue
                symbol = token.get("symbol", token_id.upper())
                sector = self._get_token_sector(token_id)
                sector_str = f" · {sector}" if sector else ""
                price = token.get("price", 0)
                msg = (
                    f"◆ <b>ПРОБОЙ: {symbol}</b>{sector_str}\n"
                    f"├ 24ч: <b>{fmt_change(change_24h)}</b>\n"
                    f"├ 7д до: {fmt_change(change_7d_before)} (был флэт)\n"
                    f"├ Цена: {fmt_price(price)}\n"
                    f"└ Капитал: {fmt_mcap(mcap)}"
                )
                meta = {"token": symbol, "change_pct": change_24h, "mcap": mcap}
                results.append({"type": "early_breakout", "message": msg, "meta": meta})
                self._mark_alerted(self.state.alerted_breakouts, token_id)
                await self.save_signal({"type": "EARLY_BREAKOUT", "token": symbol, "sector": sector,
                                        "change_24h": change_24h, "change_7d": change_7d,
                                        "price": price, "mcap": mcap,
                                        "reason": f"Флэт {fmt_change(change_7d_before)} 7д → {fmt_change(change_24h)} 24ч"})

        return results

    async def _check_alpha_tokens(self, tokens: dict, sectors: dict) -> list[dict]:
        results = []
        cfg = self.config
        for token_id, token in tokens.items():
            if token_id in cfg.ignore_tokens:
                continue
            mcap = token.get("market_cap") or 0
            if mcap < cfg.min_mcap_usd:
                continue
            change_24h = token.get("change_24h")
            if change_24h is None or change_24h < 5:
                continue

            sector_name = self._get_token_sector(token_id)
            if not sector_name or sector_name in cfg.ignore_sectors:
                continue
            sector = sectors.get(sector_name, {})
            sector_avg = sector.get("avg24h", 0)
            alpha = change_24h - sector_avg

            if alpha >= cfg.alpha_min_pct:
                if not self._cooldown_check(self.state.alerted_alphas, token_id, 12):
                    continue
                symbol = token.get("symbol", token_id.upper())
                price = token.get("price", 0)
                msg = (
                    f"★ <b>АЛЬФА: {symbol}</b> в {sector_name}\n"
                    f"├ Токен: <b>{fmt_change(change_24h)}</b>\n"
                    f"├ Сектор: {fmt_change(sector_avg)}\n"
                    f"├ Альфа: <b>{fmt_change(alpha)}</b>\n"
                    f"└ {fmt_price(price)} · {fmt_mcap(mcap)}"
                )
                meta = {"token": symbol, "change_pct": change_24h, "mcap": mcap}
                results.append({"type": "alpha", "message": msg, "meta": meta})
                self._mark_alerted(self.state.alerted_alphas, token_id)
                await self.save_signal({"type": "ALPHA", "token": symbol, "sector": sector_name,
                                        "change_24h": change_24h, "sector_avg": sector_avg,
                                        "alpha": alpha, "price": price, "mcap": mcap,
                                        "reason": f"Токен {fmt_change(change_24h)}, сектор {fmt_change(sector_avg)}"})

        return results

    async def _check_sector_rotation(self, sectors: dict) -> list[dict]:
        results = []
        cfg = self.config
        for sector_name, sector in sectors.items():
            if sector_name in cfg.ignore_sectors:
                continue
            avg_24h = sector.get("avg24h", 0)
            avg_7d = sector.get("avg7d", 0)

            rotation_in = avg_7d <= -cfg.rotation_7d_threshold and avg_24h >= cfg.rotation_24h_threshold
            rotation_out = avg_7d >= cfg.rotation_7d_threshold and avg_24h <= -cfg.rotation_24h_threshold

            if rotation_in or rotation_out:
                key = f"{sector_name}_rotation"
                if not self._cooldown_check(self.state.alerted_rotations, key, 24):
                    continue

                if rotation_in:
                    best = sector.get("best")
                    best_str = f"{best['symbol']} {fmt_change(best['value'])}" if best else "—"
                    msg = (
                        f"↻ <b>РОТАЦИЯ — ВХОД:</b> {sector_name}\n"
                        f"├ 7д: {fmt_change(avg_7d)} (был слабый)\n"
                        f"├ 24ч: <b>{fmt_change(avg_24h)}</b> (разворот!)\n"
                        f"└ Лидер: {best_str}"
                    )
                    signal_type = "rotation_in"
                else:
                    msg = (
                        f"↻ <b>РОТАЦИЯ — ВЫХОД:</b> {sector_name}\n"
                        f"├ 7д: {fmt_change(avg_7d)} (был сильный)\n"
                        f"├ 24ч: <b>{fmt_change(avg_24h)}</b> (разворот!)\n"
                        f"└ Деньги уходят из сектора"
                    )
                    signal_type = "rotation_out"

                results.append({"type": signal_type, "message": msg})
                self._mark_alerted(self.state.alerted_rotations, key)
                await self.save_signal({"type": signal_type.upper(), "sector": sector_name,
                                        "change_24h": avg_24h, "change_7d": avg_7d,
                                        "reason": f"7д: {fmt_change(avg_7d)}, 24ч: {fmt_change(avg_24h)}"})

        return results

    def _check_sector_divergence(self, sectors: dict, market_avg: float) -> list[dict]:
        results = []
        cfg = self.config
        for sector_name, sector in sectors.items():
            if sector_name in cfg.ignore_sectors:
                continue
            if not self._cooldown_check(self.state.alerted_sectors, sector_name, 12):
                continue
            avg_24h = sector.get("avg24h", 0)
            diff = avg_24h - market_avg

            if diff >= cfg.sector_diff_pct:
                best = sector.get("best")
                best_str = f"{best['symbol']} {fmt_change(best['value'])}" if best else "—"
                msg = (
                    f"◈ <b>{sector_name}</b> обгоняет рынок\n"
                    f"├ Сектор: {fmt_change(avg_24h)}\n"
                    f"├ Рынок: {fmt_change(market_avg)}\n"
                    f"├ Разница: <b>{fmt_change(diff)}</b>\n"
                    f"└ Лидер: {best_str}"
                )
                results.append({"type": "sector_divergence", "message": msg})
                self._mark_alerted(self.state.alerted_sectors, sector_name)
            elif diff <= -cfg.sector_diff_pct:
                msg = (
                    f"◈ <b>{sector_name}</b> отстаёт от рынка\n"
                    f"├ Сектор: {fmt_change(avg_24h)}\n"
                    f"├ Рынок: {fmt_change(market_avg)}\n"
                    f"└ Разница: <b>{fmt_change(diff)}</b>"
                )
                results.append({"type": "sector_divergence", "message": msg})
                self._mark_alerted(self.state.alerted_sectors, sector_name)

        return results

    async def _check_market_state_change(self) -> Optional[dict]:
        market = await self.fetch_market_state()
        if not market:
            return None
        new_state = market.get("state", "neutral")
        btc_24h = market.get("btc24h", 0)
        btc_price = market.get("btcPrice", 0)
        old_state = self.state.last_market_state

        if new_state != old_state:
            self.state.last_market_state = new_state
            if new_state == "bull" and old_state != "bull":
                momentum = await self.fetch_momentum()
                leaders_str = ""
                if momentum:
                    top = momentum.get("tokens", [])[:5]
                    if top:
                        leaders = [f"{t['symbol']} ({t['tier']})" for t in top]
                        leaders_str = f"\n\n★ <b>Лидеры моментума:</b>\n" + ", ".join(leaders)
                msg = (
                    f"◉ <b>БЫЧЬЯ ФАЗА НАЧАЛАСЬ</b>\n"
                    f"├ BTC: {fmt_price(btc_price)}\n"
                    f"└ 24ч: <b>{fmt_change(btc_24h)}</b>{leaders_str}"
                )
                return {"type": "market_state", "message": msg}
            elif new_state == "bear" and old_state != "bear":
                msg = (
                    f"◉ <b>МЕДВЕЖЬЯ ФАЗА НАЧАЛАСЬ</b>\n"
                    f"├ BTC: {fmt_price(btc_price)}\n"
                    f"└ 24ч: <b>{fmt_change(btc_24h)}</b>"
                )
                return {"type": "market_state", "message": msg}
            elif new_state == "neutral" and old_state == "bull":
                msg = (
                    f"◎ <b>Бычья фаза завершена</b>\n"
                    f"├ BTC: {fmt_price(btc_price)}\n"
                    f"└ 24ч: {fmt_change(btc_24h)}"
                )
                return {"type": "market_state", "message": msg}
        return None

    async def _check_daily_report(self, sectors: dict, tokens: dict) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        today = now.strftime("%Y-%m-%d")
        if now.hour != self.config.daily_report_hour:
            return None
        if self.state.last_daily_report == today:
            return None
        self.state.last_daily_report = today

        ai_digest = await self.fetch_ai_digest("daily")
        if ai_digest:
            return {"type": "daily_report", "message": f"▸ <b>AI-обзор дня</b>\n\n{ai_digest}"}

        # Fallback
        sorted_sectors = sorted(sectors.items(), key=lambda x: x[1].get("avg24h", 0), reverse=True)
        top = []
        for n, s in sorted_sectors[:5]:
            avg = s.get("avg24h", 0)
            icon = "▲" if avg > 0 else "▼"
            top.append(f"  {icon} {n}: {fmt_change(avg)}")

        bottom = []
        for n, s in sorted_sectors[-3:]:
            avg = s.get("avg24h", 0)
            bottom.append(f"  ▼ {n}: {fmt_change(avg)}")

        sorted_tokens = sorted(
            [(k, v) for k, v in tokens.items() if v.get("change_24h") is not None],
            key=lambda x: x[1].get("change_24h", 0), reverse=True
        )
        top_t = []
        for k, t in sorted_tokens[:5]:
            sym = t.get("symbol", k.upper())
            ch = t.get("change_24h", 0)
            top_t.append(f"  ▲ {sym}: {fmt_change(ch)}")

        msg = (
            f"▸ <b>Дневной отчёт</b>\n<i>{today}</i>\n\n"
            f"▲ <b>Топ-5 секторов:</b>\n" + "\n".join(top) +
            f"\n\n▼ <b>Худшие 3:</b>\n" + "\n".join(bottom) +
            f"\n\n★ <b>Топ-5 токенов:</b>\n" + "\n".join(top_t)
        )
        return {"type": "daily_report", "message": msg}

    async def _check_weekly_report(self, sectors: dict, tokens: dict) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        week = now.strftime("%Y-W%W")
        if now.weekday() != self.config.weekly_report_day:
            return None
        if now.hour != self.config.daily_report_hour:
            return None
        if self.state.last_weekly_report == week:
            return None
        self.state.last_weekly_report = week

        ai_digest = await self.fetch_ai_digest("weekly")
        if ai_digest:
            return {"type": "weekly_report", "message": f"▸ <b>AI-анализ недели</b>\n\n{ai_digest}"}

        sorted_sectors = sorted(sectors.items(), key=lambda x: x[1].get("avg7d", 0), reverse=True)
        lines = []
        for name, s in sorted_sectors[:10]:
            avg_7d = s.get("avg7d", 0)
            avg_30d = s.get("avg30d", 0)
            trend = "↑" if avg_7d > avg_30d else "↓"
            icon = "▲" if avg_7d > 0 else "▼"
            lines.append(f"  {icon} {name}: {fmt_change(avg_7d)} {trend}")

        msg = (
            f"▸ <b>Недельный отчёт</b>\n<i>{week}</i>\n\n"
            f"<b>7д по секторам (↑ растёт, ↓ падает):</b>\n" +
            "\n".join(lines)
        )
        return {"type": "weekly_report", "message": msg}


# ==================== BOT COMMANDS ====================

class SectorAlertsBot:
    """Telegram-бот: команды, алерт-лупа, рассылка."""

    def __init__(self, config: Config, state: State):
        self.config = config
        self.state = state
        self.engine = AlertEngine(config, state)
        self.users = UserManager()
        self.app: Optional[Application] = None

    async def send_to_user(self, user_id: int, text: str, parse_mode: str = "HTML") -> bool:
        if not self.app:
            return False
        try:
            await self.app.bot.send_message(
                chat_id=user_id,
                text=text,
                parse_mode=parse_mode,
                disable_web_page_preview=True
            )
            return True
        except Exception as e:
            logger.error(f"Send to {user_id} failed: {e}")
            return False

    async def broadcast(self, text: str, alert_type: str = None, alert_meta: dict = None):
        for uid in self.users.get_active_users():
            user_id = int(uid)
            if alert_type and not self.users.should_send_alert(user_id, alert_type):
                continue
            if alert_meta and not self.users.matches_filters(user_id, alert_meta):
                continue
            await self.send_to_user(user_id, text)
            await asyncio.sleep(0.05)

    # --- Commands ---

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        self.users.register_user(user.id, user.username or "", user.first_name or "")

        text = (
            "◉ <b>Crypto Sectors Bot</b>\n\n"
            "Мониторинг 20 секторов и 173 токенов.\n"
            "Алерты о пампах, дампах, ротациях и альфе.\n\n"
            "Все алерты включены по умолчанию.\n"
            "Настрой через /alerts и /filters."
        )
        keyboard = [
            [
                InlineKeyboardButton("◈ Обзор рынка", callback_data="cmd_status"),
                InlineKeyboardButton("◉ Алерты", callback_data="cmd_alerts"),
            ],
            [
                InlineKeyboardButton("◎ Фильтры", callback_data="cmd_filters"),
                InlineKeyboardButton("⟐ Настройки", callback_data="cmd_settings"),
            ],
            [
                InlineKeyboardButton("▷ Тест", callback_data="cmd_test"),
                InlineKeyboardButton("› Справка", callback_data="cmd_help"),
            ],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(text, reply_markup=reply_markup, parse_mode="HTML")

    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        text = (
            "› <b>Справка</b>\n\n"
            "<b>Команды:</b>\n"
            "  /start    — Приветствие\n"
            "  /status   — Обзор рынка (секторы + токены)\n"
            "  /alerts   — Вкл/выкл типы алертов\n"
            "  /filters  — Фильтры по монетам и %\n"
            "  /settings — Язык, тихие часы\n"
            "  /test     — Тестовый алерт\n\n"
            "<b>Типы алертов:</b>\n"
            "  ▲ Памп — токен +15% за 24ч\n"
            "  ▼ Дамп — токен −15% за 24ч\n"
            "  ◆ Пробой — флэт 7д, рост 24ч\n"
            "  ★ Альфа — токен обгоняет сектор >10%\n"
            "  ↻ Ротация — деньги входят/выходят\n"
            "  ◈ Дивергенция — сектор vs рынок\n"
            "  ◉ Смена фазы — bull/bear переход\n"
            "  ▸ Отчёты — AI-обзоры утром\n\n"
            "→ Дашборд: sectormap.dpdns.org"
        )
        if self.users.is_admin(update.effective_user.id):
            text += (
                "\n\n<b>★ Админ:</b>\n"
                "  /admin — Панель управления\n"
                "  /broadcast &lt;текст&gt; — Рассылка"
            )
        await update.message.reply_text(text, parse_mode="HTML")

    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        if not self.users.is_registered(user.id):
            self.users.register_user(user.id, user.username or "", user.first_name or "")

        await update.message.reply_text("⏳ Загрузка данных...")
        status = await self.engine.get_market_status()
        await update.message.reply_text(status, parse_mode="HTML")

    async def cmd_alerts(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        if not self.users.is_registered(user.id):
            self.users.register_user(user.id, user.username or "", user.first_name or "")

        user_data = self.users.get_user(user.id)
        alert_types = user_data.get("alert_types", {})

        keyboard = []
        for key, label in ALERT_LABELS.items():
            enabled = alert_types.get(key, True)
            status = "●" if enabled else "○"
            keyboard.append([InlineKeyboardButton(
                f"{status} {label}",
                callback_data=f"alert_toggle:{key}"
            )])

        all_enabled = user_data.get("alerts_enabled", True)
        keyboard.append([InlineKeyboardButton(
            f"{'◉ ВСЕ ВКЛЮЧЕНЫ' if all_enabled else '○ ВСЕ ВЫКЛЮЧЕНЫ'}",
            callback_data="alert_toggle_all"
        )])
        keyboard.append([InlineKeyboardButton("← Назад", callback_data="cmd_back")])

        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            "◉ <b>Настройки алертов</b>\nНажми, чтобы переключить:",
            reply_markup=reply_markup,
            parse_mode="HTML"
        )

    async def cmd_settings(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        if not self.users.is_registered(user.id):
            self.users.register_user(user.id, user.username or "", user.first_name or "")

        user_data = self.users.get_user(user.id)
        quiet = user_data.get("quiet_hours", {})
        lang = user_data.get("language", "ru")
        alerts_enabled = user_data.get("alerts_enabled", True)

        lang_name = "RU Русский" if lang == "ru" else "EN English"
        quiet_status = "Вкл" if quiet.get("enabled") else "Выкл"
        quiet_range = f" ({quiet.get('start','23:00')}–{quiet.get('end','07:00')} UTC)" if quiet.get("enabled") else ""

        text = (
            f"⟐ <b>Настройки</b>\n\n"
            f"◉ Алерты: <b>{'Включены' if alerts_enabled else 'Выключены'}</b>\n"
            f"⟐ Язык: <b>{lang_name}</b>\n"
            f"◑ Тихие часы: <b>{quiet_status}</b>{quiet_range}"
        )

        keyboard = [
            [InlineKeyboardButton(
                f"⟐ {lang_name}",
                callback_data="settings_lang"
            )],
            [InlineKeyboardButton(
                f"◑ Тихие часы: {quiet_status}",
                callback_data="settings_quiet"
            )],
            [InlineKeyboardButton("← Назад", callback_data="cmd_back")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(text, reply_markup=reply_markup, parse_mode="HTML")

    async def cmd_filters(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        if not self.users.is_registered(user.id):
            self.users.register_user(user.id, user.username or "", user.first_name or "")

        args = context.args or []

        # /filters set <param> <value>
        if len(args) >= 3 and args[0] == "set":
            param = args[1]
            value_str = " ".join(args[2:])

            valid_params = {
                "min_change_pct": ("number", "Мин. изменение %"),
                "min_volume_usd": ("number", "Мин. объём $"),
                "coins": ("list", "Вайтлист монет"),
                "blacklist_coins": ("list", "Блэклист монет"),
            }

            if param not in valid_params:
                await update.message.reply_text(
                    f"○ Неизвестный фильтр: <b>{param}</b>\n\n"
                    f"Доступные: {', '.join(valid_params.keys())}",
                    parse_mode="HTML"
                )
                return

            ptype, pname = valid_params[param]
            if ptype == "number":
                try:
                    value = float(value_str)
                except ValueError:
                    await update.message.reply_text(f"○ Неверное число: {value_str}")
                    return
            else:
                if value_str.lower() in ("none", "clear", "all", ""):
                    value = []
                else:
                    value = [c.strip().upper() for c in value_str.split(",")]

            self.users.set_filter(user.id, param, value)
            display_val = value if isinstance(value, list) else f"{value}"
            await update.message.reply_text(
                f"● <b>{pname}</b> → <b>{display_val}</b>",
                parse_mode="HTML"
            )
            return

        # /filters reset
        if args and args[0] == "reset":
            for param in ["min_change_pct", "min_volume_usd", "coins", "blacklist_coins"]:
                default = 0 if param.startswith("min_") else []
                self.users.set_filter(user.id, param, default)
            await update.message.reply_text("● Фильтры сброшены")
            return

        # /filters (show current)
        user_data = self.users.get_user(user.id)
        f = user_data.get("filters", {})

        coins_str = ", ".join(f.get("coins", [])) or "все"
        black_str = ", ".join(f.get("blacklist_coins", [])) or "нет"
        min_ch = f.get("min_change_pct", 0)
        min_vol = f.get("min_volume_usd", 0)

        text = (
            f"◎ <b>Фильтры алертов</b>\n\n"
            f"◈ Мин. изменение: <b>{min_ch}%</b>\n"
            f"▸ Мин. объём: <b>${min_vol:,.0f}</b>\n"
            f"● Вайтлист: <b>{coins_str}</b>\n"
            f"○ Блэклист: <b>{black_str}</b>\n\n"
            f"<b>Примеры:</b>\n"
            f"<code>/filters set min_change_pct 5</code>\n"
            f"<code>/filters set coins BTC,ETH,SOL</code>\n"
            f"<code>/filters set blacklist_coins DOGE,SHIB</code>\n"
            f"<code>/filters set coins clear</code>\n"
            f"<code>/filters reset</code>"
        )
        await update.message.reply_text(text, parse_mode="HTML")

    async def cmd_test(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        if not self.users.is_registered(user.id):
            self.users.register_user(user.id, user.username or "", user.first_name or "")

        test_msg = (
            "▷ <b>Тестовый алерт</b>\n\n"
            "▲ <b>BONK +18.5%</b> · Memes\n"
            "├ Цена: $0.00002145\n"
            "├ Капитал: $1.2B\n"
            "└ Bonk\n\n"
            "● Бот работает, алерты будут приходить!"
        )
        await update.message.reply_text(test_msg, parse_mode="HTML")

    @admin_only
    async def cmd_admin(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        stats = self.users.get_stats()
        text = (
            f"★ <b>Админ-панель</b>\n\n"
            f"▸ Пользователей: {stats['total']} (активных: {stats['active']})\n"
            f"▸ Алертов отправлено: {self.state.total_alerts_sent}\n"
            f"▸ Бот: {'включён' if self.config.bot_enabled else 'выключен'}"
        )
        keyboard = [
            [InlineKeyboardButton("▸ Пользователи", callback_data="admin_users")],
            [InlineKeyboardButton(
                f"▸ Бот: {'ВКЛ' if self.config.bot_enabled else 'ВЫКЛ'}",
                callback_data="admin_toggle_bot"
            )],
            [InlineKeyboardButton("▸ Тест рассылки", callback_data="admin_test_broadcast")],
            [InlineKeyboardButton("◈ Статистика", callback_data="admin_stats")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(text, reply_markup=reply_markup, parse_mode="HTML")

    @admin_only
    async def cmd_broadcast(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not context.args:
            await update.message.reply_text("Использование: /broadcast <текст>")
            return
        msg = " ".join(context.args)
        count = 0
        for uid in self.users.get_active_users():
            if await self.send_to_user(int(uid), msg, parse_mode=None):
                count += 1
            await asyncio.sleep(0.05)
        await update.message.reply_text(f"● Отправлено {count} пользователям")

    # --- Callback Query Handler ---

    async def handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        data = query.data
        user_id = query.from_user.id

        # --- Start menu buttons ---
        if data == "cmd_back":
            text = (
                "◉ <b>Crypto Sectors Bot</b>\n\n"
                "Мониторинг 20 секторов и 173 токенов.\n"
                "Алерты о пампах, дампах, ротациях и альфе.\n\n"
                "Все алерты включены по умолчанию.\n"
                "Настрой через /alerts и /filters."
            )
            keyboard = [
                [
                    InlineKeyboardButton("◈ Обзор рынка", callback_data="cmd_status"),
                    InlineKeyboardButton("◉ Алерты", callback_data="cmd_alerts"),
                ],
                [
                    InlineKeyboardButton("◎ Фильтры", callback_data="cmd_filters"),
                    InlineKeyboardButton("⟐ Настройки", callback_data="cmd_settings"),
                ],
                [
                    InlineKeyboardButton("▷ Тест", callback_data="cmd_test"),
                    InlineKeyboardButton("› Справка", callback_data="cmd_help"),
                ],
            ]
            await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="HTML")
            return

        elif data == "cmd_status":
            await query.edit_message_text("⏳ Загрузка данных...", parse_mode="HTML")
            status = await self.engine.get_market_status()
            keyboard = [[InlineKeyboardButton("← Назад", callback_data="cmd_back")]]
            await query.edit_message_text(status, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="HTML")
            return

        elif data == "cmd_alerts":
            user_data = self.users.get_user(user_id)
            if not user_data:
                self.users.register_user(user_id, "", "")
                user_data = self.users.get_user(user_id)
            alert_types = user_data.get("alert_types", {})
            keyboard = []
            for key, label in ALERT_LABELS.items():
                enabled = alert_types.get(key, True)
                status = "●" if enabled else "○"
                keyboard.append([InlineKeyboardButton(
                    f"{status} {label}", callback_data=f"alert_toggle:{key}"
                )])
            all_enabled = user_data.get("alerts_enabled", True)
            keyboard.append([InlineKeyboardButton(
                f"{'◉ ВСЕ ВКЛЮЧЕНЫ' if all_enabled else '○ ВСЕ ВЫКЛЮЧЕНЫ'}",
                callback_data="alert_toggle_all"
            )])
            keyboard.append([InlineKeyboardButton("← Назад", callback_data="cmd_back")])
            await query.edit_message_text(
                "◉ <b>Настройки алертов</b>\nНажми, чтобы переключить:",
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode="HTML"
            )
            return

        elif data == "cmd_filters":
            user_data = self.users.get_user(user_id)
            if not user_data:
                self.users.register_user(user_id, "", "")
                user_data = self.users.get_user(user_id)
            f = user_data.get("filters", {})
            coins_str = ", ".join(f.get("coins", [])) or "все"
            black_str = ", ".join(f.get("blacklist_coins", [])) or "нет"
            text = (
                f"◎ <b>Фильтры алертов</b>\n\n"
                f"◈ Мин. изменение: <b>{f.get('min_change_pct', 0)}%</b>\n"
                f"▸ Мин. объём: <b>${f.get('min_volume_usd', 0):,.0f}</b>\n"
                f"● Вайтлист: <b>{coins_str}</b>\n"
                f"○ Блэклист: <b>{black_str}</b>\n\n"
                f"Используй /filters для настройки"
            )
            keyboard = [[InlineKeyboardButton("← Назад", callback_data="cmd_back")]]
            await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="HTML")
            return

        elif data == "cmd_settings":
            user_data = self.users.get_user(user_id)
            if not user_data:
                self.users.register_user(user_id, "", "")
                user_data = self.users.get_user(user_id)
            quiet = user_data.get("quiet_hours", {})
            lang = user_data.get("language", "ru")
            alerts_enabled = user_data.get("alerts_enabled", True)
            lang_name = "RU Русский" if lang == "ru" else "EN English"
            quiet_status = "Вкл" if quiet.get("enabled") else "Выкл"
            quiet_range = f" ({quiet.get('start','23:00')}–{quiet.get('end','07:00')} UTC)" if quiet.get("enabled") else ""
            text = (
                f"⟐ <b>Настройки</b>\n\n"
                f"◉ Алерты: <b>{'Включены' if alerts_enabled else 'Выключены'}</b>\n"
                f"⟐ Язык: <b>{lang_name}</b>\n"
                f"◑ Тихие часы: <b>{quiet_status}</b>{quiet_range}"
            )
            keyboard = [
                [InlineKeyboardButton(f"⟐ {lang_name}", callback_data="settings_lang")],
                [InlineKeyboardButton(f"◑ Тихие часы: {quiet_status}", callback_data="settings_quiet")],
                [InlineKeyboardButton("← Назад", callback_data="cmd_back")]
            ]
            await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="HTML")
            return

        elif data == "cmd_test":
            test_msg = (
                "▷ <b>Тестовый алерт</b>\n\n"
                "▲ <b>BONK +18.5%</b> · Memes\n"
                "├ Цена: $0.00002145\n"
                "├ Капитал: $1.2B\n"
                "└ Bonk\n\n"
                "● Бот работает, алерты будут приходить!"
            )
            keyboard = [[InlineKeyboardButton("← Назад", callback_data="cmd_back")]]
            await query.edit_message_text(test_msg, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="HTML")
            return

        elif data == "cmd_help":
            text = (
                "› <b>Справка</b>\n\n"
                "<b>Типы алертов:</b>\n"
                "  ▲ Памп — токен +15% за 24ч\n"
                "  ▼ Дамп — токен −15% за 24ч\n"
                "  ◆ Пробой — флэт 7д, рост 24ч\n"
                "  ★ Альфа — токен обгоняет сектор >10%\n"
                "  ↻ Ротация — деньги входят/выходят\n"
                "  ◈ Дивергенция — сектор vs рынок\n"
                "  ◉ Смена фазы — bull/bear переход\n"
                "  ▸ Отчёты — AI-обзоры утром\n\n"
                "→ Дашборд: sectormap.dpdns.org"
            )
            keyboard = [[InlineKeyboardButton("← Назад", callback_data="cmd_back")]]
            await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="HTML")
            return

        # --- Alert toggles ---
        if data.startswith("alert_toggle:"):
            alert_type = data.split(":")[1]
            user_data = self.users.get_user(user_id)
            if not user_data:
                return
            current = user_data.get("alert_types", {}).get(alert_type, True)
            self.users.set_alert_type(user_id, alert_type, not current)

            # Refresh keyboard
            user_data = self.users.get_user(user_id)
            alert_types = user_data.get("alert_types", {})
            keyboard = []
            for key, label in ALERT_LABELS.items():
                enabled = alert_types.get(key, True)
                status = "●" if enabled else "○"
                keyboard.append([InlineKeyboardButton(
                    f"{status} {label}", callback_data=f"alert_toggle:{key}"
                )])
            all_enabled = user_data.get("alerts_enabled", True)
            keyboard.append([InlineKeyboardButton(
                f"{'◉ ВСЕ ВКЛЮЧЕНЫ' if all_enabled else '○ ВСЕ ВЫКЛЮЧЕНЫ'}",
                callback_data="alert_toggle_all"
            )])
            keyboard.append([InlineKeyboardButton("← Назад", callback_data="cmd_back")])
            await query.edit_message_reply_markup(InlineKeyboardMarkup(keyboard))

        elif data == "alert_toggle_all":
            user_data = self.users.get_user(user_id)
            if not user_data:
                return
            current = user_data.get("alerts_enabled", True)
            self.users.set_alerts_enabled(user_id, not current)
            status = "◉ включены" if not current else "○ выключены"
            keyboard = [
                [InlineKeyboardButton("◉ Алерты", callback_data="cmd_alerts")],
                [InlineKeyboardButton("← Назад", callback_data="cmd_back")]
            ]
            await query.edit_message_text(
                f"Все алерты <b>{status}</b>",
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode="HTML"
            )

        elif data == "settings_lang":
            user_data = self.users.get_user(user_id)
            if not user_data:
                return
            current = user_data.get("language", "ru")
            new_lang = "en" if current == "ru" else "ru"
            self.users.set_language(user_id, new_lang)
            name = "RU Русский" if new_lang == "ru" else "EN English"
            keyboard = [
                [InlineKeyboardButton("⟐ Настройки", callback_data="cmd_settings")],
                [InlineKeyboardButton("← Назад", callback_data="cmd_back")]
            ]
            await query.edit_message_text(f"Язык изменён: <b>{name}</b>", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="HTML")

        elif data == "settings_quiet":
            user_data = self.users.get_user(user_id)
            if not user_data:
                return
            quiet = user_data.get("quiet_hours", {})
            new_enabled = not quiet.get("enabled", False)
            self.users.set_quiet_hours(user_id, new_enabled)
            msg = "◑ Тихие часы <b>включены</b> (23:00–07:00 UTC)" if new_enabled else "◉ Тихие часы <b>выключены</b>"
            keyboard = [
                [InlineKeyboardButton("⟐ Настройки", callback_data="cmd_settings")],
                [InlineKeyboardButton("← Назад", callback_data="cmd_back")]
            ]
            await query.edit_message_text(msg, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="HTML")

        # Admin callbacks
        elif data == "admin_users" and self.users.is_admin(user_id):
            users = self.users.get_all_users()
            lines = []
            for uid, u in list(users.items())[:20]:
                name = u.get("first_name", u.get("username", uid))
                role = u.get("role", "user")
                active = "◉" if u.get("alerts_enabled", True) else "○"
                icon = "★" if role == "admin" else "·"
                lines.append(f"{icon} {name} ({uid}) {active}")
            text = f"<b>▸ Пользователи ({len(users)}):</b>\n" + "\n".join(lines)
            await query.edit_message_text(text, parse_mode="HTML")

        elif data == "admin_toggle_bot" and self.users.is_admin(user_id):
            self.config.bot_enabled = not self.config.bot_enabled
            status = "● включён" if self.config.bot_enabled else "○ выключен"
            await query.edit_message_text(f"▸ Бот <b>{status}</b>", parse_mode="HTML")

        elif data == "admin_test_broadcast" and self.users.is_admin(user_id):
            count = 0
            for uid in self.users.get_active_users():
                if await self.send_to_user(int(uid), "▷ <b>Тестовая рассылка от админа</b>"):
                    count += 1
                await asyncio.sleep(0.05)
            await query.edit_message_text(f"● Тест отправлен: {count} пользователей")

        elif data == "admin_stats" and self.users.is_admin(user_id):
            stats = self.users.get_stats()
            text = (
                f"◈ <b>Статистика</b>\n\n"
                f"▸ Всего: {stats['total']}\n"
                f"◉ Активных: {stats['active']}\n"
                f"○ Неактивных: {stats['inactive']}\n"
                f"★ Админов: {stats['admins']}\n"
                f"▸ Алертов: {self.state.total_alerts_sent}\n"
                f"▸ Бот: {'включён' if self.config.bot_enabled else 'выключен'}"
            )
            await query.edit_message_text(text, parse_mode="HTML")

    # --- Alert Loop ---

    async def alert_loop(self, context: ContextTypes.DEFAULT_TYPE):
        if not self.config.bot_enabled:
            return

        try:
            alerts = await self.engine.check_alerts()
            for alert in alerts:
                msg = alert["message"]
                alert_type = alert["type"]
                alert_meta = alert.get("meta")

                if self.engine._dedup_check(msg):
                    continue

                await self.broadcast(msg, alert_type=alert_type, alert_meta=alert_meta)
                self.state.total_alerts_sent += 1

            save_state(self.state)
            if alerts:
                logger.info(f"Alert check done, {len(alerts)} alerts")
        except Exception as e:
            logger.error(f"Alert loop error: {e}")

    # --- Run ---

    async def run_once(self):
        await self.engine.start()
        try:
            alerts = await self.engine.check_alerts()
            for alert in alerts:
                url = f"https://api.telegram.org/bot{self.config.bot_token}/sendMessage"
                async with self.engine.session.post(url, json={
                    "chat_id": self.config.chat_id,
                    "text": alert["message"],
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True
                }) as resp:
                    pass
                await asyncio.sleep(1)
            save_state(self.state)
            logger.info(f"One-time check done, {len(alerts)} alerts")
        finally:
            await self.engine.stop()

    async def run_forever(self):
        if not HAS_PTB:
            logger.error("python-telegram-bot required. Install: pip install python-telegram-bot")
            await self._run_legacy_loop()
            return

        await self.engine.start()

        self.app = Application.builder().token(self.config.bot_token).build()

        # Register commands
        self.app.add_handler(CommandHandler("start", self.cmd_start))
        self.app.add_handler(CommandHandler("help", self.cmd_help))
        self.app.add_handler(CommandHandler("status", self.cmd_status))
        self.app.add_handler(CommandHandler("alerts", self.cmd_alerts))
        self.app.add_handler(CommandHandler("settings", self.cmd_settings))
        self.app.add_handler(CommandHandler("filters", self.cmd_filters))
        self.app.add_handler(CommandHandler("test", self.cmd_test))
        self.app.add_handler(CommandHandler("admin", self.cmd_admin))
        self.app.add_handler(CommandHandler("broadcast", self.cmd_broadcast))
        self.app.add_handler(CallbackQueryHandler(self.handle_callback))

        # Register admin on startup
        self.users.register_user(ADMIN_ID, "admin", "Admin")

        # Register legacy chat_id
        try:
            chat_id_int = int(self.config.chat_id)
            if not self.users.is_registered(chat_id_int):
                self.users.register_user(chat_id_int, "", "Legacy")
        except ValueError:
            pass

        # Schedule periodic alert check
        self.app.job_queue.run_repeating(
            self.alert_loop,
            interval=self.config.check_interval,
            first=10
        )

        logger.info("Bot v4.1 starting...")

        try:
            await self.app.initialize()
            await self.app.start()

            # Register bot commands menu (visible in Telegram UI)
            await self.app.bot.set_my_commands([
                BotCommand("status", "◈ Обзор рынка"),
                BotCommand("alerts", "◉ Настройки алертов"),
                BotCommand("filters", "◎ Фильтры"),
                BotCommand("settings", "⟐ Настройки"),
                BotCommand("test", "▷ Тестовый алерт"),
                BotCommand("help", "› Справка"),
            ])

            # Send startup message to admin
            stats = self.users.get_stats()
            await self.app.bot.send_message(
                chat_id=ADMIN_ID,
                text=(
                    f"▲ <b>Sector Alerts Bot v4.1</b>\n"
                    f"├ ▸ Пользователей: {stats['total']}\n"
                    f"├ ◉ Активных: {stats['active']}\n"
                    f"└ ⏱ Интервал: {self.config.check_interval}с"
                ),
                parse_mode="HTML"
            )

            await self.app.updater.start_polling(drop_pending_updates=True)

            while True:
                await asyncio.sleep(1)

        except asyncio.CancelledError:
            pass
        finally:
            await self.app.updater.stop()
            await self.app.stop()
            await self.app.shutdown()
            await self.engine.stop()
            save_state(self.state)

    async def _run_legacy_loop(self):
        await self.engine.start()
        logger.info("Running in legacy send-only mode")

        try:
            while True:
                try:
                    if self.config.bot_enabled:
                        alerts = await self.engine.check_alerts()
                        for alert in alerts:
                            msg = alert["message"]
                            if self.engine._dedup_check(msg):
                                continue
                            url = f"https://api.telegram.org/bot{self.config.bot_token}/sendMessage"
                            async with self.engine.session.post(url, json={
                                "chat_id": self.config.chat_id,
                                "text": msg,
                                "parse_mode": "HTML",
                                "disable_web_page_preview": True
                            }) as resp:
                                pass
                            await asyncio.sleep(1)
                        save_state(self.state)
                except Exception as e:
                    logger.error(f"Check error: {e}")
                await asyncio.sleep(self.config.check_interval)
        except asyncio.CancelledError:
            pass
        finally:
            await self.engine.stop()
            save_state(self.state)


async def main():
    parser = argparse.ArgumentParser(description="Crypto Sectors Alert Bot v4.1")
    parser.add_argument("--once", action="store_true", help="One check and exit")
    args = parser.parse_args()

    config = load_config()
    state = load_state()
    bot = SectorAlertsBot(config, state)

    if args.once:
        await bot.run_once()
    else:
        await bot.run_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Stopped by Ctrl+C")
