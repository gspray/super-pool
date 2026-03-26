/*
  main.cpp — ESP32 Sprinkler Controller (PlatformIO)
  ─────────────────────────────────────────────────────────────────────────────
  Endpoints
    GET  /api/status          current state
    GET  /api/config          full config (zones, schedules, configVersion)
    POST /api/config          save full config to LittleFS
    POST /api/manual          turn a zone ON (with timer) or OFF

  Discovery
    mDNS service  _sprinklerapi._tcp.local
    TXT records   id=<CONTROLLER_ID>  api=1  model=SprayCtrl

  Security:  every request must carry  x-api-key: <API_KEY>  (see secrets.h)
  Safety:    self-contained timer shuts the zone off regardless of network state

  Edit include/config.h   for GPIO map, zone count, and behaviour.
  Edit include/secrets.h  for WiFi credentials, API key, and CONTROLLER_ID.
  ─────────────────────────────────────────────────────────────────────────────
*/

#include <Arduino.h>
#include <LittleFS.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <ArduinoJson.h>

#include <time.h>
#include "config.h"
#include "secrets.h"

// ─── Forward declarations ────────────────────────────────────────────────────
void allOff();
bool checkAuth();
void setCorsHeaders();
void sendUnauthorized();
void sendBadRequest(const char* msg);
void handleStatus();
void handleGetConfig();
void handlePostConfig();
void handleManual();
void handleGetTime();
void handlePostTime();
void handleDebug();
void connectWiFi();
void syncNTP();
void advertiseMDNS();
void loadConfig();
void saveConfig();
int  readBatteryPct();
void checkSchedules();

// ─── Runtime state ───────────────────────────────────────────────────────────
WebServer server(80);

int  activeZone        = 0;      // 0 = none running
bool manualRun         = false;
bool scheduledRun      = false;  // true when triggered by schedule, false when manual
int  activeScheduleIdx = -1;     // index of the schedule slot that fired (-1 = none)
unsigned long stopAtMillis = 0;  // millis() when active zone timer expires
int  configVersion = 0;
String configJson  = "{}";   // full config blob persisted to /config.json

unsigned long lastWifiCheck  = 0;
unsigned long lastSchedCheck = 0;
unsigned long lastHeartbeat  = 0;
unsigned long lastNtpSync    = 0;  // millis() of last successful NTP sync
int  lastSchedMinute = -1;   // HH*60+MM of last schedule we acted on
int  tzOffsetMin     = 0;    // kept for /api/debug display; NTP drives actual local time

// ─── Relay helpers ───────────────────────────────────────────────────────────
inline void relayOn(int pin)  {
    Serial.printf("[relay] pin %d -> %s (ACTIVE_LOW=%d)\n", pin, RELAY_ACTIVE_LOW ? "LOW" : "HIGH", RELAY_ACTIVE_LOW);
    digitalWrite(pin, RELAY_ACTIVE_LOW ? LOW  : HIGH);
}
inline void relayOff(int pin) { digitalWrite(pin, RELAY_ACTIVE_LOW ? HIGH : LOW);  }

void allOff() {
    for (int i = 0; i < MAX_ZONES; i++) relayOff(RELAY_PINS[i]);
    activeZone        = 0;
    manualRun         = false;
    scheduledRun      = false;
    activeScheduleIdx = -1;
    stopAtMillis      = 0;
    Serial.println("[relay] all zones OFF");
}

