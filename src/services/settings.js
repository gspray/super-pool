'use strict';

/**
 * Global app settings — persisted to DATA_DIR/settings.json.
 * Provides typed defaults; callers merge on top.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || './data';
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const DEFAULTS = {
    // Watchdog: maximum minutes any zone may run continuously.
    // Set to 0 to disable.
    maxZoneMinutes: 30,

    // Daily email report (sent at 23:59 via Gmail + Nodemailer).
    emailEnabled: false,
    emailTo: '',   // recipient address
    emailUser: '',   // Gmail address (sender)
    emailPass: '',   // Gmail App Password
};

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
    ensureDir();
    if (!fs.existsSync(SETTINGS_FILE)) return { ...DEFAULTS };
    try {
        return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
    } catch {
        return { ...DEFAULTS };
    }
}

function persist(data) {
    ensureDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

let _settings = load();

function getAll() {
    return { ..._settings };
}

function get(key) {
    return _settings[key];
}

function setAll(patch) {
    _settings = { ..._settings, ...patch };
    persist(_settings);
    return { ..._settings };
}

module.exports = { getAll, get, setAll };
