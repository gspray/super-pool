"""Binary sensor — ESP connectivity."""
from __future__ import annotations

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
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
    async_add_entities([ControllerOnlineSensor(coordinator, entry)])


class ControllerOnlineSensor(SprinklerESPEntity, BinarySensorEntity):
    """True when HA can reach the ESP32."""

    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY
    _attr_name = "Online"

    def __init__(
        self,
        coordinator: SprinklerESPCoordinator,
        entry: ConfigEntry,
    ) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_online"

    @property
    def is_on(self) -> bool:
        return bool(self._status.get("online", False))

from __future__ import annotations

import logging

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
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
        ControllerOnlineSensor(coordinator, entry, ctrl_id)
        for ctrl_id in coordinator.data
    )


class ControllerOnlineSensor(SprinklerNASEntity, BinarySensorEntity):
    """True when the NAS can reach the ESP32 controller."""

    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY

    def __init__(
        self,
        coordinator: SprinklerNASCoordinator,
        entry: ConfigEntry,
        ctrl_id: str,
    ) -> None:
        super().__init__(coordinator, entry, ctrl_id)
        self._attr_unique_id = f"{entry.entry_id}_{ctrl_id}_online"
        self._attr_name = "Online"

    @property
    def is_on(self) -> bool:
        return bool(self._status.get("online", False))
