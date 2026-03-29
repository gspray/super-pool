"""Base entity for the Super Pool ESP32 integration."""
from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CONF_URL, DOMAIN
from .coordinator import SuperPoolESPCoordinator


class SuperPoolESPEntity(CoordinatorEntity[SuperPoolESPCoordinator]):
    """Base class — one HA device per ESP config entry."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SuperPoolESPCoordinator,
        entry: ConfigEntry,
    ) -> None:
        super().__init__(coordinator)
        self._entry = entry

    # ── Shortcuts ─────────────────────────────────────────────────────────────

    @property
    def _status(self) -> dict:
        return self.coordinator.data.get("status", {})

    @property
    def _zones(self) -> list[dict]:
        return self.coordinator.data.get("zones", [])

    # ── Device info ───────────────────────────────────────────────────────────

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.entry_id)},
            name=self._entry.title,
            manufacturer="SprayCtrl",
            model="ESP32 Super Pool",
            configuration_url=self._entry.data.get(CONF_URL),
        )

