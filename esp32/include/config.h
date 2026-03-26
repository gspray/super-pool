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

// How often (ms) to poll for a remote config update
#define CONFIG_POLL_MS 60000

// ── NTP time sync ─────────────────────────────────────────────────────────────
// Primary NTP server
#define NTP_SERVER "pool.ntp.org"

// POSIX timezone string — controls local time AND DST automatically.
// Find yours at: https://github.com/nayarsystems/posix_tz_db/blob/master/zones.csv
// Examples:
//   UTC           "UTC0"
//   US Eastern    "EST5EDT,M3.2.0,M11.1.0"
//   US Central    "CST6CDT,M3.2.0,M11.1.0"
//   US Mountain   "MST7MDT,M3.2.0,M11.1.0"
//   US Pacific    "PST8PDT,M3.2.0,M11.1.0"
//   UK            "GMT0BST,M3.5.0/1,M10.5.0"
//   CET (Europe)  "CET-1CEST,M3.5.0,M10.5.0/3"
#define NTP_TZ "PST8PDT,M3.2.0,M11.1.0"

// Re-sync NTP every this many milliseconds (7200000 = 2 hours)
#define NTP_RESYNC_MS 7200000UL

// ── Battery monitor ───────────────────────────────────────────────────────────
// Connect battery+ → R1 → ADC pin → R2 → GND  (voltage divider)
// Set BATTERY_ADC_PIN to the GPIO number, or -1 to disable.
// For a 1S LiPo (4.2V max) a 100kΩ / 100kΩ divider keeps the ADC ≤ 2.1V.
#define BATTERY_ADC_PIN   -1    // e.g. 0 on ESP32-C3 — set to your pin
#define BATTERY_R1_KOHM   100   // Upper resistor (kΩ, battery+ side)
#define BATTERY_R2_KOHM   100   // Lower resistor (kΩ, GND side)
#define BATTERY_FULL_MV   4200  // mV = 100 %  (LiPo fully charged)
#define BATTERY_EMPTY_MV  3000  // mV =   0 %  (LiPo safe cutoff)