// ─── Battery monitor ─────────────────────────────────────────────────────────
// Returns 0-100, or -1 if BATTERY_ADC_PIN is disabled.
int readBatteryPct() {
    if (BATTERY_ADC_PIN < 0) return -1;
    // Average 8 ADC samples to reduce noise
    long sum = 0;
    for (int i = 0; i < 8; i++) { sum += analogRead(BATTERY_ADC_PIN); delay(2); }
    int raw = (int)(sum / 8);
    // 12-bit ADC, 3.3 V reference  →  0..4095 represents 0..3300 mV
    int adcMv = (raw * 3300) / 4095;
    // Recover full battery voltage from the divider ratio
    int batMv = adcMv * (BATTERY_R1_KOHM + BATTERY_R2_KOHM) / BATTERY_R2_KOHM;
    batMv = constrain(batMv, BATTERY_EMPTY_MV, BATTERY_FULL_MV);
    return (int)map(batMv, BATTERY_EMPTY_MV, BATTERY_FULL_MV, 0, 100);
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Must be called before server.send() in every handler so browsers can call us.
void setCorsHeaders() {
    server.sendHeader("Access-Control-Allow-Origin",  "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
bool checkAuth() {
    if (!server.hasHeader("x-api-key")) return false;
    return server.header("x-api-key") == String(API_KEY);
}

void sendUnauthorized() {
    setCorsHeaders();
    server.send(401, "application/json", "{\"error\":\"unauthorized\"}");
}

void sendBadRequest(const char* msg) {
    setCorsHeaders();
    String j = "{\"error\":\"";
    j += msg;
    j += "\"}";
    server.send(400, "application/json", j);
}

// ─── Config persistence (LittleFS) ────────────────────────────────────────────
void loadConfig() {
    if (!LittleFS.exists("/config.json")) {
        Serial.println("[fs] no config.json — using defaults");
        return;
    }
    File f = LittleFS.open("/config.json", "r");
    if (!f) { Serial.println("[fs] open failed"); return; }
    configJson = f.readString();
    f.close();

    JsonDocument doc;
    if (!deserializeJson(doc, configJson)) {
        configVersion = doc["configVersion"] | 0;
        tzOffsetMin   = doc["tzOffsetMin"]   | 0;
        Serial.printf("[fs] loaded config version %d  tzOffset=%d\n", configVersion, tzOffsetMin);
    }
}

void saveConfig() {
    File f = LittleFS.open("/config.json", "w");
    if (!f) { Serial.println("[fs] write failed"); return; }
    f.print(configJson);
    f.close();
    Serial.printf("[fs] saved config version %d (%d bytes)\n",
                  configVersion, configJson.length());
}

// ─── GET /api/status ──────────────────────────────────────────────────────────
void handleStatus() {
    if (!checkAuth()) return sendUnauthorized();

    unsigned long now = millis();
    int remaining = 0;
    if (manualRun && now < stopAtMillis) {
        remaining = (int)((stopAtMillis - now) / 1000UL);
    }

    JsonDocument doc;
    doc["online"]            = true;
    doc["id"]                = CONTROLLER_ID;
    doc["activeZone"]        = activeZone;
    doc["manualRun"]         = manualRun;
    doc["scheduledRun"]      = scheduledRun;
    doc["activeScheduleIdx"] = activeScheduleIdx;
    doc["remainingSec"]      = remaining;
    doc["configVersion"]     = configVersion;

    int batPct = readBatteryPct();
    if (batPct >= 0) doc["batteryPct"] = batPct;

    String out;
    serializeJson(doc, out);
    setCorsHeaders();
    server.send(200, "application/json", out);
}

// ─── GET /api/config ──────────────────────────────────────────────────────────
void handleGetConfig() {
    if (!checkAuth()) return sendUnauthorized();
    setCorsHeaders();
    server.send(200, "application/json", configJson);
}

// ─── POST /api/config ─────────────────────────────────────────────────────────
void handlePostConfig() {
    if (!checkAuth()) return sendUnauthorized();

    String body = server.arg("plain");
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, body);
    if (err) return sendBadRequest("invalid JSON");

    // Always increment configVersion so clients can detect staleness
    configVersion = (doc["configVersion"] | configVersion) + 1;
    doc["configVersion"] = configVersion;
    // Preserve tzOffsetMin — it's set via POST /api/time and must survive config saves
    doc["tzOffsetMin"] = tzOffsetMin;

    serializeJson(doc, configJson);
    saveConfig();

    setCorsHeaders();
    String out = "{\"ok\":true,\"configVersion\":" + String(configVersion) + "}";
    server.send(200, "application/json", out);
}

// ─── POST /api/manual ─────────────────────────────────────────────────────────
void handleManual() {
    if (!checkAuth()) return sendUnauthorized();

    JsonDocument req;
    DeserializationError err = deserializeJson(req, server.arg("plain"));
    if (err) return sendBadRequest("invalid JSON");

    int  zone   = req["zone"]        | 0;
    bool on     = req["on"]          | false;
    int  durMin = req["durationMin"] | 10;

    // zone 0 or on:false = ALL OFF
    if (zone == 0 || !on) {
        allOff();
        setCorsHeaders();
        server.send(200, "application/json",
            "{\"ok\":true,\"activeZone\":0,\"manualRun\":false,\"remainingSec\":0}");
        return;
    }

    if (zone < 1 || zone > MAX_ZONES) return sendBadRequest("zone out of range");

    allOff();
    activeZone   = zone;
    manualRun    = true;
    scheduledRun = false;
    stopAtMillis = millis() + (unsigned long)durMin * 60000UL;
    relayOn(RELAY_PINS[zone - 1]);
    Serial.printf("[relay] zone %d ON for %d min\n", zone, durMin);

    JsonDocument res;
    res["ok"]          = true;
    res["activeZone"]  = activeZone;
    res["manualRun"]   = manualRun;
    res["remainingSec"]= durMin * 60;
    String out;
    serializeJson(res, out);
    setCorsHeaders();
    server.send(200, "application/json", out);
}

// ─── Schedule checker ─────────────────────────────────────────────────────────
void checkSchedules() {
    time_t utcNow;
    time(&utcNow);

    // ── Clock guard ────────────────────────────────────────────────────────
    if (utcNow < 1000000000L) {
        Serial.printf("[sched] SKIP clock not synced (epoch=%ld)\n", (long)utcNow);
        return;
    }

    // ── Local time via POSIX TZ set by configTzTime (handles DST) ─────────────
    struct tm lt;
    localtime_r(&utcNow, &lt);

    int secondNow   = lt.tm_sec;
    int minuteOfDay = lt.tm_hour * 60 + lt.tm_min;
    int appDay      = (lt.tm_wday == 0) ? 6 : lt.tm_wday - 1;
    const char* dayNames[] = {"Mon","Tue","Wed","Thu","Fri","Sat","Sun"};

    // ── Minute-boundary gating (silently skip seconds 30-59) ─────────────────
    if (secondNow >= 30) return;

    // Only log and evaluate once per minute
    if (minuteOfDay == lastSchedMinute) return;

    // Log now that we know it's a new, actionable minute
    Serial.printf("[sched] --- NEW MINUTE %d local=%02d:%02d %s appDay=%d tz=%+d manualRun=%d ---\n",
                  minuteOfDay, lt.tm_hour, lt.tm_min, dayNames[appDay],
                  appDay, tzOffsetMin, manualRun);

    lastSchedMinute = minuteOfDay;

    if (manualRun) {
        Serial.printf("[sched] SKIP — zone %d already running (manual=%d scheduled=%d)\n",
                      activeZone, manualRun, scheduledRun);
        return;
    }

    // ── Parse config ───────────────────────────────────────────────────────
    Serial.printf("[sched] configJson len=%d  first80=%.80s\n",
                  configJson.length(), configJson.c_str());

    JsonDocument doc;
    DeserializationError derr = deserializeJson(doc, configJson);
    if (derr != DeserializationError::Ok) {
        Serial.printf("[sched] CONFIG PARSE ERROR: %s\n", derr.c_str());
        return;
    }

    JsonArray zones = doc["zones"].as<JsonArray>();
    if (!zones || zones.size() == 0) {
        Serial.println("[sched] NO ZONES in config — nothing to check");
        return;
    }
    Serial.printf("[sched] %d zone(s) in config\n", (int)zones.size());

    // ── Walk zones & schedules ─────────────────────────────────────────────
    for (JsonObject zone : zones) {
        int zoneId = zone["id"] | 0;
        Serial.printf("[sched]  zone id=%d\n", zoneId);

        if (zoneId < 1 || zoneId > MAX_ZONES) {
            Serial.printf("[sched]   SKIP — id %d out of range [1..%d]\n", zoneId, MAX_ZONES);
            continue;
        }

        JsonArray schedules = zone["schedules"].as<JsonArray>();
        if (!schedules || schedules.size() == 0) {
            Serial.println("[sched]   no schedules on this zone");
            continue;
        }
        Serial.printf("[sched]   %d schedule(s)\n", (int)schedules.size());

        int si = 0;
        for (JsonObject sched : schedules) {
            bool enabled    = sched["enabled"] | false;
            const char* st  = sched["startTime"] | "";
            int durMin      = sched["durationMin"] | 0;
            int sh = 0, sm = 0;
            int parsed      = sscanf(st, "%d:%d", &sh, &sm);
            int schedMinute = sh * 60 + sm;
            bool timeMatch  = (schedMinute == minuteOfDay);

            // Print full days array
            JsonArray days = sched["days"].as<JsonArray>();
            char daysStr[24] = "[null]";
            bool dayMatch = false;
            if (days) {
                daysStr[0] = '[';
                int pos = 1;
                for (int d = 0; d < 7; d++) {
                    bool v = days[d].as<bool>();
                    if (d == appDay) dayMatch = v;
                    daysStr[pos++] = v ? '1' : '0';
                    if (d < 6) daysStr[pos++] = ',';
                }
                daysStr[pos++] = ']';
                daysStr[pos]   = '\0';
            }

            Serial.printf("[sched]   [%d] enabled=%d time='%s'(parsed=%d) dur=%d schedMin=%d curMin=%d timeMatch=%d days=%s dayMatch=%d\n",
                          si, enabled, st, parsed, durMin,
                          schedMinute, minuteOfDay, timeMatch,
                          daysStr, dayMatch);

            if (!enabled)  { Serial.println("[sched]    -> SKIP not enabled");  si++; continue; }
            if (!dayMatch) { Serial.printf("[sched]    -> SKIP day %d (%s) not set\n", appDay, dayNames[appDay]); si++; continue; }
            if (!timeMatch){ Serial.printf("[sched]    -> SKIP time %02d:%02d != cur %02d:%02d\n", sh, sm, lt.tm_hour, lt.tm_min); si++; continue; }

            // ── FIRE ──────────────────────────────────────────────────────
            int pin = RELAY_PINS[zoneId - 1];
            Serial.printf("[sched] >>> FIRING zone %d pin=%d for %d min <<<\n", zoneId, pin, durMin);
            allOff();
            activeZone        = zoneId;
            manualRun         = true;
            scheduledRun      = true;
            activeScheduleIdx = si;
            stopAtMillis      = millis() + (unsigned long)durMin * 60000UL;
            relayOn(pin);
            Serial.printf("[sched] relay ON — zone=%d schedIdx=%d pin=%d stopAt=%lu now=%lu\n",
                          zoneId, si, pin, stopAtMillis, millis());
            return;

            si++;
        }
    }
    Serial.println("[sched] no schedule matched this minute");
}

// ─── GET /api/debug ───────────────────────────────────────────────────────────
void handleDebug() {
    if (!checkAuth()) return sendUnauthorized();

    time_t utcNow;
    time(&utcNow);
    struct tm lt;
    localtime_r(&utcNow, &lt);  // uses POSIX TZ set by configTzTime

    char localStr[32], utcStr[32];
    strftime(localStr, sizeof(localStr), "%Y-%m-%dT%H:%M:%S", &lt);
    struct tm utci;
    gmtime_r(&utcNow, &utci);
    strftime(utcStr, sizeof(utcStr), "%Y-%m-%dT%H:%M:%SZ", &utci);

    int appDay = (lt.tm_wday == 0) ? 6 : lt.tm_wday - 1;
    const char* dayNames[] = {"Mon","Tue","Wed","Thu","Fri","Sat","Sun"};

    JsonDocument out;
    out["utc"]          = utcStr;
    out["local"]        = localStr;
    out["ntpTz"]        = NTP_TZ;
    out["ntpServer"]    = NTP_SERVER;
    out["lastNtpSyncMs"]= (long)lastNtpSync;
    out["tzOffsetMin"]  = tzOffsetMin;
    out["clockSynced"]  = (utcNow > 1000000000L);
    out["appDay"]       = appDay;
    out["dayName"]      = dayNames[appDay];
    out["minuteOfDay"]  = lt.tm_hour * 60 + lt.tm_min;
    out["manualRun"]    = manualRun;
    out["activeZone"]   = activeZone;
    out["configLen"]    = (int)configJson.length();

    // Summarise each schedule
    JsonDocument cfg;
    JsonArray schedSummary = out["schedules"].to<JsonArray>();
    if (deserializeJson(cfg, configJson) == DeserializationError::Ok) {
        JsonArray zones = cfg["zones"].as<JsonArray>();
        if (zones) {
            for (JsonObject zone : zones) {
                int zid = zone["id"] | 0;
                JsonArray scheds = zone["schedules"].as<JsonArray>();
                if (!scheds) continue;
                for (JsonObject s : scheds) {
                    JsonObject row = schedSummary.add<JsonObject>();
                    row["zone"]        = zid;
                    row["enabled"]     = s["enabled"] | false;
                    row["startTime"]   = s["startTime"] | "";
                    row["durationMin"] = s["durationMin"] | 0;
                    JsonArray days = s["days"].as<JsonArray>();
                    row["dayMatch"]    = days && days[appDay].as<bool>();
                    // parse time match
                    const char* st = s["startTime"] | "";
                    int sh = 0, sm = 0;
                    sscanf(st, "%d:%d", &sh, &sm);
                    row["timeMatch"]   = (sh * 60 + sm == lt.tm_hour * 60 + lt.tm_min);
                }
            }
        }
    }

    String body;
    serializeJsonPretty(out, body);
    setCorsHeaders();
    server.send(200, "application/json", body);
}

// ─── GET /api/time ──────────────────────────────────────────────────────────
void handleGetTime() {
    if (!checkAuth()) return sendUnauthorized();

    time_t now;
    time(&now);

    char iso[32];
    struct tm* ti = gmtime(&now);
    strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", ti);

    JsonDocument doc;
    doc["epoch"] = (long long)now;
    doc["iso"]   = iso;

    String out;
    serializeJson(doc, out);
    setCorsHeaders();
    server.send(200, "application/json", out);
}

// ─── POST /api/time ──────────────────────────────────────────────────────────
void handlePostTime() {
    if (!checkAuth()) return sendUnauthorized();

    JsonDocument req;
    DeserializationError err = deserializeJson(req, server.arg("plain"));
    if (err) return sendBadRequest("invalid JSON");

    long long epoch = req["epoch"] | 0LL;
    if (epoch < 1000000000LL) return sendBadRequest("epoch out of range");

    // Optional timezone offset in minutes (JS: -new Date().getTimezoneOffset())
    if (!req["tzOffsetMin"].isNull()) {
        tzOffsetMin = req["tzOffsetMin"] | 0;
        Serial.printf("[time] timezone offset set to %d min\n", tzOffsetMin);

        // Persist tzOffsetMin inside configJson so it survives reboots
        JsonDocument cfg;
        if (deserializeJson(cfg, configJson) == DeserializationError::Ok) {
            cfg["tzOffsetMin"] = tzOffsetMin;
            serializeJson(cfg, configJson);
            saveConfig();
        }
    }

    struct timeval tv;
    tv.tv_sec  = (time_t)epoch;
    tv.tv_usec = 0;
    settimeofday(&tv, nullptr);

    Serial.printf("[time] clock set to epoch %lld\n", epoch);

    setCorsHeaders();
    server.send(200, "application/json", "{\"ok\":true}");
}

// ─── WiFi + mDNS ──────────────────────────────────────────────────────────────
void advertiseMDNS() {
    if (!MDNS.begin(HOSTNAME)) {
        Serial.println("[mdns] begin failed");
        return;
    }
    // Hostname resolution: http://esp-sprinkler.local
    Serial.printf("[mdns] hostname  http://%s.local\n", HOSTNAME);

    // Service advertisement picked up by Home Assistant zeroconf
    MDNS.addService("sprinklerapi", "tcp", 80);
    MDNS.addServiceTxt("sprinklerapi", "tcp", "id",    CONTROLLER_ID);
    MDNS.addServiceTxt("sprinklerapi", "tcp", "api",   "1");
    MDNS.addServiceTxt("sprinklerapi", "tcp", "model", "SprayCtrl");
    Serial.printf("[mdns] advertising _sprinklerapi._tcp  id=%s\n", CONTROLLER_ID);
}

void connectWiFi() {
    Serial.printf("[wifi] connecting to %s", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.disconnect(true);
    delay(100);
    WiFi.setHostname(HOSTNAME);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    unsigned long t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < 20000) {
        delay(500);
        Serial.print(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[wifi] connected  IP=%s\n", WiFi.localIP().toString().c_str());
        advertiseMDNS();
        syncNTP();
    } else {
        Serial.println("\n[wifi] failed — will retry");
    }
}

// ─── NTP sync ─────────────────────────────────────────────────────────────────
void syncNTP() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[ntp] skipped — WiFi not connected");
        return;
    }
    Serial.printf("[ntp] syncing via %s  tz='%s'\n", NTP_SERVER, NTP_TZ);
    // configTzTime sets both the NTP server AND the POSIX timezone (+ DST rules)
    configTzTime(NTP_TZ, NTP_SERVER);

    // Wait up to 10 s for the first sync
    struct tm ti;
    unsigned long t = millis();
    while (!getLocalTime(&ti, 100) && millis() - t < 10000) delay(200);

    if (getLocalTime(&ti, 0)) {
        char buf[32];
        strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", &ti);
        lastNtpSync = millis();
        // Keep tzOffsetMin updated for display in /api/debug
        time_t utcNow;
        time(&utcNow);
        time_t localNow = mktime(&ti);
        tzOffsetMin = (int)((localNow - utcNow) / 60);
        Serial.printf("[ntp] synced — local=%s  tzOffset=%+d min\n", buf, tzOffsetMin);
    } else {
        Serial.println("[ntp] sync FAILED — will retry in 2 min");
        lastNtpSync = millis() - (NTP_RESYNC_MS - 120000UL); // retry in 2 min
    }
}

// ─── setup ────────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);

    // Wait up to 10 s for the USB-CDC host to open the port
    // ARDUINO_USB_CDC_ON_BOOT=1 enables CDC early; this loop catches slow monitors
    unsigned long t0 = millis();
    while (!Serial && millis() - t0 < 10000) delay(10);
    delay(200);

    Serial.println("\n\n=====================================");
    Serial.println("[boot] ESP32 Sprinkler Controller");
    Serial.println("=====================================");

    // Mount LittleFS (format on first boot if needed)
    if (!LittleFS.begin(true)) {
        Serial.println("[fs] LittleFS mount failed — config will not persist");
    } else {
        Serial.println("[fs] LittleFS mounted");
        loadConfig();
        Serial.printf("[fs] configJson len=%d\n", configJson.length());
        Serial.printf("[fs] configJson=%s\n", configJson.c_str());
    }

    // Init relay pins — all OFF immediately
    for (int i = 0; i < MAX_ZONES; i++) {
        pinMode(RELAY_PINS[i], OUTPUT);
        relayOff(RELAY_PINS[i]);
    }
    Serial.printf("[relay] %d zone pins initialised (all OFF)\n", MAX_ZONES);

    // Init battery ADC pin if configured
    if (BATTERY_ADC_PIN >= 0) {
        pinMode(BATTERY_ADC_PIN, INPUT);
        Serial.printf("[battery] monitoring on pin %d\n", BATTERY_ADC_PIN);
    }

    // Startup test — flash each relay/LED in sequence
    Serial.println("[test] LED startup sequence");
    for (int i = 0; i < MAX_ZONES; i++) {
        relayOn(RELAY_PINS[i]);
        Serial.printf("[test] zone %d ON\n", i + 1);
        delay(500);
        relayOff(RELAY_PINS[i]);
    }
    Serial.println("[test] sequence complete");

    connectWiFi();

    // Capture the x-api-key header on every request
    const char* collectHeaders[] = { "x-api-key" };
    server.collectHeaders(collectHeaders, 1);

    // ── API routes ─────────────────────────────────────────────────────────
    server.on("/api/status", HTTP_GET,     handleStatus);
    server.on("/api/config", HTTP_GET,     handleGetConfig);
    server.on("/api/config", HTTP_POST,    handlePostConfig);
    server.on("/api/manual", HTTP_POST,    handleManual);
    server.on("/api/time",   HTTP_GET,     handleGetTime);
    server.on("/api/time",   HTTP_POST,    handlePostTime);
    server.on("/api/debug",  HTTP_GET,     handleDebug);

    // Explicit OPTIONS preflight handlers for every endpoint
    auto handleOptions = []() {
        setCorsHeaders();
        server.sendHeader("Access-Control-Max-Age", "86400");
        server.send(204);
    };
    server.on("/api/status", HTTP_OPTIONS, handleOptions);
    server.on("/api/config", HTTP_OPTIONS, handleOptions);
    server.on("/api/manual", HTTP_OPTIONS, handleOptions);
    server.on("/api/time",   HTTP_OPTIONS, handleOptions);
    server.on("/api/debug",  HTTP_OPTIONS, handleOptions);

    // Catch-all 404
    server.onNotFound([]() {
        setCorsHeaders();
        server.send(404, "application/json", "{\"error\":\"not found\"}");
    });

    server.begin();
    Serial.println("[http] server started on port 80");
}

