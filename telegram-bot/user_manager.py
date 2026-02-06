"""
User Manager for Crypto Sectors Alert Bot
==========================================
Manages multi-user settings, roles, and alert preferences.
"""

import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

USERS_FILE = Path(__file__).parent / "users.json"

DEFAULT_USER = {
    "role": "user",
    "alerts_enabled": True,
    "alert_types": {
        "pump": True,
        "dump": True,
        "early_breakout": True,
        "alpha": True,
        "rotation_in": True,
        "rotation_out": False,
        "sector_divergence": False,
        "market_state": True,
        "daily_report": True,
        "weekly_report": True
    },
    "filters": {
        "min_change_pct": 0,
        "min_volume_usd": 0,
        "coins": [],
        "blacklist_coins": []
    },
    "quiet_hours": {
        "enabled": False,
        "start": "23:00",
        "end": "07:00"
    },
    "language": "ru",
    "joined": ""
}

ADMIN_ID = 698379097


class UserManager:
    """Manages user data and preferences."""

    def __init__(self):
        self.users: dict = {}
        self.load()

    def load(self):
        """Load users from JSON file."""
        if USERS_FILE.exists():
            try:
                self.users = json.loads(USERS_FILE.read_text())
            except Exception as e:
                logger.error(f"Error loading users: {e}")
                self.users = {}
        else:
            self.users = {}

    def save(self):
        """Save users to JSON file."""
        try:
            USERS_FILE.write_text(json.dumps(self.users, indent=2, ensure_ascii=False))
        except Exception as e:
            logger.error(f"Error saving users: {e}")

    def get_user(self, user_id: int) -> dict:
        """Get user data, creating default if not exists."""
        uid = str(user_id)
        if uid not in self.users:
            return None
        return self.users[uid]

    def register_user(self, user_id: int, username: str = "", first_name: str = "") -> dict:
        """Register a new user or return existing."""
        uid = str(user_id)
        if uid in self.users:
            # Update name info
            self.users[uid]["username"] = username
            self.users[uid]["first_name"] = first_name
            self.save()
            return self.users[uid]

        from datetime import datetime, timezone
        user = {
            **DEFAULT_USER,
            "user_id": user_id,
            "username": username,
            "first_name": first_name,
            "role": "admin" if user_id == ADMIN_ID else "user",
            "joined": datetime.now(timezone.utc).isoformat()
        }
        self.users[uid] = user
        self.save()
        logger.info(f"New user registered: {user_id} ({username})")
        return user

    def is_admin(self, user_id: int) -> bool:
        """Check if user is admin."""
        return user_id == ADMIN_ID

    def is_registered(self, user_id: int) -> bool:
        """Check if user is registered."""
        return str(user_id) in self.users

    def get_all_users(self) -> dict:
        """Get all registered users."""
        return self.users

    def get_active_users(self) -> list:
        """Get users with alerts enabled."""
        return [
            uid for uid, data in self.users.items()
            if data.get("alerts_enabled", True)
        ]

    def set_alert_type(self, user_id: int, alert_type: str, enabled: bool):
        """Toggle specific alert type for user."""
        uid = str(user_id)
        if uid in self.users:
            self.users[uid].setdefault("alert_types", {})
            self.users[uid]["alert_types"][alert_type] = enabled
            self.save()

    def set_alerts_enabled(self, user_id: int, enabled: bool):
        """Enable/disable all alerts for user."""
        uid = str(user_id)
        if uid in self.users:
            self.users[uid]["alerts_enabled"] = enabled
            self.save()

    def set_filter(self, user_id: int, key: str, value):
        """Set a filter value for user."""
        uid = str(user_id)
        if uid in self.users:
            self.users[uid].setdefault("filters", {})
            self.users[uid]["filters"][key] = value
            self.save()

    def set_quiet_hours(self, user_id: int, enabled: bool, start: str = "23:00", end: str = "07:00"):
        """Set quiet hours for user."""
        uid = str(user_id)
        if uid in self.users:
            self.users[uid]["quiet_hours"] = {
                "enabled": enabled,
                "start": start,
                "end": end
            }
            self.save()

    def set_language(self, user_id: int, lang: str):
        """Set user language (ru/en)."""
        uid = str(user_id)
        if uid in self.users:
            self.users[uid]["language"] = lang
            self.save()

    def should_send_alert(self, user_id: int, alert_type: str) -> bool:
        """Check if alert should be sent to this user."""
        uid = str(user_id)
        user = self.users.get(uid)
        if not user:
            return False
        if not user.get("alerts_enabled", True):
            return False

        # Check alert type
        alert_types = user.get("alert_types", {})
        if not alert_types.get(alert_type, True):
            return False

        # Check quiet hours
        quiet = user.get("quiet_hours", {})
        if quiet.get("enabled", False):
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            current_time = now.strftime("%H:%M")
            start = quiet.get("start", "23:00")
            end = quiet.get("end", "07:00")

            if start > end:  # Crosses midnight
                if current_time >= start or current_time < end:
                    return False
            else:
                if start <= current_time < end:
                    return False

        return True

    def matches_filters(self, user_id: int, alert_meta: dict) -> bool:
        """Check if alert matches user's filters (coins, change %, volume)."""
        uid = str(user_id)
        user = self.users.get(uid)
        if not user:
            return True  # No user = no filters

        filters = user.get("filters", {})

        # Min change % filter
        min_change = filters.get("min_change_pct", 0)
        if min_change > 0 and "change_pct" in alert_meta:
            if abs(alert_meta["change_pct"]) < min_change:
                return False

        # Min volume filter
        min_vol = filters.get("min_volume_usd", 0)
        if min_vol > 0 and "volume_usd" in alert_meta:
            if alert_meta["volume_usd"] < min_vol:
                return False

        # Coin whitelist (if set, only these coins)
        whitelist = filters.get("coins", [])
        if whitelist and "token" in alert_meta:
            if alert_meta["token"].upper() not in [c.upper() for c in whitelist]:
                return False

        # Coin blacklist
        blacklist = filters.get("blacklist_coins", [])
        if blacklist and "token" in alert_meta:
            if alert_meta["token"].upper() in [c.upper() for c in blacklist]:
                return False

        return True

    def get_user_count(self) -> int:
        """Get total number of registered users."""
        return len(self.users)

    def get_stats(self) -> dict:
        """Get user statistics."""
        total = len(self.users)
        active = sum(1 for u in self.users.values() if u.get("alerts_enabled", True))
        admins = sum(1 for u in self.users.values() if u.get("role") == "admin")
        return {
            "total": total,
            "active": active,
            "admins": admins,
            "inactive": total - active
        }
