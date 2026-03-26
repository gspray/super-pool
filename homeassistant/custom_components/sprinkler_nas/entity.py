"""Base entity for Sprinkler NAS (direct ESP mode)."""
from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CONF_URL, DOMAIN
from .coordinator import SprinklerESPCoordinator


class SprinklerESPEntity(CoordinatorEntity[SprinklerESPCoordinator]):
    """Base class — one HA device per ESP config entry."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SprinklerESPCoordinator,
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
            model="ESP32 Sprinkler",
            configuration_url=self._entry.data.get(CONF_URL),
        )

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import SprinklerNASCoordinator


class SprinklerNASEntity(CoordinatorEntity[SprinklerNASCoordinator]):
    """Entity that belongs to a single controller (device)."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SprinklerNASCoordinator,
        entry: ConfigEntry,
        ctrl_id: str,
    ) -> None:
        super().__init__(coordinator)
        self._ctrl_id = ctrl_id
        self._entry = entry

    # ── Helpers ───────────────────────────────────────────────────────────────

    @property
    def _ctrl(self) -> dict:
        """Return the current controller dict from coordinator data."""
        return self.coordinator.data.get(self._ctrl_id, {})

    @property
    def _status(self) -> dict:
        return self._ctrl.get("status", {})

    # ── Device info ───────────────────────────────────────────────────────────

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, f"{self._entry.entry_id}_{self._ctrl_id}")},
            name=self._ctrl.get("name", self._ctrl_id),
            manufacturer="Sprinkler NAS",
            model="ESP32 Controller",
            configuration_url=self._ctrl.get("espUrl"),
        )

    @property
    def available(self) -> bool:
        """Entity is available when the coordinator last update succeeded."""
        return self.coordinator.last_update_success
