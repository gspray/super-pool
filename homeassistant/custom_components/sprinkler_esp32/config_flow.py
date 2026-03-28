"""Config flow for Sprinkler ESP32 (direct ESP32 mode)."""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import aiohttp
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.components import zeroconf as zc
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_API_KEY, CONF_DEFAULT_DURATION_MIN, CONF_URL, DEFAULT_DURATION_MIN, DOMAIN

_LOGGER = logging.getLogger(__name__)


class CannotConnect(Exception):
    """Raised when the ESP is unreachable."""


class SprinklerESP32ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Config flow — manual URL entry or automatic zeroconf discovery."""

    VERSION = 1

    def __init__(self) -> None:
        self._discovered_url: str | None = None
        self._discovered_name: str = "Sprinkler ESP32"
        self._controller_id: str | None = None

    # ── Manual setup ──────────────────────────────────────────────────────────

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.FlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            url     = user_input[CONF_URL].rstrip("/")
            api_key = user_input[CONF_API_KEY]
            try:
                ctrl_id, name = await self._probe_esp(url, api_key)
            except CannotConnect:
                errors["base"] = "cannot_connect"
            except Exception:
                _LOGGER.exception("Unexpected error probing ESP")
                errors["base"] = "unknown"
            else:
                await self.async_set_unique_id(ctrl_id)
                self._abort_if_unique_id_configured(updates={CONF_URL: url})
                return self.async_create_entry(
                    title=name,
                    data={CONF_URL: url, CONF_API_KEY: api_key},
                )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_URL): str,
                vol.Required(CONF_API_KEY): str,
            }),
            errors=errors,
        )

    # ── Zeroconf discovery ────────────────────────────────────────────────────

    async def async_step_zeroconf(
        self, discovery_info: zc.ZeroconfServiceInfo
    ) -> config_entries.FlowResult:
        """ESP advertised _sprinklerapi._tcp — confirm before adding."""
        host  = discovery_info.host
        port  = discovery_info.port or 80
        props = discovery_info.properties or {}

        self._controller_id  = props.get("id") or host
        self._discovered_url = f"http://{host}" if port == 80 else f"http://{host}:{port}"

        raw: str = discovery_info.name or ""
        self._discovered_name = raw.split("._")[0].strip() or "Sprinkler ESP32"

        await self.async_set_unique_id(self._controller_id)
        self._abort_if_unique_id_configured(
            updates={CONF_URL: self._discovered_url}
        )

        self.context["title_placeholders"] = {"name": self._discovered_name}
        return await self.async_step_zeroconf_confirm()

    async def async_step_zeroconf_confirm(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.FlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            api_key = user_input[CONF_API_KEY]
            try:
                _, name = await self._probe_esp(self._discovered_url, api_key)
            except CannotConnect:
                errors["base"] = "cannot_connect"
            else:
                return self.async_create_entry(
                    title=name or self._discovered_name,
                    data={CONF_URL: self._discovered_url, CONF_API_KEY: api_key},
                )

        return self.async_show_form(
            step_id="zeroconf_confirm",
            data_schema=vol.Schema({vol.Required(CONF_API_KEY): str}),
            description_placeholders={
                "url":  self._discovered_url,
                "name": self._discovered_name,
            },
            errors=errors,
        )

    # ── Options flow ──────────────────────────────────────────────────────────

    @staticmethod
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> SprinklerESP32OptionsFlow:
        return SprinklerESP32OptionsFlow(config_entry)

    # ── Helper ────────────────────────────────────────────────────────────────

    async def _probe_esp(self, url: str, api_key: str) -> tuple[str, str]:
        """Call GET /api/status, return (controller_id, friendly_name)."""
        session = async_get_clientsession(self.hass)
        headers = {"x-api-key": api_key}
        try:
            async with asyncio.timeout(10):
                resp = await session.get(f"{url}/api/status", headers=headers)
                resp.raise_for_status()
                data = await resp.json()
        except (aiohttp.ClientError, TimeoutError) as err:
            raise CannotConnect from err

        ctrl_id = data.get("id") or url.replace("://", "_").replace(":", "_").replace("/", "")
        name    = self._discovered_name if ctrl_id == self._controller_id else f"Sprinkler {ctrl_id}"
        return ctrl_id, name


class SprinklerESP32OptionsFlow(config_entries.OptionsFlow):
    """Options: default zone run duration."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.FlowResult:
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        current = self.config_entry.options.get(CONF_DEFAULT_DURATION_MIN, DEFAULT_DURATION_MIN)
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Required(CONF_DEFAULT_DURATION_MIN, default=current): vol.All(
                    int, vol.Range(min=1, max=120)
                )
            }),
        )
