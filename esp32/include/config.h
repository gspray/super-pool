#pragma once
// ─────────────────────────────────────────────────────────────────────────────
// config.h — hardware & behaviour settings
// Edit this file to match your wiring and preferences.
// ─────────────────────────────────────────────────────────────────────────────

// ── Relay board ───────────────────────────────────────────────────────────────
// Number of zones / relays
#define MAX_ZONES 8

// GPIO pins — index 0 = zone 1
// ESP32-C3 safe output pins (avoids flash 11-17, USB 18-19)
// Wired to LEDs for testing — swap for relay pins when hardware arrives
constexpr int RELAY_PINS[MAX_ZONES] = { 2, 3, 4, 5, 6, 7, 8, 10 };

// true  = relay activates on LOW  (most common opto-isolated boards)
// false = relay activates on HIGH (LEDs: HIGH = on)
#define RELAY_ACTIVE_LOW false

// ── Network ───────────────────────────────────────────────────────────────────
// mDNS hostname — device will be reachable at <HOSTNAME>.local
#define HOSTNAME "esp-sprinkler"

// Attempt WiFi reconnect after this many ms of being disconnected
#define WIFI_RECONNECT_MS 15000

// ── NAS polling (optional pull model) ────────────────────────────────────────
// Set NAS_URL to pull config from NAS if ESP can't be pushed to.
// Leave empty to disable polling.
#define NAS_URL   ""        // e.g. "http://192.168.1.10:3010"
#define NAS_ID    ""        // controller id, e.g. "backyard"
#define CONFIG_POLL_MS 60000
