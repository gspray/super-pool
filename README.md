# Super Pool — ESP32 Controller

Replaces a Rain Bird controller with an ESP32 relay board. The ESP32 hosts its own HTTP API and PWA directly — no intermediate server required.

```
[ Phone / PWA ]
      ↓ HTTP + x-api-key
[ ESP32 @ pool pad ]
      ↓
[ 8-ch Relay board ]
      ↓
[ Pool devices ]
```

---

## Directory layout

```
super-pool/
├── esp32/
│   ├── platformio.ini        ← board, framework, lib dependencies
│   ├── include/
│   │   ├── config.h          ← GPIO map, zone count, behaviour
│   │   ├── secrets.h         ← WiFi + API key (gitignored — never committed)
│   │   └── secrets.h.example ← copy this to secrets.h and fill in
│   ├── src/
│   │   └── main.cpp          ← all firmware logic
│   └── data/
│       └── index.html        ← PWA served from ESP32 SPIFFS
├── homeassistant/
│   └── custom_components/
│       └── super_pool_esp32/  ← Home Assistant integration
├── upload.ps1                ← build + flash helper
└── WIRING.md
```

---

## ESP32 API reference

All write endpoints require the `x-api-key` header.

| Method | Path                 | Auth | Description                 |
| ------ | -------------------- | ---- | --------------------------- |
| GET    | `/api/status`        | —    | Current zone state          |
| GET    | `/api/config`        | —    | Stored zone config          |
| POST   | `/api/config`        | key  | Save zone config            |
| GET    | `/api/configVersion` | —    | Config version (ETag check) |
| POST   | `/api/manual`        | key  | Turn a zone on/off          |
| GET    | `/api/health`        | —    | Heartbeat                   |

### Manual ON

```json
POST /api/manual
{ "zone": 2, "on": true, "durationMin": 10 }
```

### Manual OFF / All Off

```json
POST /api/manual
{ "zone": 0, "on": false }
```

`zone: 0` is the "all off" signal.

---

## ESP32 setup (PlatformIO)

### 1 — Install PlatformIO

-   VS Code: install the **PlatformIO IDE** extension, or
-   CLI: `pip install platformio`

### 2 — Credentials

```bash
cp esp32/include/secrets.h.example esp32/include/secrets.h
# then edit secrets.h:
#   WIFI_SSID  your network name
#   WIFI_PASS  your password
#   API_KEY    shared secret for the PWA and Home Assistant
```

### 3 — GPIO / zone count

Edit `esp32/include/config.h` to match your relay board wiring (`RELAY_PINS[]`) and set `MAX_ZONES`.

### 4 — Build & flash

```bash
cd esp32

# build
pio run

# flash firmware
pio run --target upload

# flash SPIFFS data (index.html PWA)
pio run --target uploadfs

# open serial monitor
pio device monitor
```

Or use the VS Code task: **ESP32: Upload + Monitor**.

The IP address is printed to the serial monitor on first boot. Assign a **static DHCP lease** on your router for that MAC so the IP never changes.

### Relay wiring (default, active-LOW board)

| Zone | GPIO |
| ---- | ---- |
| 1    | 26   |
| 2    | 27   |
| 3    | 14   |
| 4    | 12   |
| 5    | 13   |
| 6    | 15   |
| 7    | 2    |
| 8    | 4    |

See [WIRING.md](WIRING.md) for full hardware details.

---

## Security

All communication is LAN-only. The shared `API_KEY` set in `secrets.h` provides basic authentication for all write operations.

To expose externally: put Nginx in front with TLS and restrict to your IP.

---

## PWA features

-   Dashboard with live zone status (auto-refreshes)
-   Per-zone **Run** button with duration selector (5 / 10 / 15 / 20 / 30 min)
-   Per-zone **Stop** button when zone is active
-   **Stop All** button
-   Online / Offline badge
-   Running zone countdown timer
-   Settings panel: configure zone names and schedules
-   Installable as a home-screen app (PWA manifest + service worker)

---

## Home Assistant

A custom integration is provided in `homeassistant/custom_components/super_pool_esp32/`.  
Copy that folder to your HA `config/custom_components/` directory and restart. The integration discovers the ESP32 via mDNS or a manually entered IP.
