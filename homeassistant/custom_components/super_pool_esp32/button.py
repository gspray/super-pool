"""Button — All Off for the ESP controller."""
from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import SuperPoolESPCoordinator
from .entity import SuperPoolESPEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: SuperPoolESPCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([AllOffButton(coordinator, entry)])


class AllOffButton(SuperPoolESPEntity, ButtonEntity):
    """Immediately stops all zones."""

    _attr_icon = "mdi:stop-circle-outline"
    _attr_name = "All Off"

    def __init__(
        self,
        coordinator: SuperPoolESPCoordinator,
        entry: ConfigEntry,
    ) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_all_off"

    async def async_press(self) -> None:
        await self.coordinator.async_all_off()
