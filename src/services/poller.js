'use strict';

/**
 * Background poller — queries every ESP controller on a configurable interval.
 * Updates the in-memory + persisted status via storage.updateStatus().
 */

const espClient = require('./espClient');
const storage = require('./storage');
const runLog = require('./runLog');

const INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '15000', 10);

let _timer = null;

async function pollOne(controller) {
    try {
        const status = await espClient.getStatus(controller.espUrl);
        const prev = storage.getController(controller.id)?.status || {};

        // Detect zone completion and log the run
        if (prev.manualRun && prev.zoneStartedAt && !status.manualRun) {
            const durationMin = (Date.now() - new Date(prev.zoneStartedAt).getTime()) / 60_000;
            const zones = storage.getController(controller.id)?.config?.zones || [];
            const zone = zones.find(z => z.id === prev.activeZone);
            runLog.append({
                controllerId: controller.id,
                controllerName: controller.name,
                zoneId: prev.activeZone,
                zoneName: zone ? zone.name : `Zone ${prev.activeZone}`,
                startedAt: prev.zoneStartedAt,
                durationMin,
            });
        }

        // Preserve or initialise zoneStartedAt based on manualRun transitions
        let zoneStartedAt = prev.zoneStartedAt || null;
        if (status.manualRun && !zoneStartedAt) {
            // Zone became active since last poll — record now as start time
            zoneStartedAt = new Date().toISOString();
        } else if (!status.manualRun) {
            zoneStartedAt = null;
        }

        storage.updateStatus(controller.id, {
            ...status,
            online: true,
            lastSeen: new Date().toISOString(),
            zoneStartedAt,
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
