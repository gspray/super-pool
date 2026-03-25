# Sprinkler — ESP32 + Node.js Controller

Replaces a Rain Bird controller with an ESP32 relay board managed by a Node.js app running on a Synology NAS (or any Linux machine).

```
[ Phone / PWA ]
      ↓
[ Node app (NAS) ]
      ↓ HTTP + x-api-key
[ ESP32 @ pool pad ]
      ↓
[ 8-ch Relay board ]
      ↓
[ Irrigation valves ]
```

---

## Directory layout

```
sprinkler/
├── src/
│   ├── index.js                 ← Express server entry point
│   ├── routes/
│   │   └── controllers.js       ← REST API for controller CRUD + ESP proxy
│   ├── services/
│   │   ├── storage.js           ← JSON file persistence
│   │   ├── espClient.js         ← HTTP client for ESP32
│   │   └── poller.js            ← Background status poller
│   └── middleware/
│       └── auth.js              ← x-api-key guard
├── public/                      ← PWA (served as static files)
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── manifest.json
├── esp32/
│   └── sprinkler_esp32.ino      ← Arduino sketch for the ESP32
├── data/                        ← Auto-created; stores controllers.json
├── .env                         ← Local secrets (never commit)
├── .env.example
└── package.json
```

---

## Quick start

### 1 — Node app (NAS / server)

```bash
cp .env.example .env
# edit .env — set API_KEY and optionally PORT
npm install
npm start          # production (plain node)
npm run dev        # nodemon watch mode

# recommended — run under PM2
pm2 start ecosystem.config.js
pm2 save
# then run the sudo command printed by:
pm2 startup
```

Open `http://<NAS-IP>:3010` on your phone.

### 2 — Add your controller via the API (or the PWA ⚙️ panel)

```bash
curl -X POST http://localhost:3000/api/controllers \
  -H "Content-Type: application/json" \
  -d '{"id":"backyard","name":"Backyard","espUrl":"http://192.168.1.50"}'
```

Then set zones:

```bash
curl -X PUT http://localhost:3000/api/controllers/backyard/config \
  -H "Content-Type: application/json" \
  -H "x-api-key: change-me-to-something-secret" \
  -d '{
    "zones": [
      {"id":1,"name":"Front Lawn"},
      {"id":2,"name":"Back Lawn"},
      {"id":3,"name":"Side Gate"},
      {"id":4,"name":"Veggie Beds"}
    ]
  }'
```

---

## NAS API reference

| Method | Path                          | Auth | Description                            |
| ------ | ----------------------------- | ---- | -------------------------------------- |
| GET    | `/api/controllers`            | —    | List all controllers + cached status   |
| POST   | `/api/controllers`            | —    | Create a new controller record         |
| GET    | `/api/controllers/:id`        | —    | Get one controller                     |
| PUT    | `/api/controllers/:id`        | key  | Update name / espUrl                   |
| DELETE | `/api/controllers/:id`        | key  | Remove controller                      |
| GET    | `/api/controllers/:id/status` | —    | Cached status from last poll           |
| GET    | `/api/controllers/:id/config` | —    | Stored config (ESP can pull this)      |
| PUT    | `/api/controllers/:id/config` | key  | Save config, bump version, push to ESP |
| POST   | `/api/controllers/:id/manual` | key  | Proxy manual ON/OFF to ESP             |
| POST   | `/api/controllers/:id/alloff` | key  | Turn all zones off                     |
| GET    | `/api/health`                 | —    | Server heartbeat                       |

For write operations include the header: `x-api-key: <your secret>`

---

## ESP32 API reference

All endpoints require `x-api-key` header.

| Method | Path                 | Description                  |
| ------ | -------------------- | ---------------------------- |
| GET    | `/api/status`        | Current state                |
| POST   | `/api/manual`        | Turn zone on/off             |
| POST   | `/api/config`        | Receive config push from NAS |
| GET    | `/api/configVersion` | Version check for pull model |

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

`zone: 0` is the "all off" signal. The ESP shuts off regardless of which zone is active.

---

## ESP32 setup (PlatformIO)

The firmware lives in `esp32/` as a PlatformIO project.

```
esp32/
├── platformio.ini        ← board, framework, lib dependencies
├── include/
│   ├── config.h          ← GPIO map, zone count, behaviour
│   ├── secrets.h         ← WiFi + API key (gitignored — never committed)
│   └── secrets.h.example ← copy this to secrets.h and fill in
└── src/
    └── main.cpp          ← all firmware logic
```

### 1 — Install PlatformIO

- VS Code: install the **PlatformIO IDE** extension, or
- CLI: `pip install platformio`

### 2 — Credentials

```bash
cp esp32/include/secrets.h.example esp32/include/secrets.h
# then edit secrets.h:
#   WIFI_SSID  your network name
#   WIFI_PASS  your password
#   API_KEY    must match API_KEY in the NAS .env
```

### 3 — GPIO / zone count

Edit `esp32/include/config.h` to match your relay board wiring (`RELAY_PINS[]`) and set `MAX_ZONES`.

### 4 — Build & flash

```bash
cd esp32

# build
pio run

# flash (auto-detects port)
pio run --target upload

# open serial monitor
pio device monitor
```

Or use the PlatformIO sidebar in VS Code (Build ▶ Upload ▶ Monitor).

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

---

## Security

All communication is LAN-only. The shared `x-api-key` provides basic authentication for both NAS ↔ PWA writes and NAS ↔ ESP traffic.

To expose externally: put Nginx in front with TLS and restrict to your IP.

---

## Environment variables

| Variable           | Default      | Description                                      |
| ------------------ | ------------ | ------------------------------------------------ |
| `PORT`             | `3000`       | HTTP port for the Node server                    |
| `API_KEY`          | _(required)_ | Shared secret — set the same value on your ESP32 |
| `POLL_INTERVAL_MS` | `15000`      | How often the NAS polls each ESP (ms)            |
| `DATA_DIR`         | `./data`     | Directory for the JSON database                  |

---

## PWA features

- Dashboard with live controller status (auto-refreshes every 10 s)
- Per-zone **Run** button with duration selector (5 / 10 / 15 / 20 / 30 min)
- Per-zone **Stop** button when zone is active
- **All Off** button per controller
- Online / Offline badge
- Running zone countdown timer
- Settings panel: add, edit, delete controllers and configure zones
- Installable as a home-screen app (PWA manifest + service worker ready)
