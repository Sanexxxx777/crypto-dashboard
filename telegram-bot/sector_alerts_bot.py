#!/usr/bin/env python3
"""
Crypto Sectors Alert Bot v3.0 (AI-Powered)
==========================================

Умные алерты по крипто-секторам с AI-аналитикой (Groq Llama 3.3).

Алерты:
1. Token Surge/Dump — резкие движения ±15% за 24ч
2. Early Breakout — был flat 7d, начал расти (ранний сигнал!)
3. Sector Rotation — деньги перетекают в/из сектора
4. Alpha Detection — токен обгоняет свой сектор
5. Momentum Leaders — топ при старте bull phase
6. Market State — переход bull/bear
7. AI Daily Digest — ежедневный AI-обзор (9:00 UTC)
8. AI Weekly Digest — еженедельный AI-анализ (пн 9:00 UTC)

Использование:
    python3 sector_alerts_bot.py
    python3 sector_alerts_bot.py --once   # Один раз и выход
"""

import argparse
import asyncio
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
    print("Установите зависимости: pip install aiohttp tomli")
    sys.exit(1)

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


@dataclass
class Config:
    """Конфигурация бота"""
    # Telegram
    bot_token: str = ""
    chat_id: str = ""

    # API
    api_url: str = "https://sectormap.dpdns.org/api/sheets"
    api_key: str = "crypto-dashboard-2024"

    # Signals API (для сохранения истории)
    signals_api_url: str = "https://sectormap.dpdns.org/api/signals"
    signals_api_key: str = "sector-alerts-2024"

    # AI API (для дайджестов)
    ai_api_url: str = "https://sectormap.dpdns.org/api/ai"
    use_ai_digests: bool = True  # Использовать AI для дайджестов

    # === ALERT THRESHOLDS ===
    # Token surge/dump
    token_surge_pct: float = 15.0
    token_dump_pct: float = -15.0

    # Early breakout: был flat, начал расти
    breakout_flat_max: float = 5.0      # Макс изменение за 7d чтобы считать "flat"
    breakout_surge_min: float = 8.0     # Мин рост за 24h для breakout

    # Sector rotation
    rotation_7d_threshold: float = 3.0  # Порог для 7d изменения
    rotation_24h_threshold: float = 2.0 # Порог для 24h изменения (противоположное)

    # Alpha (токен vs сектор)
    alpha_min_pct: float = 10.0         # Мин разница токен-сектор

    # Sector divergence vs market
    sector_diff_pct: float = 5.0

    # Timing
    check_interval: int = 300
    daily_report_hour: int = 9       # UTC
    weekly_report_day: int = 0       # 0=Monday

    # Filters
    min_mcap_usd: float = 50_000_000
    ignore_tokens: list = field(default_factory=list)
    ignore_sectors: list = field(default_factory=list)


@dataclass
class State:
    """Сохраняемое состояние между запусками"""
    last_market_state: str = "neutral"
    last_daily_report: str = ""
    last_weekly_report: str = ""
    alerted_tokens: dict = field(default_factory=dict)
    alerted_sectors: dict = field(default_factory=dict)
    alerted_breakouts: dict = field(default_factory=dict)
    alerted_alphas: dict = field(default_factory=dict)
    alerted_rotations: dict = field(default_factory=dict)


