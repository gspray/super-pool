'use strict';

/**
 * Watchdog — independent safety timer.
 *
 * Every WATCHDOG_INTERVAL_MS it scans all controllers.
 * If any zone has been running longer than settings.maxZoneMinutes it fires
 * an allOff command directly to the ESP and marks the status offline-safe.
 *
 * This is intentionally separate from the poller so it continues working even
 * if polling is slow or backed up.
 */

const espClient = require('./espClient');
const storage = require('./storage');
const settings = require('./settings');

const WATCHDOG_INTERVAL_MS = 30_000; // check every 30 s

let _timer = null;

async function checkOne(controller) {
    const maxMin = settings.get('maxZoneMinutes');
    if (!maxMin || maxMin <= 0) return; // watchdog disabled

    const status = controller.status || {};
    if (!status.manualRun || !status.zoneStartedAt) return;

    const elapsedMs = Date.now() - new Date(status.zoneStartedAt).getTime();
    const elapsedMin = elapsedMs / 60_000;

    if (elapsedMin < maxMin) return;

    // Limit exceeded — kill it
    console.warn(
        `[watchdog] ${controller.id} zone ${status.activeZone} exceeded ${maxMin} min ` +
        `(ran ${elapsedMin.toFixed(1)} min) — sending allOff`
    );

    try {
        await espClient.allOff(controller.espUrl);
        storage.updateStatus(controller.id, {
            activeZone: null,
            manualRun: false,
            remainingSec: 0,
            zoneStartedAt: null,
            lastSeen: new Date().toISOString(),
        });
        console.log(`[watchdog] ${controller.id} allOff confirmed`);
    } catch (err) {
        console.error(`[watchdog] ${controller.id} allOff failed: ${err.message}`);
        // Still clear our tracked start time so we don't keep retrying on a dead device
        storage.updateStatus(controller.id, { zoneStartedAt: null });
    }
}

async function checkAll() {
    const controllers = storage.listControllers();
    await Promise.allSettled(controllers.map(checkOne));
}

function start() {
    if (_timer) return;
    console.log(`[watchdog] starting — interval ${WATCHDOG_INTERVAL_MS}ms`);
    _timer = setInterval(checkAll, WATCHDOG_INTERVAL_MS);
}

function stop() {
    if (_timer) {
        clearInterval(_timer);
        _timer = null;
    }
}

module.exports = { start, stop, checkAll };
