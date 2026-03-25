'use strict';

/**
 * Zone run log — appends completed zone runs to DATA_DIR/runlog.json.
 * Keeps 90 days of history (capped at 10 000 entries).
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || './data';
const LOG_FILE = path.join(DATA_DIR, 'runlog.json');
const MAX_ENTRIES = 10_000;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1_000;

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
    ensureDir();
    if (!fs.existsSync(LOG_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function save(entries) {
    ensureDir();
    fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

/**
 * Append a completed run entry.
 * @param {{ controllerId, controllerName, zoneId, zoneName, startedAt, durationMin }} entry
 */
function append(entry) {
    const log = load();
    log.push(entry);

    // Trim old entries
    const cutoff = Date.now() - MAX_AGE_MS;
    const trimmed = log
        .filter(e => new Date(e.startedAt).getTime() > cutoff)
        .slice(-MAX_ENTRIES);

    save(trimmed);
    console.log(`[runLog] logged run: ${entry.controllerName} / ${entry.zoneName} (${entry.durationMin.toFixed(1)} min)`);
}

/**
 * Return all entries whose startedAt falls on today (local time, YYYY-MM-DD).
 */
function getToday() {
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    return load().filter(e => e.startedAt.slice(0, 10) === today);
}

module.exports = { append, getToday };