def load_config() -> Config:
    """Загрузить конфиг из TOML"""
    if not CONFIG_FILE.exists():
        logger.error(f"Конфиг не найден: {CONFIG_FILE}")
        sys.exit(1)

    with open(CONFIG_FILE, "rb") as f:
        data = tomli.load(f)

    cfg = Config()

    # Telegram
    tg = data.get("telegram", {})
    cfg.bot_token = tg.get("bot_token", "")
    cfg.chat_id = str(tg.get("chat_id", ""))

    # API
    api = data.get("api", {})
    cfg.api_url = api.get("url", cfg.api_url)
    cfg.api_key = api.get("key", cfg.api_key)

    # Alerts
    alerts = data.get("alerts", {})
    cfg.token_surge_pct = alerts.get("token_surge_pct", cfg.token_surge_pct)
    cfg.token_dump_pct = alerts.get("token_dump_pct", cfg.token_dump_pct)
    cfg.breakout_flat_max = alerts.get("breakout_flat_max", cfg.breakout_flat_max)
    cfg.breakout_surge_min = alerts.get("breakout_surge_min", cfg.breakout_surge_min)
    cfg.rotation_7d_threshold = alerts.get("rotation_7d_threshold", cfg.rotation_7d_threshold)
    cfg.rotation_24h_threshold = alerts.get("rotation_24h_threshold", cfg.rotation_24h_threshold)
    cfg.alpha_min_pct = alerts.get("alpha_min_pct", cfg.alpha_min_pct)
    cfg.sector_diff_pct = alerts.get("sector_diff_pct", cfg.sector_diff_pct)

    # Timing
    timing = data.get("timing", {})
    cfg.check_interval = timing.get("check_interval", cfg.check_interval)
    cfg.daily_report_hour = timing.get("daily_report_hour", cfg.daily_report_hour)
    cfg.weekly_report_day = timing.get("weekly_report_day", cfg.weekly_report_day)

    # Filters
    filters = data.get("filters", {})
    cfg.min_mcap_usd = filters.get("min_mcap_usd", cfg.min_mcap_usd)
    cfg.ignore_tokens = filters.get("ignore_tokens", [])
    cfg.ignore_sectors = filters.get("ignore_sectors", [])

    return cfg


def load_state() -> State:
    """Загрузить состояние из файла"""
    if STATE_FILE.exists():
        try:
            data = json.loads(STATE_FILE.read_text())
            state = State()
            state.last_market_state = data.get("last_market_state", "neutral")
            state.last_daily_report = data.get("last_daily_report", "")
            state.last_weekly_report = data.get("last_weekly_report", "")
            state.alerted_tokens = data.get("alerted_tokens", {})
            state.alerted_sectors = data.get("alerted_sectors", {})
            state.alerted_breakouts = data.get("alerted_breakouts", {})
            state.alerted_alphas = data.get("alerted_alphas", {})
            state.alerted_rotations = data.get("alerted_rotations", {})
            return state
        except Exception as e:
            logger.warning(f"Ошибка загрузки state: {e}")
    return State()


def save_state(state: State):
    """Сохранить состояние в файл"""
    data = {
        "last_market_state": state.last_market_state,
        "last_daily_report": state.last_daily_report,
        "last_weekly_report": state.last_weekly_report,
        "alerted_tokens": state.alerted_tokens,
        "alerted_sectors": state.alerted_sectors,
        "alerted_breakouts": state.alerted_breakouts,
        "alerted_alphas": state.alerted_alphas,
        "alerted_rotations": state.alerted_rotations,
    }
    STATE_FILE.write_text(json.dumps(data, indent=2))


