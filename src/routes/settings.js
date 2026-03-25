'use strict';

/**
 * GET  /api/settings   — return current settings
 * PUT  /api/settings   — merge patch and persist
 */

const router = require('express').Router();
const settings = require('../services/settings');

router.get('/', (_req, res) => {
    res.json(settings.getAll());
});

router.put('/', (req, res) => {
    const patch = req.body;
    // Validate known fields
    if (patch.maxZoneMinutes !== undefined) {
        const v = Number(patch.maxZoneMinutes);
        if (!Number.isFinite(v) || v < 0) {
            return res.status(400).json({ error: 'maxZoneMinutes must be a non-negative number' });
        }
        patch.maxZoneMinutes = v;
    }
    if (patch.emailEnabled !== undefined) {
        patch.emailEnabled = Boolean(patch.emailEnabled);
    }
    if (patch.emailTo !== undefined) patch.emailTo = String(patch.emailTo).trim();
    if (patch.emailUser !== undefined) patch.emailUser = String(patch.emailUser).trim();
    if (patch.emailPass !== undefined) patch.emailPass = String(patch.emailPass);
    const updated = settings.setAll(patch);
    res.json(updated);
});

module.exports = router;
