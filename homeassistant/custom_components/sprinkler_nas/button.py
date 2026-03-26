"""Button — All Off for the ESP controller."""
from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import SprinklerESPCoordinator
from .entity import SprinklerESPEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: SprinklerESPCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([AllOffButton(coordinator, entry)])


class AllOffButton(SprinklerESPEntity, ButtonEntity):
    """Immediately stops all zones."""

    _attr_icon = "mdi:stop-circle-outline"
    _attr_name = "All Off"

    def __init__(
        self,
        coordinator: SprinklerESPCoordinator,
        entry: ConfigEntry,
    ) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_all_off"

    async def async_press(self) -> None:
        await self.coordinator.async_all_off()

from __future__ import annotations

import logging

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import SprinklerNASCoordinator
from .entity import SprinklerNASEntity

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: SprinklerNASCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        AllOffButton(coordinator, entry, ctrl_id)
        for ctrl_id in coordinator.data
    )


class AllOffButton(SprinklerNASEntity, ButtonEntity):
    """Press to immediately stop all zones on a controller."""

    _attr_icon = "mdi:stop-circle-outline"

    def __init__(
        self,
        coordinator: SprinklerNASCoordinator,
        entry: ConfigEntry,
        ctrl_id: str,
    ) -> None:
        super().__init__(coordinator, entry, ctrl_id)
        self._attr_unique_id = f"{entry.entry_id}_{ctrl_id}_all_off"
        self._attr_name = "All Off"

    async def async_press(self) -> None:
        await self.coordinator.async_all_off(self._ctrl_id)
