# Super Pool Controller — Wiring Guide

**Hardware:** Seeed Studio XIAO ESP32-C3 · 4-Channel Opto-Isolated Relay Board · 24VAC Irrigation Transformer · (optional) 1S LiPo battery

---

## Table of Contents

1. [Parts List](#1-parts-list)
2. [System Overview](#2-system-overview)
3. [ESP32-C3 Pinout Reference](#3-esp32-c3-pinout-reference)
4. [ESP32 → Relay Board](#4-esp32--relay-board)
5. [Relay Board → Solenoids (24VAC)](#5-relay-board--pool devices-24vac)
6. [Power Supply](#6-power-supply)
7. [Battery Monitor (optional)](#7-battery-monitor-optional)
8. [Complete Wiring Diagram](#8-complete-wiring-diagram)
9. [firmware config.h Reference](#9-firmware-configh-reference)
10. [Testing & Verification](#10-testing--verification)

---

## 1. Parts List

| Item                                | Notes                                                       |
| ----------------------------------- | ----------------------------------------------------------- |
| Seeed Studio XIAO ESP32-C3          | Microcontroller — has built-in LiPo charge circuit          |
| 4-channel opto-isolated relay board | 5V coil, active HIGH trigger                                |
| 24VAC pool/AC transformer        | e.g. Orbit 57040 or Hunter AC-2412 — ~1A minimum            |
| **4× 10kΩ resistors (required)**    | **Pull-ups on relay IN pins — prevents boot-time firing**   |
| 2× 100kΩ resistors                  | For battery voltage divider (only if using battery monitor) |
| 1S LiPo battery                     | 3.7V nominal — plugs into XIAO's onboard JST connector      |
| Pool devices           | Standard 24VAC ½" or ¾" valves                              |
| Wire                                | 18–22 AWG for low-voltage runs                              |

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│  120VAC Outlet                                              │
│      │                                                      │
│  [24VAC Transformer]                                        │
│      │ HOT ──────────────────────── Relay COM rail          │
│      │ COMMON ────────────────────── Solenoid common wire   │
│                                                             │
│  [ESP32-C3] ──── GPIO 2/3/4/5 ──── [4-CH Relay Board]      │
│                                         │   │   │   │       │
│                                        NO1 NO2 NO3 NO4      │
│                                         │   │   │   │       │
│                                       Zone1 Z2  Z3  Z4      │
│                                       pool device wires        │
└─────────────────────────────────────────────────────────────┘
```

The ESP32 controls relay coils (3.3V logic). The relay switches the 24VAC circuit to each pool device. The two sides are fully isolated by the opto-couplers.

---

## 3. ESP32-C3 Pinout Reference

```
XIAO ESP32-C3 (top view, USB-C connector on top)

              ┌──[USB-C]──┐
          5V ─┤           ├─ 5V (VIN)
         GND ─┤           ├─ GND
         3V3 ─┤           ├─ D10 / GPIO10
  D0 / GPIO2 ─┤           ├─ D9  / GPIO9   ← BOOT button
  D1 / GPIO3 ─┤  RST BOOT ├─ D8  / GPIO8
  D2 / GPIO4 ─┤           ├─ D7  / GPIO20  (RX)
  D3 / GPIO5 ─┤           ├─ D6  / GPIO21  (TX)
  D4 / GPIO6 ─┘           └─ (antenna pad)
  D5 / GPIO7
```

**Zone relay pins (left side):**

| Firmware label | Board label | GPIO   | Notes                                          |
| -------------- | ----------- | ------ | ---------------------------------------------- |
| Zone 1         | D1          | GPIO3  | Safe — no boot function                        |
| Zone 2         | D10         | GPIO10 | Safe — no boot function                        |
| Zone 3         | D7          | GPIO20 | Safe — UART0 RX, unused (USB-CDC used instead) |
| Zone 4         | D6          | GPIO21 | Safe — UART0 TX, unused (USB-CDC used instead) |
| Status LED     | D0          | GPIO2  | Onboard LED, pulled HIGH at boot (safe)        |

> **Avoid GPIO4–7 (D2–D5) for relay outputs** — these are JTAG pins (MTMS/MTDI/MTCK/MTDO). The bootloader drives them LOW during boot, which fires active-LOW relay boards.
>
> **Avoid:** GPIO8, GPIO9 (strapping pins), GPIO11–17 (internal flash), GPIO18–19 (USB).

---

## 4. ESP32 → Relay Board

### Connections

| XIAO ESP32-C3 | Relay Board | Notes            |
| ------------- | ----------- | ---------------- |
| 5V            | DC+         | Relay coil power |
| GND           | DC-         | Common ground    |
| GPIO 3 (D1)   | IN1         | Zone 1           |
| GPIO 10 (D10) | IN2         | Zone 2           |
| GPIO 20 (D7)  | IN3         | Zone 3           |
| GPIO 21 (D6)  | IN4         | Zone 4           |

### JD-VCC Jumper (if present)

Many relay boards have a **JD-VCC** jumper between the logic side and relay coil side:

-   **Jumper installed (default):** Logic VCC and JD-VCC are bridged — simpler but no isolation between ESP and relay coil noise
-   **Jumper removed (recommended):** Power JD-VCC separately from 5V; logic side powers from the ESP's 3.3V pin. Fully isolates the ESP from inductive kickback

```
Jumper removed wiring:
  ESP 3.3V ──── VCC  (logic supply)
  ESP GND  ──── GND
  5V PSU   ──── JD-VCC  (relay coil supply)
  5V GND   ──── GND (shared)
```

### ⚠️ Required: Pull-up Resistors on IN Pins

Active-LOW relay boards pull their IN pins LOW through the opto-coupler's internal circuitry when the signal floats. The ESP32-C3 ROM bootloader runs before any user code — all GPIO pins are undriven inputs during this window — so all 4 relays fire on every boot.

**Fix: wire a 10kΩ resistor from each IN pin to 3.3V.** This holds IN HIGH during boot regardless of what the ESP32 is doing.

```
3V3 ──┬──┬──┬──┬──
      R   R   R   R    (10kΩ each)
      │   │   │   │
     IN1 IN2 IN3 IN4   (relay board)
      │   │   │   │
    GPIO3 10 20  21    (ESP32-C3)
```

This is a **hardware-only fix** — no firmware change can prevent boot-time firing because the ROM runs before any code.

### Active HIGH logic

This relay board activates when the input pin is driven **HIGH**. The firmware is configured for this:

```cpp
// config.h
#define RELAY_ACTIVE_LOW false
```

When a GPIO goes HIGH → opto-coupler conducts → relay coil energises → NO contact closes → pool device opens.

---

## 5. Relay Board → Solenoids (24VAC)

### Relay terminal identification

Each channel has 3 screw terminals:

| Terminal | Meaning                                                         |
| -------- | --------------------------------------------------------------- |
| **COM**  | Common — connect to 24VAC HOT                                   |
| **NO**   | Normally Open — connects to COM when relay fires                |
| **NC**   | Normally Closed — connected to COM when relay is OFF (not used) |

### Solenoid wiring

```
24VAC Transformer
  ├── HOT  ──────────── bridge wire ──── COM1, COM2, COM3, COM4  (all 4 COM terminals)
  └── COMMON ─────────────────────────── White wire (runs to all pool devices in yard)

Relay board:
  NO1 ──── Zone 1 pool device wire (e.g. red)
  NO2 ──── Zone 2 pool device wire (e.g. blue)
  NO3 ──── Zone 3 pool device wire (e.g. green)
  NO4 ──── Zone 4 pool device wire (e.g. yellow)

Each pool device has 2 wires:
  Wire 1 ──── relay NO terminal (zone-specific color)
  Wire 2 ──── common rail (white wire, back to transformer COMMON)
```

### Bridging the COM terminals

Run a short jumper wire between all four COM screw terminals on the relay board so all channels share the same 24VAC HOT:

```
Transformer HOT ──── COM1 ──┬── COM2 ──┬── COM3 ──┬── COM4
                            │          │           │
                        (bridge)   (bridge)   (bridge)
```

> **Note:** Pool devices are not polarity-sensitive — it does not matter which pool device wire goes to NO vs the common rail.

---

## 6. Power Supply

### Normal operation (USB/wall power)

Power the XIAO via USB-C from a standard 5V USB adapter located in your enclosure. The onboard regulator steps this down to 3.3V for the ESP32 logic.

### Relay board power

The relay board coils need 5V. Run a wire from the XIAO's **5V pin** to the relay board's **VCC**.

> Make sure your USB adapter can supply enough current:
>
> -   ESP32-C3: ~150mA peak
> -   Each relay coil: ~70–90mA
> -   4 relays simultaneously: ~360mA
> -   **Recommended: 1A USB adapter minimum**

### 24VAC transformer

Plug into a standard 120VAC outlet nearby. Most pool/AC transformers output 24VAC at 500mA–1A. Each pool device draws ~200–300mA when energised.

> Only one zone runs at a time (enforced by firmware), so a 500mA transformer handles any single pool device.

---

## 7. Battery Monitor (optional)

The XIAO ESP32-C3 has a **built-in LiPo charge circuit** — connect a 1S LiPo directly to the JST-PH connector on the back of the board. It charges automatically when USB is connected and powers the ESP when USB is removed.

### Voltage divider for ADC monitoring

The LiPo voltage (3.0–4.2V) must be scaled down before connecting to the ADC (max 3.3V input).

**Circuit:**

```
LiPo+ ──── R1 (100kΩ) ──┬──── GPIO0 (A0)  ← ADC input
                         │
                        R2 (100kΩ)
                         │
                        GND
```

This creates a 2:1 divider:

-   4.2V (full) → 2.1V at ADC ✓
-   3.0V (empty) → 1.5V at ADC ✓

### Enable in config.h

```cpp
#define BATTERY_ADC_PIN   0      // GPIO0 = A0 on XIAO ESP32-C3
#define BATTERY_R1_KOHM   100
#define BATTERY_R2_KOHM   100
#define BATTERY_FULL_MV   4200   // 100% = 4.2V
#define BATTERY_EMPTY_MV  3000   // 0%   = 3.0V
```

### What you get

-   Battery `%` reported in `GET /api/status` as `batteryPct`
-   Battery bar indicator shown in the PWA header when a battery is detected
-   HA integration exposes it as a sensor entity

> **Tip:** Use 1% tolerance resistors for accurate readings. Standard 5% resistors work but may read ±5%.

---

## 8. Complete Wiring Diagram

```
                      ┌─────────────────────────────────────┐
  120VAC ─────────────│  24VAC Transformer                  │
  outlet              │  Output: 24VAC @ 500mA+             │
                      └──────┬──────────────┬───────────────┘
                           HOT            COMMON
                             │                │
                         ────┼────            └────────── White wire
                        COM1─┤              (runs to all pool device
                        COM2─┤               commons in yard)
                        COM3─┤
                        COM4─┘ (all bridged together)
                              │
                     ┌────────┴────────────────────┐
                     │   4-Channel Relay Board      │
                     │                              │
    GPIO2 ────IN1────│    NO1 ──── Zone 1 wire      │
    GPIO3 ────IN2────│    NO2 ──── Zone 2 wire      │
    GPIO4 ────IN3────│    NO3 ──── Zone 3 wire      │
    GPIO5 ────IN4────│    NO4 ──── Zone 4 wire      │
      5V ────VCC     │                              │
     GND ────GND     └──────────────────────────────┘

  ┌──────────────────────────────────┐
  │   XIAO ESP32-C3  (USB-C on top)      │
  │                                      │
  │  USB-C ── 5V USB adapter             │
  │  JST   ── 1S LiPo (optional)         │
  │                                      │
  │  LEFT SIDE (top→bottom):             │
  │    5V  ──────────────── DC+ relay    │
  │    GND ──────────────── DC- relay    │
  │    D0 / GPIO2  ←─ Status LED (onboard)│
  │    D1  / GPIO3   ──── IN1 (Zone 1)    │
  │    D10 / GPIO10  ──── IN2 (Zone 2)    │
  │    D7  / GPIO20  ──── IN3 (Zone 3)    │
  │    D6  / GPIO21  ──── IN4 (Zone 4)    │
  └──────────────────────────────────────┘
```

---

## 9. Firmware config.h Reference

Current settings in [`esp32/include/config.h`](esp32/include/config.h):

```cpp
#define MAX_ZONES        4
#define RELAY_ACTIVE_LOW false  // active HIGH board

constexpr int RELAY_PINS[MAX_ZONES] = { 3, 10, 20, 21 };
//                                    Zone: 1   2   3   4
// GPIO3=D1, GPIO10=D10, GPIO20=D7, GPIO21=D6
// Avoids JTAG pins GPIO4-7 which are driven LOW at boot.

#define HOSTNAME         "esp-super-pool"   // → http://esp-super-pool.local
#define NTP_TZ           "PST8PDT,M3.2.0,M11.1.0"  // US Pacific

// Battery (disabled until wired up)
#define BATTERY_ADC_PIN  -1   // set to 0 when voltage divider is connected
```

### To add a 5th–8th zone later

1. Get an 8-channel relay board
2. Update `config.h`:
    ```cpp
    #define MAX_ZONES 8
    constexpr int RELAY_PINS[MAX_ZONES] = { 2, 3, 4, 5, 6, 7, 8, 10 };
    ```
3. Re-upload firmware
4. Add zones in the PWA Settings → Edit Zones

---

## 10. Testing & Verification

### Step 1 — Test relay board without pool devices

With just the ESP32 + relay board connected (no 24VAC yet):

1. Open the PWA at `http://192.168.86.85:3010`
2. Tap a zone to run it for 1 minute
3. You should hear the relay **click** and the board's LED for that channel should light up
4. Tap **All Off** — relay clicks off

### Step 2 — Test with 24VAC (no pool devices)

1. Connect the transformer to the relay COM rail
2. Use a multimeter set to AC voltage
3. Run a zone — measure between NO and GND → should read ~24VAC
4. All Off → back to 0VAC

### Step 3 — Full test with pool devices

1. Connect zone wires
2. Run each zone for 30 seconds
3. Walk the yard and verify each valve opens and water flows
4. Check for leaks at valve bodies

### Fault indicators

| Symptom                                | Likely cause                                                     |
| -------------------------------------- | ---------------------------------------------------------------- |
| Relay clicks but pool device doesn't open | Check 24VAC at COM; check pool device common wire                   |
| Zone runs but wrong valve opens        | Zone wires swapped — remap in PWA Settings                       |
| Relay doesn't click                    | Check IN pin wiring; verify `RELAY_ACTIVE_LOW false` in config.h |
| All zones run simultaneously           | Common wire disconnected from transformer                        |
| ESP won't connect to WiFi              | Check `esp32/include/secrets.h` credentials                      |
