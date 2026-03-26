"""Sensors — active zone, remaining time, last seen."""
from __future__ import annotations

from datetime import datetime

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .coordinator import SprinklerESPCoordinator
from .entity import SprinklerESPEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: SprinklerESPCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([
        ActiveZoneSensor(coordinator, entry),
        RemainingTimeSensor(coordinator, entry),
        ConfigVersionSensor(coordinator, entry),
    ])


# ── Active zone ───────────────────────────────────────────────────────────────

class ActiveZoneSensor(SprinklerESPEntity, SensorEntity):
    """Name of the currently running zone, or 'None'."""

    _attr_icon = "mdi:water-pump"
    _attr_name = "Active Zone"

    def __init__(self, coordinator: SprinklerESPCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_active_zone"

    @property
    def native_value(self) -> str:
        status = self._status
        if not status.get("manualRun"):
            return "None"
        zone_id = status.get("activeZone")
        if not zone_id:
            return "None"
        zone = next((z for z in self._zones if z["id"] == zone_id), None)
        return zone["name"] if zone else f"Zone {zone_id}"


# ── Remaining time ────────────────────────────────────────────────────────────

class RemainingTimeSensor(SprinklerESPEntity, SensorEntity):
    """Seconds remaining in the current manual run (0 when idle)."""

    _attr_device_class = SensorDeviceClass.DURATION
    _attr_native_unit_of_measurement = UnitOfTime.SECONDS
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:timer-outline"
    _attr_suggested_display_precision = 0
    _attr_name = "Remaining Time"

    def __init__(self, coordinator: SprinklerESPCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_remaining_sec"

    @property
    def native_value(self) -> int:
        return self._status.get("remainingSec", 0)


# ── Config version ────────────────────────────────────────────────────────────

class ConfigVersionSensor(SprinklerESPEntity, SensorEntity):
    """Current config version on the ESP — useful for diagnosing sync issues."""

    _attr_icon = "mdi:file-check-outline"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_name = "Config Version"
    _attr_entity_registry_enabled_default = False  # hidden by default

    def __init__(self, coordinator: SprinklerESPCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_config_version"

    @property
    def native_value(self) -> int:
        return self.coordinator.data.get("config_version", 0)

from __future__ import annotations

import logging
from datetime import datetime

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

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
    entities: list[SprinklerNASEntity] = []

    for ctrl_id in coordinator.data:
        entities += [
            ActiveZoneSensor(coordinator, entry, ctrl_id),
            RemainingTimeSensor(coordinator, entry, ctrl_id),
            LastSeenSensor(coordinator, entry, ctrl_id),
        ]

    async_add_entities(entities)


# ── Active zone ───────────────────────────────────────────────────────────────

class ActiveZoneSensor(SprinklerNASEntity, SensorEntity):
    """Name of the currently running zone, or 'None'."""

    _attr_icon = "mdi:water-pump"

    def __init__(self, coordinator, entry, ctrl_id):
        super().__init__(coordinator, entry, ctrl_id)
        self._attr_unique_id = f"{entry.entry_id}_{ctrl_id}_active_zone"
        self._attr_name = "Active Zone"

    @property
    def native_value(self) -> str:
        status = self._status
        if not status.get("manualRun"):
            return "None"
        zone_id = status.get("activeZone")
        if zone_id is None or zone_id == 0:
            return "None"
        zones: list[dict] = self._ctrl.get("config", {}).get("zones", [])
        zone = next((z for z in zones if z["id"] == zone_id), None)
        return zone["name"] if zone else f"Zone {zone_id}"


# ── Remaining time ────────────────────────────────────────────────────────────

class RemainingTimeSensor(SprinklerNASEntity, SensorEntity):
    """Seconds remaining in the current manual run."""

    _attr_device_class = SensorDeviceClass.DURATION
    _attr_native_unit_of_measurement = UnitOfTime.SECONDS
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:timer-outline"
    _attr_suggested_display_precision = 0

    def __init__(self, coordinator, entry, ctrl_id):
        super().__init__(coordinator, entry, ctrl_id)
        self._attr_unique_id = f"{entry.entry_id}_{ctrl_id}_remaining_sec"
        self._attr_name = "Remaining Time"

    @property
    def native_value(self) -> int:
        return self._status.get("remainingSec", 0)


# ── Last seen ─────────────────────────────────────────────────────────────────

class LastSeenSensor(SprinklerNASEntity, SensorEntity):
    """Timestamp of the last successful poll from the ESP."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_icon = "mdi:clock-check-outline"

    def __init__(self, coordinator, entry, ctrl_id):
        super().__init__(coordinator, entry, ctrl_id)
        self._attr_unique_id = f"{entry.entry_id}_{ctrl_id}_last_seen"
        self._attr_name = "Last Seen"

    @property
    def native_value(self) -> datetime | None:
        raw = self._status.get("lastSeen")
        if not raw:
            return None
        try:
            return dt_util.parse_datetime(raw)
        except (ValueError, TypeError):
            return None
