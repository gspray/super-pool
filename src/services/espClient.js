'use strict';

/**
 * HTTP client for ESP32 controllers.
 * All requests include the shared x-api-key header.
 * Throws on network errors; callers decide how to handle.
 */

const fetch = require('node-fetch');

const API_KEY = process.env.API_KEY || '';
const TIMEOUT = 8000; // ms

function headers() {
    return {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
    };
}

function withTimeout(ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return { signal: ctrl.signal, clear: () => clearTimeout(timer) };
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function get(espUrl, endpoint) {
    const { signal, clear } = withTimeout(TIMEOUT);
    try {
        const res = await fetch(`${espUrl}${endpoint}`, {
            method: 'GET',
            headers: headers(),
            signal,
        });
        clear();
        if (!res.ok) throw new Error(`ESP returned ${res.status}`);
        return res.json();
    } finally {
        clear();
    }
}

async function post(espUrl, endpoint, body) {
    const { signal, clear } = withTimeout(TIMEOUT);
    try {
        const res = await fetch(`${espUrl}${endpoint}`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify(body),
            signal,
        });
        clear();
        if (!res.ok) throw new Error(`ESP returned ${res.status}`);
        return res.json();
    } finally {
        clear();
    }
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * GET /api/status
 * Returns ESP status object or throws.
 */
async function getStatus(espUrl) {
    return get(espUrl, '/api/status');
}

/**
 * GET /api/configVersion
 */
async function getConfigVersion(espUrl) {
    return get(espUrl, '/api/configVersion');
}

/**
 * POST /api/manual  — turn a zone on or off
 * @param {string} espUrl
 * @param {number} zone
 * @param {boolean} on
 * @param {number}  [durationMin]
 */
async function sendManual(espUrl, zone, on, durationMin) {
    const body = { zone, on };
    if (on && durationMin != null) body.durationMin = durationMin;
    return post(espUrl, '/api/manual', body);
}

/**
 * POST /api/config — push full config to ESP
 */
async function pushConfig(espUrl, config) {
    return post(espUrl, '/api/config', config);
}

/**
 * Turn ALL zones off (zone 0 convention — ESP should handle this).
 * Falls back to zone:1, on:false if ESP doesn't support zone 0.
 */
async function allOff(espUrl) {
    return post(espUrl, '/api/manual', { zone: 0, on: false });
}

module.exports = { getStatus, getConfigVersion, sendManual, pushConfig, allOff };
