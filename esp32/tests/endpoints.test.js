/**
 * endpoints.test.js — Integration tests for the ESP32 sprinkler controller.
 *
 * Covers every documented endpoint:
 *   GET  /api/status
 *   GET  /api/configVersion
 *   POST /api/manual
 *   POST /api/config
 *   *    /api/nonexistent   (404 handler)
 *
 * Run against a live device:
 *   ESP32_HOST=192.168.1.42 API_KEY=mysecret npm test
 */

"use strict";

const axios  = require("axios");
const config = require("./config");

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

const TIMEOUT = 5_000;

// ─── Global connectivity gate ─────────────────────────────────────────────────
// If the device is unreachable, fail fast with a clear message (bail:1 in
// jest config stops the whole suite so the remaining 30 tests don't cascade).
beforeAll(async () => {
  try {
    const probe = axios.create({ baseURL: config.baseUrl, timeout: TIMEOUT, validateStatus: () => true });
    await probe.get("/api/status");
  } catch (err) {
    throw new Error(
      `ESP32 not reachable at ${config.baseUrl}\n` +
      `  1. Open serial monitor — look for "[wifi] connected  IP=..." to find the actual IP\n` +
      `  2. Make sure ESP32_HOST matches that IP\n` +
      `  3. If you rebooted since last usbipd attach, re-run: usbipd attach --wsl --busid <id>\n` +
      `  (original error: ${err.message})`
    );
  }
});

function authed(extraHeaders = {}) {
  return axios.create({
    baseURL: config.baseUrl,
    timeout: TIMEOUT,
    headers: { "x-api-key": config.apiKey, "Content-Type": "application/json", ...extraHeaders },
    validateStatus: () => true,   // never throw on non-2xx — we assert manually
  });
}

function unauthed() {
  return axios.create({
    baseURL: config.baseUrl,
    timeout: TIMEOUT,
    headers: { "Content-Type": "application/json" },
    validateStatus: () => true,
  });
}

