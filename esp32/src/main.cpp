/*
  main.cpp — ESP32 Sprinkler Controller (PlatformIO)
  ─────────────────────────────────────────────────────────────────────────────
  Endpoints
    POST /api/manual          turn a zone ON (with timer) or OFF
    GET  /api/status          current state
    POST /api/config          receive full config push from NAS
    GET  /api/configVersion   quick version check for pull model

  Security:  every request must carry  x-api-key: <API_KEY>  (see secrets.h)
  Safety:    self-contained timer shuts the zone off even if the NAS is silent

  Edit include/config.h   for GPIO map, zone count, and behaviour.
  Edit include/secrets.h  for WiFi credentials and API key (never committed).
  ─────────────────────────────────────────────────────────────────────────────
*/

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

#include "config.h"
#include "secrets.h"

// ─── Forward declarations ────────────────────────────────────────────────────
void allOff();
bool checkAuth();
void sendUnauthorized();
void sendBadRequest(const char* msg);
void handleStatus();
void handleConfigVersion();
void handleManual();
void handleConfig();
void connectWiFi();
void maybePullConfig();

// ─── Runtime state ───────────────────────────────────────────────────────────
WebServer server(80);

int  activeZone    = 0;      // 0 = none running
bool manualRun     = false;
long stopAtMillis  = 0;      // millis() when active zone timer expires
int  configVersion = 0;

unsigned long lastWifiCheck    = 0;
unsigned long lastConfigPoll   = 0;

// ─── Relay helpers ───────────────────────────────────────────────────────────
inline void relayOn(int pin)  { digitalWrite(pin, RELAY_ACTIVE_LOW ? LOW  : HIGH); }
inline void relayOff(int pin) { digitalWrite(pin, RELAY_ACTIVE_LOW ? HIGH : LOW);  }

void allOff() {
    for (int i = 0; i < MAX_ZONES; i++) relayOff(RELAY_PINS[i]);
    activeZone   = 0;
    manualRun    = false;
    stopAtMillis = 0;
    Serial.println("[relay] all zones OFF");
}

// ─── Auth ────────────────────────────────────────────────────────────────────
bool checkAuth() {
    if (!server.hasHeader("x-api-key")) return false;
    return server.header("x-api-key") == String(API_KEY);
}

void sendUnauthorized() {
    server.send(401, "application/json", "{\"error\":\"unauthorized\"}");
}

void sendBadRequest(const char* msg) {
    String j = "{\"error\":\"";
    j += msg;
    j += "\"}";
    server.send(400, "application/json", j);
}

// ─── GET /api/status ─────────────────────────────────────────────────────────
void handleStatus() {
    if (!checkAuth()) return sendUnauthorized();

    long now = millis();
    int remaining = 0;
    if (manualRun && stopAtMillis > now) {
        remaining = (int)((stopAtMillis - now) / 1000L);
    }

    JsonDocument doc;
    doc["online"]        = true;
    doc["activeZone"]    = activeZone;
    doc["manualRun"]     = manualRun;
    doc["remainingSec"]  = remaining;
    doc["configVersion"] = configVersion;

    String out;
    serializeJson(doc, out);
    server.send(200, "application/json", out);
}

// ─── GET /api/configVersion ──────────────────────────────────────────────────
void handleConfigVersion() {
    if (!checkAuth()) return sendUnauthorized();
    String out = "{\"configVersion\":" + String(configVersion) + "}";
    server.send(200, "application/json", out);
}

