"""Zone switches — one per zone on the ESP."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_DEFAULT_DURATION_MIN, DEFAULT_DURATION_MIN, DOMAIN
from .coordinator import SuperPoolESPCoordinator
from .entity import SuperPoolESPEntity

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: SuperPoolESPCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        ZoneSwitch(coordinator, entry, zone)
        for zone in coordinator.data.get("zones", [])
    )


class ZoneSwitch(SuperPoolESPEntity, SwitchEntity):
    """Controls a single irrigation zone."""

    _attr_icon = "mdi:water"

    def __init__(
        self,
        coordinator: SuperPoolESPCoordinator,
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