const api     = authed();
const noauth  = unauthed();

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/status
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/status", () => {
  test("requires auth", async () => {
    const res = await noauth.get("/api/status");
    expect(res.status).toBe(401);
    expect(res.data.error).toBe("unauthorized");
  });

  test("rejects wrong key", async () => {
    const client = axios.create({
      baseURL: config.baseUrl,
      timeout: TIMEOUT,
      headers: { "x-api-key": "wrong-key" },
      validateStatus: () => true,
    });
    const res = await client.get("/api/status");
    expect(res.status).toBe(401);
  });

  test("returns 200 with correct key", async () => {
    const res = await api.get("/api/status");
    expect(res.status).toBe(200);
  });

  test("content-type is application/json", async () => {
    const res = await api.get("/api/status");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  test("response schema is valid", async () => {
    const body = (await api.get("/api/status")).data;
    expect(body.online).toBe(true);
    expect(typeof body.activeZone).toBe("number");
    expect(typeof body.manualRun).toBe("boolean");
    expect(typeof body.remainingSec).toBe("number");
    expect(typeof body.configVersion).toBe("number");
    expect(body.remainingSec).toBeGreaterThanOrEqual(0);
  });

  test("idle state after all-off", async () => {
    await api.post("/api/manual", { zone: 0, on: false });
    const body = (await api.get("/api/status")).data;
    expect(body.activeZone).toBe(0);
    expect(body.manualRun).toBe(false);
    expect(body.remainingSec).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/configVersion
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/configVersion", () => {
  test("requires auth", async () => {
    const res = await noauth.get("/api/configVersion");
    expect(res.status).toBe(401);
  });

  test("returns 200", async () => {
    const res = await api.get("/api/configVersion");
    expect(res.status).toBe(200);
  });

  test("response schema is valid", async () => {
    const body = (await api.get("/api/configVersion")).data;
    expect(typeof body.configVersion).toBe("number");
  });

  test("consistent with /api/status", async () => {
    const cv1 = (await api.get("/api/configVersion")).data.configVersion;
    const cv2 = (await api.get("/api/status")).data.configVersion;
    expect(cv1).toBe(cv2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/manual
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/manual", () => {
  afterAll(async () => {
    // Leave device in a clean, all-off state
    await api.post("/api/manual", { zone: 0, on: false });
  });

  test("requires auth", async () => {
    const res = await noauth.post("/api/manual", { zone: 1, on: true, durationMin: 1 });
    expect(res.status).toBe(401);
  });

  test("invalid JSON returns 400", async () => {
    const client = axios.create({
      baseURL: config.baseUrl, timeout: TIMEOUT, validateStatus: () => true,
    });
    const res = await client.post("/api/manual", "not-json", {
      headers: { "x-api-key": config.apiKey, "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
    expect(res.data).toHaveProperty("error");
  });

  test("zone too high returns 400", async () => {
    const res = await api.post("/api/manual", { zone: 99, on: true, durationMin: 1 });
    expect(res.status).toBe(400);
    expect(res.data.error).toBe("zone out of range");
  });

  test("negative zone returns 400", async () => {
    const res = await api.post("/api/manual", { zone: -1, on: true, durationMin: 1 });
    expect(res.status).toBe(400);
  });

  test("turns zone on", async () => {
    const res = await api.post("/api/manual", { zone: 1, on: true, durationMin: 2 });
    expect(res.status).toBe(200);
    const body = res.data;
    expect(body.ok).toBe(true);
    expect(body.activeZone).toBe(1);
    expect(body.manualRun).toBe(true);
    expect(body.remainingSec).toBe(2 * 60);
  });

  test("status reflects active zone", async () => {
    await api.post("/api/manual", { zone: 1, on: true, durationMin: 2 });
    const body = (await api.get("/api/status")).data;
    expect(body.activeZone).toBe(1);
    expect(body.manualRun).toBe(true);
    expect(body.remainingSec).toBeGreaterThan(0);
  });

  test("turns off with on:false", async () => {
    await api.post("/api/manual", { zone: 1, on: true, durationMin: 2 });
    const res = await api.post("/api/manual", { zone: 1, on: false });
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(res.data.activeZone).toBe(0);
    expect(res.data.manualRun).toBe(false);
  });

  test("turns off with zone:0", async () => {
    await api.post("/api/manual", { zone: 1, on: true, durationMin: 2 });
    const res = await api.post("/api/manual", { zone: 0, on: true });
    expect(res.status).toBe(200);
    expect(res.data.activeZone).toBe(0);
  });

  test("switching zones stops previous", async () => {
    await api.post("/api/manual", { zone: 1, on: true, durationMin: 2 });
    await api.post("/api/manual", { zone: 2, on: true, durationMin: 2 });
    const body = (await api.get("/api/status")).data;
    expect(body.activeZone).toBe(2);
  });

  test("all zones 1-8 are accepted", async () => {
    for (let zone = 1; zone <= 8; zone++) {
      const res = await api.post("/api/manual", { zone, on: true, durationMin: 1 });
      expect(res.status).toBe(200);
      await sleep(100);
    }
  });

  test("remainingSec decrements over time", async () => {
    await api.post("/api/manual", { zone: 1, on: true, durationMin: 1 });
    const t1 = (await api.get("/api/status")).data.remainingSec;
    await sleep(2_000);
    const t2 = (await api.get("/api/status")).data.remainingSec;
    expect(t2).toBeLessThan(t1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/config
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/config", () => {
  test("requires auth", async () => {
    const res = await noauth.post("/api/config", { configVersion: 1 });
    expect(res.status).toBe(401);
  });

  test("invalid JSON returns 400", async () => {
    const client = axios.create({
      baseURL: config.baseUrl, timeout: TIMEOUT, validateStatus: () => true,
    });
    const res = await client.post("/api/config", "bad", {
      headers: { "x-api-key": config.apiKey, "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  test("returns 200 with ok:true", async () => {
    const res = await api.post("/api/config", { configVersion: 9000 });
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
  });

  test("configVersion advances", async () => {
    const current = (await api.get("/api/configVersion")).data.configVersion;
    await api.post("/api/config", { configVersion: current + 1 });
    const after = (await api.get("/api/configVersion")).data.configVersion;
    expect(after).toBe(current + 1);
  });

  test("older version does not roll back", async () => {
    const current = (await api.get("/api/configVersion")).data.configVersion;
    await api.post("/api/config", { configVersion: current - 1 });
    const after = (await api.get("/api/configVersion")).data.configVersion;
    expect(after).toBe(current);
  });

  test("missing configVersion field keeps current version", async () => {
    const current = (await api.get("/api/configVersion")).data.configVersion;
    const res = await api.post("/api/config", { someOtherField: "value" });
    expect(res.status).toBe(200);
    const after = (await api.get("/api/configVersion")).data.configVersion;
    expect(after).toBe(current);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 404 handler
// ═════════════════════════════════════════════════════════════════════════════

describe("404 handler", () => {
  test("unknown GET returns 404", async () => {
    const res = await api.get("/api/nonexistent");
    expect(res.status).toBe(404);
    expect(res.data.error).toBe("not found");
  });

  test("unknown POST returns 404", async () => {
    const res = await api.post("/api/nonexistent", {});
    expect(res.status).toBe(404);
  });

  test("root path returns 404", async () => {
    const res = await api.get("/");
    expect(res.status).toBe(404);
  });
});
