'use strict';

/**
 * Very simple API-key middleware for the NAS → external callers path.
 * The same key is also used when talking TO the ESP.
 *
 * Skip on GET requests to /api/controllers (dashboard reads are public-ish
 * on a LAN; tighten up if you expose this externally).
 */

const API_KEY = process.env.API_KEY || '';

function requireApiKey(req, res, next) {
    const key = req.headers['x-api-key'];
    if (!key || key !== API_KEY) {
        return res.status(401).json({ error: 'unauthorized' });
    }
    next();
}

/**
 * Optional: protect only write operations on the NAS API.
 * GET /api/controllers (status reads) pass through; everything else requires key.
 */
function requireApiKeyForWrites(req, res, next) {
    if (req.method === 'GET') return next();
    return requireApiKey(req, res, next);
}

module.exports = { requireApiKey, requireApiKeyForWrites };
