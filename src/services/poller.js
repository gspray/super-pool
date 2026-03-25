'use strict';

/**
 * Background poller — queries every ESP controller on a configurable interval.
 * Updates the in-memory + persisted status via storage.updateStatus().
 */

const espClient = require('./espClient');
const storage = require('./storage');

const INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '15000', 10);

let _timer = null;

async function pollOne(controller) {
    try {
        const status = await espClient.getStatus(controller.espUrl);
        storage.updateStatus(controller.id, {
            ...status,
            online: true,
            lastSeen: new Date().toISOString(),
        });
    } catch (err) {
        // Mark offline; preserve last non-online fields
        storage.updateStatus(controller.id, {
            online: false,
            lastSeen: (storage.getController(controller.id)?.status?.lastSeen) || null,
        });
        console.warn(`[poller] ${controller.id} unreachable: ${err.message}`);
    }
}

async function pollAll() {
    const controllers = storage.listControllers();
    await Promise.allSettled(controllers.map(pollOne));
}

function start() {
    if (_timer) return; // already running
    console.log(`[poller] starting — interval ${INTERVAL}ms`);
    pollAll(); // immediate first run
    _timer = setInterval(pollAll, INTERVAL);
}

function stop() {
    if (_timer) {
        clearInterval(_timer);
        _timer = null;
    }
}

module.exports = { start, stop, pollAll, pollOne };
