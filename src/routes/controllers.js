'use strict';

/**
 * /api/controllers  — CRUD + proxied ESP operations
 *
 * Routes:
 *   GET    /api/controllers                 list all controllers + live status
 *   POST   /api/controllers                 create a new controller record
 *   GET    /api/controllers/:id             get one controller
 *   PUT    /api/controllers/:id             update ESPUrl / name / meta
 *   DELETE /api/controllers/:id             remove controller record
 *
 *   GET    /api/controllers/:id/config      return stored config (ESP can pull this)
 *   PUT    /api/controllers/:id/config      save new config, bump version, push to ESP
 *
 *   POST   /api/controllers/:id/manual      proxy manual ON/OFF through to ESP
 *   POST   /api/controllers/:id/alloff      turn every zone off immediately
 *
 *   GET    /api/controllers/:id/status      return cached status object
 */

const router = require('express').Router();
const storage = require('../services/storage');
const espClient = require('../services/espClient');

// No auth on NAS routes — LAN-only app; the API key is used solely
// when the NAS talks outbound to the ESP32 (see espClient.js).

// ── helper ────────────────────────────────────────────────────────────────────

function notFound(res, id) {
    return res.status(404).json({ error: `Controller '${id}' not found` });
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

// List all
router.get('/', (_req, res) => {
    res.json(storage.listControllers());
});

// Create
router.post('/', (req, res) => {
    const { id, name, espUrl } = req.body;
    if (!id || !espUrl) {
        return res.status(400).json({ error: 'id and espUrl are required' });
    }
    if (storage.getController(id)) {
        return res.status(409).json({ error: `Controller '${id}' already exists` });
    }
    const ctrl = storage.saveController(id, {
        name: name || id,
        espUrl,
        config: { configVersion: 0, zones: [] },
        status: {
            online: false, activeZone: null, manualRun: false,
            remainingSec: 0, configVersion: 0, lastSeen: null
        },
    });
    res.status(201).json(ctrl);
});

// Get one
router.get('/:id', (req, res) => {
    const ctrl = storage.getController(req.params.id);
    if (!ctrl) return notFound(res, req.params.id);
    res.json(ctrl);
});

// Update meta (espUrl, name)
router.put('/:id', (req, res) => {
    const ctrl = storage.getController(req.params.id);
    if (!ctrl) return notFound(res, req.params.id);
    const { name, espUrl } = req.body;
    const updated = storage.saveController(req.params.id, {
        ...(name ? { name } : {}),
        ...(espUrl ? { espUrl } : {}),
    });
    res.json(updated);
});

// Delete
router.delete('/:id', (req, res) => {
    if (!storage.deleteController(req.params.id)) {
        return notFound(res, req.params.id);
    }
    res.json({ ok: true });
});

// ── Config ────────────────────────────────────────────────────────────────────

// GET — ESP pulls this
router.get('/:id/config', (req, res) => {
    const ctrl = storage.getController(req.params.id);
    if (!ctrl) return notFound(res, req.params.id);
    res.json(ctrl.config || { configVersion: 0, zones: [] });
});

// PUT — PWA saves config; NAS bumps version and optionally pushes
router.put('/:id/config', async (req, res) => {
    const ctrl = storage.getController(req.params.id);
    if (!ctrl) return notFound(res, req.params.id);

    const updated = storage.saveConfig(req.params.id, req.body);

    // Best-effort push to ESP
    let pushed = false;
    try {
        await espClient.pushConfig(ctrl.espUrl, updated.config);
        pushed = true;
    } catch (err) {
        console.warn(`[config push] ${req.params.id}: ${err.message}`);
        storage.updateStatus(req.params.id, { online: false });
    }

    res.json({ ok: true, configVersion: updated.config.configVersion, pushed });
});

// ── Manual control ────────────────────────────────────────────────────────────

// POST /api/controllers/:id/manual
// body: { zone, on, durationMin }
router.post('/:id/manual', async (req, res) => {
    const ctrl = storage.getController(req.params.id);
    if (!ctrl) return notFound(res, req.params.id);

    const { zone, on, durationMin } = req.body;
    if (zone == null || on == null) {
        return res.status(400).json({ error: 'zone and on are required' });
    }

    try {
        const data = await espClient.sendManual(ctrl.espUrl, zone, on, durationMin);

        // Optimistically update cached status
        if (on) {
            storage.updateStatus(req.params.id, {
                activeZone: zone,
                manualRun: true,
                remainingSec: (durationMin || 0) * 60,
                online: true,
                lastSeen: new Date().toISOString(),
            });
        } else {
            storage.updateStatus(req.params.id, {
                activeZone: null,
                manualRun: false,
                remainingSec: 0,
                online: true,
                lastSeen: new Date().toISOString(),
            });
        }

        res.json(data);
    } catch (err) {
        storage.updateStatus(req.params.id, { online: false });
        res.status(502).json({ error: 'ESP unreachable', detail: err.message });
    }
});

// POST /api/controllers/:id/alloff
router.post('/:id/alloff', async (req, res) => {
    const ctrl = storage.getController(req.params.id);
    if (!ctrl) return notFound(res, req.params.id);

    try {
        const data = await espClient.allOff(ctrl.espUrl);
        storage.updateStatus(req.params.id, {
            activeZone: null,
            manualRun: false,
            remainingSec: 0,
            online: true,
            lastSeen: new Date().toISOString(),
        });
        res.json(data);
    } catch (err) {
        storage.updateStatus(req.params.id, { online: false });
        res.status(502).json({ error: 'ESP unreachable', detail: err.message });
    }
});

// ── Status ────────────────────────────────────────────────────────────────────

// GET cached status (poller keeps this fresh)
router.get('/:id/status', (req, res) => {
    const ctrl = storage.getController(req.params.id);
    if (!ctrl) return notFound(res, req.params.id);
    res.json(ctrl.status || {});
});

module.exports = router;
