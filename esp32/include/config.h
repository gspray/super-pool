#pragma once
// ─────────────────────────────────────────────────────────────────────────────
// config.h — hardware & behaviour settings
// Edit this file to match your wiring and preferences.
// ─────────────────────────────────────────────────────────────────────────────

// ── Relay board ───────────────────────────────────────────────────────────────
// Number of zones / relays
#define MAX_ZONES 8

// GPIO pins — index 0 = zone 1
constexpr int RELAY_PINS[MAX_ZONES] = { 26, 27, 14, 12, 13, 15, 2, 4 };

// true  = relay activates on LOW  (most common opto-isolated boards)
// false = relay activates on HIGH
#define RELAY_ACTIVE_LOW true

// ── Network ───────────────────────────────────────────────────────────────────
// Attempt WiFi reconnect after this many ms of being disconnected
#define WIFI_RECONNECT_MS 15000

// ── NAS polling (optional pull model) ────────────────────────────────────────
// Set NAS_URL to pull config from NAS if ESP can't be pushed to.
// Leave empty to disable polling.
#define NAS_URL   ""        // e.g. "http://192.168.1.10:3010"
#define NAS_ID    ""        // controller id, e.g. "backyard"
#define CONFIG_POLL_MS 60000