// ─── loop ─────────────────────────────────────────────────────────────────────
void loop() {
    server.handleClient();

    unsigned long nowMs = millis();

    // Heartbeat — confirms loop() is running
    if (nowMs - lastHeartbeat >= 10000) {
        lastHeartbeat = nowMs;
        Serial.printf("[loop] alive millis=%lu manualRun=%d activeZone=%d lastNtpSync=%lus lastSchedMin=%d\n",
                      nowMs, manualRun, activeZone, lastNtpSync / 1000, lastSchedMinute);
    }

    // Safety timer: shut zone off when duration expires
    if (manualRun && stopAtMillis > 0 && nowMs >= stopAtMillis) {
        Serial.printf("[timer] zone %d timed out at millis=%lu stopAt=%lu — shutting off\n",
                      activeZone, nowMs, stopAtMillis);
        allOff();
    }

    // NTP re-sync every 2 hours
    if (nowMs - lastNtpSync >= NTP_RESYNC_MS) {
        syncNTP();
    }

    // Schedule checker — runs every 1 s, fires within first 30 s of each minute
    if (nowMs - lastSchedCheck >= 1000) {
        lastSchedCheck = nowMs;
        checkSchedules();
    }

    // WiFi watchdog: reconnect if dropped
    unsigned long now = millis();
    if (now - lastWifiCheck > WIFI_RECONNECT_MS) {
        lastWifiCheck = now;
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("[wifi] connection lost — reconnecting...");
            WiFi.disconnect();
            connectWiFi();
        }
    }
}