class SectorAlertsBot:
    """Основной класс бота"""

    def __init__(self, config: Config, state: State):
        self.config = config
        self.state = state
        self.session: Optional[aiohttp.ClientSession] = None
        self.sector_tokens_map: dict = {}  # sector -> [token_ids]

    async def start(self):
        self.session = aiohttp.ClientSession()

    async def stop(self):
        if self.session:
            await self.session.close()

    async def send_telegram(self, text: str, parse_mode: str = "HTML") -> bool:
        if not self.config.bot_token or not self.config.chat_id:
            logger.warning("Telegram не настроен")
            return False

        url = f"https://api.telegram.org/bot{self.config.bot_token}/sendMessage"
        payload = {
            "chat_id": self.config.chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True
        }

        try:
            async with self.session.post(url, json=payload) as resp:
                if resp.status == 200:
                    logger.info("Telegram: сообщение отправлено")
                    return True
                else:
                    body = await resp.text()
                    logger.error(f"Telegram error {resp.status}: {body}")
                    return False
        except Exception as e:
            logger.error(f"Telegram exception: {e}")
            return False

    async def save_signal(self, signal_data: dict) -> bool:
        """Сохранить сигнал в API для истории на сайте"""
        url = f"{self.config.signals_api_url}?key={self.config.signals_api_key}"
        try:
            async with self.session.post(url, json=signal_data, timeout=10) as resp:
                if resp.status == 200:
                    logger.debug(f"Signal saved: {signal_data.get('type')}")
                    return True
                else:
                    logger.warning(f"Signal save failed: {resp.status}")
                    return False
        except Exception as e:
            logger.warning(f"Signal save error: {e}")
            return False

    async def fetch_ai_digest(self, digest_type: str = "daily") -> Optional[str]:
        """Получить AI-дайджест от сервера"""
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
                    logger.warning(f"AI digest error: {data.get('error')}")
                elif resp.status == 503:
                    logger.info("AI not available")
                else:
                    logger.warning(f"AI digest failed: {resp.status}")
                return None
        except Exception as e:
            logger.warning(f"AI digest exception: {e}")
            return None

    async def fetch_ai_explanation(self, signal: dict) -> Optional[str]:
        """Получить AI-объяснение сигнала"""
        if not self.config.use_ai_digests:
            return None

        url = f"{self.config.ai_api_url}/explain"
        try:
            async with self.session.post(url, json={"signal": signal}, timeout=30) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("success"):
                        return data.get("explanation")
                return None
        except Exception as e:
            logger.debug(f"AI explanation error: {e}")
            return None

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
        except Exception as e:
            logger.error(f"Market state error: {e}")
            return None

    async def fetch_momentum(self) -> Optional[dict]:
        url = self.config.api_url.replace("/sheets", "/momentum")
        try:
            async with self.session.get(url, timeout=10) as resp:
                if resp.status == 200:
                    return await resp.json()
                return None
        except Exception as e:
            logger.error(f"Momentum error: {e}")
            return None

    def _cooldown_check(self, cache: dict, key: str, hours: float) -> bool:
        """Проверить cooldown"""
        last = cache.get(key)
        if not last:
            return True
        try:
            last_ts = datetime.fromisoformat(last)
            now = datetime.now(timezone.utc)
            return (now - last_ts).total_seconds() / 3600 >= hours
        except:
            return True

    def _mark_alerted(self, cache: dict, key: str):
        cache[key] = datetime.now(timezone.utc).isoformat()

    def _get_token_sector(self, token_id: str) -> Optional[str]:
        """Найти сектор токена"""
        for sector, tokens in self.sector_tokens_map.items():
            if token_id in tokens:
                return sector
        return None

    async def check_alerts(self) -> list[str]:
        """Проверить все алерты"""
        messages = []

        data = await self.fetch_data()
        if not data or not data.get("success"):
            logger.warning("Не удалось получить данные")
            return messages

        tokens = data.get("data", {})
        sectors = data.get("sectors", {})
        self.sector_tokens_map = data.get("sectorTokens", {})

        # Среднее по рынку
        all_changes = [t.get("change_24h") for t in tokens.values() if t.get("change_24h") is not None]
        market_avg_24h = sum(all_changes) / len(all_changes) if all_changes else 0

        # 1. Token surge/dump (базовые алерты)
        messages.extend(await self._check_token_surges(tokens))

        # 2. Early breakout detection (NEW!)
        messages.extend(await self._check_early_breakouts(tokens))

        # 3. Alpha detection - токен vs сектор (NEW!)
        messages.extend(await self._check_alpha_tokens(tokens, sectors))

        # 4. Sector rotation (NEW!)
        messages.extend(await self._check_sector_rotation(sectors))

        # 5. Sector divergence vs market
        messages.extend(self._check_sector_divergence(sectors, market_avg_24h))

        # 6. Market state change + momentum leaders
        market_alert = await self._check_market_state_change()
        if market_alert:
            messages.append(market_alert)

        # 7. Daily report (AI-powered)
        daily = await self._check_daily_report(sectors, tokens)
        if daily:
            messages.append(daily)

        # 8. Weekly report (AI-powered)
        weekly = await self._check_weekly_report(sectors, tokens)
        if weekly:
            messages.append(weekly)

        return messages

    async def _check_token_surges(self, tokens: dict) -> list[str]:
        """Token surge/dump alerts"""
        messages = []
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
            sector_str = f" ({sector})" if sector else ""

            if change_24h >= cfg.token_surge_pct:
                msg = (
                    f"🚀 <b>{symbol}</b> +{change_24h:.1f}%{sector_str}\n"
                    f"├ Цена: ${price:,.4f}\n"
                    f"├ MCap: ${mcap/1e6:.0f}M\n"
                    f"└ {name}"
                )
                messages.append(msg)
                self._mark_alerted(self.state.alerted_tokens, token_id)

                await self.save_signal({
                    "type": "TOKEN_SURGE",
                    "token": symbol,
                    "sector": sector,
                    "change_24h": change_24h,
                    "price": price,
                    "mcap": mcap,
                    "reason": f"Рост +{change_24h:.1f}% за 24ч"
                })

            elif change_24h <= cfg.token_dump_pct:
                msg = (
                    f"💥 <b>{symbol}</b> {change_24h:.1f}%{sector_str}\n"
                    f"├ Цена: ${price:,.4f}\n"
                    f"├ MCap: ${mcap/1e6:.0f}M\n"
                    f"└ {name}"
                )
                messages.append(msg)
                self._mark_alerted(self.state.alerted_tokens, token_id)

                await self.save_signal({
                    "type": "TOKEN_DUMP",
                    "token": symbol,
                    "sector": sector,
                    "change_24h": change_24h,
                    "price": price,
                    "mcap": mcap,
                    "reason": f"Падение {change_24h:.1f}% за 24ч"
                })

        return messages

    async def _check_early_breakouts(self, tokens: dict) -> list[str]:
        """
        Early Breakout Detection:
        Токен был flat за 7d (±5%), но сейчас растёт 8%+ за 24h
        = Начало движения, ещё не поздно
        """
        messages = []
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

            # Был flat за 7d (без учёта 24h движения)
            change_7d_before_today = change_7d - change_24h
            was_flat = abs(change_7d_before_today) <= cfg.breakout_flat_max

            # Сейчас начал расти
            is_surging = change_24h >= cfg.breakout_surge_min

            if was_flat and is_surging:
                if not self._cooldown_check(self.state.alerted_breakouts, token_id, 24):
                    continue

                symbol = token.get("symbol", token_id.upper())
                sector = self._get_token_sector(token_id)
                sector_str = f" ({sector})" if sector else ""
                price = token.get("price", 0)

                reason = f"Был flat {change_7d_before_today:+.1f}% за 7d, начал расти +{change_24h:.1f}%"

                msg = (
                    f"⚡ <b>EARLY BREAKOUT</b>: {symbol}{sector_str}\n"
                    f"├ 24h: <b>+{change_24h:.1f}%</b>\n"
                    f"├ 7d до этого: {change_7d_before_today:+.1f}% (был flat)\n"
                    f"├ Цена: ${price:,.4f}\n"
                    f"└ MCap: ${mcap/1e6:.0f}M"
                )
                messages.append(msg)
                self._mark_alerted(self.state.alerted_breakouts, token_id)
                logger.info(f"Early breakout: {symbol}")

                # Сохраняем в API
                await self.save_signal({
                    "type": "EARLY_BREAKOUT",
                    "token": symbol,
                    "sector": sector,
                    "change_24h": change_24h,
                    "change_7d": change_7d,
                    "price": price,
                    "mcap": mcap,
                    "reason": reason
                })

        return messages

    async def _check_alpha_tokens(self, tokens: dict, sectors: dict) -> list[str]:
        """
        Alpha Detection:
        Токен растёт значительно сильнее своего сектора
        = Альфа, выделяется из толпы
        """
        messages = []
        cfg = self.config

        for token_id, token in tokens.items():
            if token_id in cfg.ignore_tokens:
                continue
            mcap = token.get("market_cap") or 0
            if mcap < cfg.min_mcap_usd:
                continue

            change_24h = token.get("change_24h")
            if change_24h is None or change_24h < 5:  # Только растущие
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
                reason = f"Токен +{change_24h:.1f}%, сектор {sector_name} +{sector_avg:.1f}%, альфа +{alpha:.1f}%"

                msg = (
                    f"🎯 <b>ALPHA</b>: {symbol} в {sector_name}\n"
                    f"├ Токен: <b>+{change_24h:.1f}%</b>\n"
                    f"├ Сектор: +{sector_avg:.1f}%\n"
                    f"├ Альфа: <b>+{alpha:.1f}%</b>\n"
                    f"└ ${price:,.4f} | ${mcap/1e6:.0f}M"
                )
                messages.append(msg)
                self._mark_alerted(self.state.alerted_alphas, token_id)
                logger.info(f"Alpha: {symbol} +{alpha:.1f}% vs {sector_name}")

                await self.save_signal({
                    "type": "ALPHA",
                    "token": symbol,
                    "sector": sector_name,
                    "change_24h": change_24h,
                    "sector_avg": sector_avg,
                    "alpha": alpha,
                    "price": price,
                    "mcap": mcap,
                    "reason": reason
                })

        return messages

    async def _check_sector_rotation(self, sectors: dict) -> list[str]:
        """
        Sector Rotation Detection:
        - 7d был негативный, 24h позитивный = деньги ВХОДЯТ
        - 7d был позитивный, 24h негативный = деньги ВЫХОДЯТ
        """
        messages = []
        cfg = self.config

        for sector_name, sector in sectors.items():
            if sector_name in cfg.ignore_sectors:
                continue

            avg_24h = sector.get("avg24h", 0)
            avg_7d = sector.get("avg7d", 0)

            # Rotation IN: был негативный 7d, стал позитивный 24h
            rotation_in = (
                avg_7d <= -cfg.rotation_7d_threshold and
                avg_24h >= cfg.rotation_24h_threshold
            )

            # Rotation OUT: был позитивный 7d, стал негативный 24h
            rotation_out = (
                avg_7d >= cfg.rotation_7d_threshold and
                avg_24h <= -cfg.rotation_24h_threshold
            )

            if rotation_in or rotation_out:
                key = f"{sector_name}_rotation"
                if not self._cooldown_check(self.state.alerted_rotations, key, 24):
                    continue

                if rotation_in:
                    best = sector.get("best")
                    best_str = f"{best['symbol']} +{best['value']:.0f}%" if best else "-"
                    reason = f"7d: {avg_7d:+.1f}%, 24h: +{avg_24h:.1f}% - разворот вверх"
                    msg = (
                        f"🔄 <b>ROTATION IN</b>: {sector_name}\n"
                        f"├ 7d: {avg_7d:+.1f}% (было плохо)\n"
                        f"├ 24h: <b>+{avg_24h:.1f}%</b> (разворот!)\n"
                        f"└ Лидер: {best_str}"
                    )
                    signal_type = "ROTATION_IN"
                else:
                    reason = f"7d: +{avg_7d:.1f}%, 24h: {avg_24h:.1f}% - разворот вниз"
                    msg = (
                        f"🔄 <b>ROTATION OUT</b>: {sector_name}\n"
                        f"├ 7d: +{avg_7d:.1f}% (было хорошо)\n"
                        f"├ 24h: <b>{avg_24h:.1f}%</b> (разворот!)\n"
                        f"└ Деньги уходят из сектора"
                    )
                    signal_type = "ROTATION_OUT"

                messages.append(msg)
                self._mark_alerted(self.state.alerted_rotations, key)
                logger.info(f"Rotation {'IN' if rotation_in else 'OUT'}: {sector_name}")

                await self.save_signal({
                    "type": signal_type,
                    "sector": sector_name,
                    "change_24h": avg_24h,
                    "change_7d": avg_7d,
                    "reason": reason
                })

        return messages

    def _check_sector_divergence(self, sectors: dict, market_avg: float) -> list[str]:
        """Сектор значительно отличается от рынка"""
        messages = []
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
                best_str = f"{best['symbol']} +{best['value']:.1f}%" if best else "-"
                msg = (
                    f"📈 <b>{sector_name}</b> опережает рынок\n"
                    f"├ Сектор: +{avg_24h:.1f}%\n"
                    f"├ Рынок: {market_avg:+.1f}%\n"
                    f"├ Разница: +{diff:.1f}%\n"
                    f"└ Лидер: {best_str}"
                )
                messages.append(msg)
                self._mark_alerted(self.state.alerted_sectors, sector_name)

            elif diff <= -cfg.sector_diff_pct:
                msg = (
                    f"📉 <b>{sector_name}</b> отстаёт от рынка\n"
                    f"├ Сектор: {avg_24h:+.1f}%\n"
                    f"├ Рынок: {market_avg:+.1f}%\n"
                    f"└ Разница: {diff:.1f}%"
                )
                messages.append(msg)
                self._mark_alerted(self.state.alerted_sectors, sector_name)

        return messages

    async def _check_market_state_change(self) -> Optional[str]:
        """Проверить смену режима + показать momentum leaders при bull"""
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
                # При старте bull phase — показать momentum leaders
                momentum = await self.fetch_momentum()
                leaders_str = ""
                if momentum:
                    top_tokens = momentum.get("tokens", [])[:5]
                    if top_tokens:
                        leaders = [f"{t['symbol']} ({t['tier']})" for t in top_tokens]
                        leaders_str = f"\n\n<b>Momentum Leaders:</b>\n" + ", ".join(leaders)

                return (
                    f"🐂 <b>BULL PHASE STARTED</b>\n"
                    f"├ BTC: ${btc_price:,.0f}\n"
                    f"└ 24h: +{btc_24h:.1f}%"
                    f"{leaders_str}"
                )

            elif new_state == "bear" and old_state != "bear":
                return (
                    f"🐻 <b>BEAR PHASE STARTED</b>\n"
                    f"├ BTC: ${btc_price:,.0f}\n"
                    f"└ 24h: {btc_24h:.1f}%"
                )

            elif new_state == "neutral" and old_state == "bull":
                return (
                    f"⚖️ <b>Bull phase ended</b>\n"
                    f"├ BTC: ${btc_price:,.0f}\n"
                    f"└ 24h: {btc_24h:+.1f}%"
                )

        return None

    async def _check_daily_report(self, sectors: dict, tokens: dict) -> Optional[str]:
        """Ежедневный отчёт (с AI если доступен)"""
        now = datetime.now(timezone.utc)
        today = now.strftime("%Y-%m-%d")

        if now.hour != self.config.daily_report_hour:
            return None
        if self.state.last_daily_report == today:
            return None

        self.state.last_daily_report = today

        # Пробуем получить AI-дайджест
        ai_digest = await self.fetch_ai_digest("daily")
        if ai_digest:
            logger.info("Using AI daily digest")
            return ai_digest

        # Fallback на простой отчёт
        logger.info("Using simple daily report (AI unavailable)")

        # Топ-5 секторов
        sorted_sectors = sorted(
            sectors.items(),
            key=lambda x: x[1].get("avg24h", 0),
            reverse=True
        )

        top_sectors = []
        for name, data in sorted_sectors[:5]:
            avg = data.get("avg24h", 0)
            emoji = "🟢" if avg > 0 else "🔴"
            top_sectors.append(f"{emoji} {name}: {avg:+.1f}%")

        bottom_sectors = []
        for name, data in sorted_sectors[-3:]:
            avg = data.get("avg24h", 0)
            bottom_sectors.append(f"🔴 {name}: {avg:+.1f}%")

        # Топ-5 токенов
        sorted_tokens = sorted(
            [(k, v) for k, v in tokens.items() if v.get("change_24h") is not None],
            key=lambda x: x[1].get("change_24h", 0),
            reverse=True
        )

        top_tokens = []
        for token_id, data in sorted_tokens[:5]:
            symbol = data.get("symbol", token_id.upper())
            change = data.get("change_24h", 0)
            top_tokens.append(f"🚀 {symbol}: +{change:.1f}%")

        return (
            f"📊 <b>Daily Crypto Report</b>\n"
            f"<i>{today}</i>\n\n"
            f"<b>Top 5 Sectors:</b>\n" + "\n".join(top_sectors) +
            f"\n\n<b>Worst 3 Sectors:</b>\n" + "\n".join(bottom_sectors) +
            f"\n\n<b>Top 5 Tokens:</b>\n" + "\n".join(top_tokens)
        )

    async def _check_weekly_report(self, sectors: dict, tokens: dict) -> Optional[str]:
        """Недельный отчёт по секторам (с AI если доступен)"""
        now = datetime.now(timezone.utc)
        week = now.strftime("%Y-W%W")

        if now.weekday() != self.config.weekly_report_day:
            return None
        if now.hour != self.config.daily_report_hour:
            return None
        if self.state.last_weekly_report == week:
            return None

        self.state.last_weekly_report = week

        # Пробуем получить AI-дайджест
        ai_digest = await self.fetch_ai_digest("weekly")
        if ai_digest:
            logger.info("Using AI weekly digest")
            return ai_digest

        # Fallback на простой отчёт
        logger.info("Using simple weekly report (AI unavailable)")

        # Сортируем по 7d
        sorted_sectors = sorted(
            sectors.items(),
            key=lambda x: x[1].get("avg7d", 0),
            reverse=True
        )

        lines = []
        for name, data in sorted_sectors:
            avg_7d = data.get("avg7d", 0)
            avg_30d = data.get("avg30d", 0)
            emoji = "🟢" if avg_7d > 0 else "🔴"
            trend = "↑" if avg_7d > avg_30d else "↓"
            lines.append(f"{emoji} {name}: {avg_7d:+.1f}% {trend}")

        return (
            f"📈 <b>Weekly Sector Report</b>\n"
            f"<i>{week}</i>\n\n"
            f"<b>7d Performance (↑ improving, ↓ declining):</b>\n" +
            "\n".join(lines[:10]) +
            f"\n\n<i>...и ещё {len(lines)-10} секторов</i>"
        )

    async def run_once(self):
        await self.start()
        try:
            messages = await self.check_alerts()
            for msg in messages:
                await self.send_telegram(msg)
                await asyncio.sleep(1)
            save_state(self.state)
            logger.info(f"Проверка завершена, алертов: {len(messages)}")
        finally:
            await self.stop()

    async def run_forever(self):
        await self.start()
        logger.info("Bot started v3.0 (AI-Powered)")

        await self.send_telegram(
            "🤖 <b>Sector Alerts Bot v3.0</b> started\n"
            "🧠 AI-дайджесты: ежедневные и еженедельные\n"
            "⚡ Алерты: Breakout, Alpha, Rotation, Surge"
        )

        try:
            while True:
                try:
                    messages = await self.check_alerts()
                    for msg in messages:
                        await self.send_telegram(msg)
                        await asyncio.sleep(1)
                    save_state(self.state)
                except Exception as e:
                    logger.error(f"Check error: {e}")

                await asyncio.sleep(self.config.check_interval)

        except asyncio.CancelledError:
            logger.info("Bot stopping...")
        finally:
            await self.stop()
            save_state(self.state)


async def main():
    parser = argparse.ArgumentParser(description="Crypto Sectors Alert Bot v2.0")
    parser.add_argument("--once", action="store_true", help="Одна проверка и выход")
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
