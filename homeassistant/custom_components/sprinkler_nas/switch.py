"""Zone switches — one per zone on the ESP."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_DEFAULT_DURATION_MIN, DEFAULT_DURATION_MIN, DOMAIN
from .coordinator import SprinklerESPCoordinator
from .entity import SprinklerESPEntity

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: SprinklerESPCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        ZoneSwitch(coordinator, entry, zone)
        for zone in coordinator.data.get("zones", [])
    )


class ZoneSwitch(SprinklerESPEntity, SwitchEntity):
    """Controls a single irrigation zone."""

    _attr_icon = "mdi:water"

    def __init__(
        self,
        coordinator: SprinklerESPCoordinator,
        entry: ConfigEntry,
        zone: dict,
    ) -> None:
        super().__init__(coordinator, entry)
        self._zone_id: int = zone["id"]
        self._attr_unique_id = f"{entry.entry_id}_zone_{self._zone_id}"
        self._attr_name = zone.get("name", f"Zone {zone['id']}")

    @property
    def is_on(self) -> bool:
        status = self._status
        return (
            bool(status.get("manualRun"))
            and status.get("activeZone") == self._zone_id
        )

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        attrs: dict[str, Any] = {"zone_id": self._zone_id}
        if self.is_on:
            attrs["remaining_sec"] = self._status.get("remainingSec", 0)
        return attrs

    async def async_turn_on(self, **kwargs: Any) -> None:
        duration = self._entry.options.get(CONF_DEFAULT_DURATION_MIN, DEFAULT_DURATION_MIN)
        await self.coordinator.async_manual(self._zone_id, True, duration)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self.coordinator.async_manual(self._zone_id, False)

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.switch import SwitchDeviceClass, SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_DEFAULT_DURATION_MIN, DEFAULT_DURATION_MIN, DOMAIN
from .coordinator import SprinklerNASCoordinator
from .entity import SprinklerNASEntity

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: SprinklerNASCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list[ZoneSwitch] = []

    for ctrl in coordinator.data.values():
        zones = ctrl.get("config", {}).get("zones", [])
        for zone in zones:
            entities.append(ZoneSwitch(coordinator, entry, ctrl["id"], zone))

    async_add_entities(entities)


class ZoneSwitch(SprinklerNASEntity, SwitchEntity):
    """A switch that controls a single irrigation zone."""

    _attr_device_class = SwitchDeviceClass.SWITCH

    def __init__(
        self,
        coordinator: SprinklerNASCoordinator,
        entry: ConfigEntry,
        ctrl_id: str,
        zone: dict,
    ) -> None:
        super().__init__(coordinator, entry, ctrl_id)
        self._zone_id: int = zone["id"]
        self._zone_name: str = zone.get("name", f"Zone {zone['id']}")
        self._attr_unique_id = f"{entry.entry_id}_{ctrl_id}_zone_{self._zone_id}"
        self._attr_name = self._zone_name

    # ── State ─────────────────────────────────────────────────────────────────

    @property
    def is_on(self) -> bool:
        status = self._status
        return (
            bool(status.get("manualRun"))
            and status.get("activeZone") == self._zone_id
        )

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        status = self._status
        attrs: dict[str, Any] = {}
        if self.is_on:
            attrs["remaining_sec"] = status.get("remainingSec", 0)
            attrs["zone_started_at"] = status.get("zoneStartedAt")
        attrs["zone_id"] = self._zone_id
        return attrs

    # ── Commands ──────────────────────────────────────────────────────────────

    async def async_turn_on(self, **kwargs: Any) -> None:
        duration = self._entry.options.get(CONF_DEFAULT_DURATION_MIN, DEFAULT_DURATION_MIN)
        await self.coordinator.async_manual(self._ctrl_id, self._zone_id, True, duration)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self.coordinator.async_manual(self._ctrl_id, self._zone_id, False)
