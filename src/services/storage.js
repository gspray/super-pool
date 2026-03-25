'use strict';

/**
 * Simple JSON file storage.
 * Keeps an in-memory cache and flushes writes to DATA_DIR/controllers.json.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_FILE = path.join(DATA_DIR, 'controllers.json');

// ── bootstrap ────────────────────────────────────────────────────────────────

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
    ensureDir();
    if (!fs.existsSync(DB_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function save(db) {
    ensureDir();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

// ── in-memory cache ───────────────────────────────────────────────────────────

let _db = load();

// ── public API ────────────────────────────────────────────────────────────────

/** Return all controllers as an array */
function listControllers() {
    return Object.values(_db);
}

/** Return one controller by id, or undefined */
function getController(id) {
    return _db[id];
}

/**
 * Upsert a controller.
 * Pass the full object for creates; partial for updates (merged at top level).
 */
function saveController(id, data) {
    _db[id] = { ..._db[id], ...data, id };
    save(_db);
    return _db[id];
}

/** Merge a partial status update into controller.status */
function updateStatus(id, statusPatch) {
    const ctrl = _db[id];
    if (!ctrl) return null;
    ctrl.status = { ...(ctrl.status || {}), ...statusPatch };
    save(_db);
    return ctrl;
}

/** Bump configVersion and merge new config fields */
function saveConfig(id, configData) {
    const ctrl = _db[id];
    if (!ctrl) return null;
    const version = ((ctrl.config || {}).configVersion || 0) + 1;
    ctrl.config = { ...configData, configVersion: version };
    save(_db);
    return ctrl;
}

/** Delete a controller */
function deleteController(id) {
    if (!_db[id]) return false;
    delete _db[id];
    save(_db);
    return true;
}

module.exports = {
    listControllers,
    getController,
    saveController,
    updateStatus,
    saveConfig,
    deleteController,
};