// ─── POST /api/manual ────────────────────────────────────────────────────────
void handleManual() {
    if (!checkAuth()) return sendUnauthorized();

    JsonDocument req;
    DeserializationError err = deserializeJson(req, server.arg("plain"));
    if (err) return sendBadRequest("invalid JSON");

    int  zone   = req["zone"]        | 0;
    bool on     = req["on"]          | false;
    int  durMin = req["durationMin"] | 10;

    // zone 0 or on:false  =  ALL OFF
    if (zone == 0 || !on) {
        allOff();
        server.send(200, "application/json",
            "{\"ok\":true,\"activeZone\":0,\"manualRun\":false,\"remainingSec\":0}");
        return;
    }

    if (zone < 1 || zone > MAX_ZONES) return sendBadRequest("zone out of range");

    // Stop whatever was running, start requested zone
    allOff();
    activeZone   = zone;
    manualRun    = true;
    stopAtMillis = millis() + (long)durMin * 60000L;
    relayOn(RELAY_PINS[zone - 1]);
    Serial.printf("[relay] zone %d ON for %d min\n", zone, durMin);

    JsonDocument res;
    res["ok"]          = true;
    res["activeZone"]  = activeZone;
    res["manualRun"]   = manualRun;
    res["remainingSec"]= durMin * 60;
    String out;
    serializeJson(res, out);
    server.send(200, "application/json", out);
}

// ─── POST /api/config ────────────────────────────────────────────────────────
void handleConfig() {
    if (!checkAuth()) return sendUnauthorized();

    JsonDocument req;
    DeserializationError err = deserializeJson(req, server.arg("plain"));
    if (err) return sendBadRequest("invalid JSON");

    int newVer = req["configVersion"] | 0;
    if (newVer > configVersion) configVersion = newVer;

    Serial.printf("[config] stored version %d\n", configVersion);
    server.send(200, "application/json", "{\"ok\":true}");
}

// ─── WiFi ────────────────────────────────────────────────────────────────────
void connectWiFi() {
    Serial.printf("[wifi] connecting to %s", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    unsigned long t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < 20000) {
        delay(500);
        Serial.print(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[wifi] connected  IP=%s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[wifi] failed — will retry");
    }
}

// ─── Optional NAS config pull ─────────────────────────────────────────────────
#if defined(NAS_URL) && defined(NAS_ID)
#include <HTTPClient.h>
void maybePullConfig() {
    if (strlen(NAS_URL) == 0 || strlen(NAS_ID) == 0) return;

    HTTPClient http;
    String url = String(NAS_URL) + "/api/controllers/" + NAS_ID + "/config";
    http.begin(url);
    http.addHeader("x-api-key", API_KEY);
    int code = http.GET();
    if (code == 200) {
        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, http.getString());
        if (!err) {
            int newVer = doc["configVersion"] | 0;
            if (newVer > configVersion) {
                configVersion = newVer;
                Serial.printf("[config pull] updated to version %d\n", configVersion);
            }
        }
    }
    http.end();
}
#else
void maybePullConfig() { /* NAS_URL not configured */ }
#endif

// ─── setup ───────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    delay(200);
    Serial.println("\n\n[boot] ESP32 Sprinkler Controller");

    // Init relay pins — all OFF immediately
    for (int i = 0; i < MAX_ZONES; i++) {
        pinMode(RELAY_PINS[i], OUTPUT);
        relayOff(RELAY_PINS[i]);
    }
    Serial.printf("[relay] %d zone pins initialised (all OFF)\n", MAX_ZONES);

    connectWiFi();

    // Tell WebServer which headers to capture
    const char* collectHeaders[] = { "x-api-key" };
    server.collectHeaders(collectHeaders, 1);

    // Register API routes
    server.on("/api/status",        HTTP_GET,  handleStatus);
    server.on("/api/configVersion", HTTP_GET,  handleConfigVersion);
    server.on("/api/manual",        HTTP_POST, handleManual);
    server.on("/api/config",        HTTP_POST, handleConfig);
    server.onNotFound([]() {
        server.send(404, "application/json", "{\"error\":\"not found\"}");
    });

    server.begin();
    Serial.println("[http] server started on port 80");
}

// ─── loop ────────────────────────────────────────────────────────────────────
void loop() {
    server.handleClient();

    // Self-contained timer: shut zone off when duration expires
    if (manualRun && millis() >= (unsigned long)stopAtMillis) {
        Serial.printf("[timer] zone %d timed out — shutting off\n", activeZone);
        allOff();
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

    // Optional NAS config poll
    if (now - lastConfigPoll > CONFIG_POLL_MS) {
        lastConfigPoll = now;
        maybePullConfig();
    }
}
