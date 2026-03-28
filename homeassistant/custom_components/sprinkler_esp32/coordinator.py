"""Data update coordinator for direct ESP32 polling."""
from __future__ import annotations

import asyncio
import logging
from datetime import timedelta

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DEFAULT_SCAN_INTERVAL, DOMAIN

_LOGGER = logging.getLogger(__name__)


class SprinklerESPCoordinator(DataUpdateCoordinator[dict]):
    """Polls one ESP32 directly via its HTTP API.

    coordinator.data shape:
    {
        "status": {
            "online": True,
            "id": "backyard",
            "activeZone": 0,
            "manualRun": False,
            "remainingSec": 0,
            "configVersion": 11,
        },
        "zones": [
            {"id": 1, "name": "Front Bed", "schedules": [...]},
            ...
        ],
        "config_version": 11,
    }
    """

    def __init__(
        self,
        hass: HomeAssistant,
        session: aiohttp.ClientSession,
        esp_url: str,
        api_key: str,
    ) -> None:
        self._session = session
        self._esp_url = esp_url.rstrip("/")
        self._headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key,
        }
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=DEFAULT_SCAN_INTERVAL),
        )

    # ── Poll ─────────────────────────────────────────────────────────────────

    async def _async_update_data(self) -> dict:
        try:
            async with asyncio.timeout(10):
                status_resp, config_resp = await asyncio.gather(
                    self._session.get(
                        f"{self._esp_url}/api/status", headers=self._headers
                    ),
                    self._session.get(
                        f"{self._esp_url}/api/config", headers=self._headers
                    ),
                )
                status_resp.raise_for_status()
                config_resp.raise_for_status()
                status = await status_resp.json()
                config = await config_resp.json()
        except aiohttp.ClientError as err:
            raise UpdateFailed(f"Cannot reach ESP at {self._esp_url}: {err}") from err
        except TimeoutError as err:
            raise UpdateFailed(f"ESP at {self._esp_url} timed out") from err

        return {
            "status": status,
            "zones": config.get("zones", []),
            "config_version": config.get("configVersion", 0),
        }

    # ── Commands ─────────────────────────────────────────────────────────────

    async def async_manual(
        self, zone_id: int, on: bool, duration_min: int = 10
    ) -> None:
        """Start or stop a specific zone."""
        body: dict = {"zone": zone_id, "on": on}
        if on:
            body["durationMin"] = duration_min
        try:
            async with asyncio.timeout(10):
                resp = await self._session.post(
                    f"{self._esp_url}/api/manual",
                    json=body,
                    headers=self._headers,
                )
                resp.raise_for_status()
        except (aiohttp.ClientError, TimeoutError) as err:
            raise HomeAssistantError(
                f"Failed to send manual command to ESP: {err}"
            ) from err
        await self.async_request_refresh()

    async def async_all_off(self) -> None:
        """Turn off all zones (zone 0 = all off convention)."""
        await self.async_manual(zone_id=0, on=False)
