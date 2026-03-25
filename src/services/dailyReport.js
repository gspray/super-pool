'use strict';

/**
 * Daily report scheduler.
 * Checks every 30 s and fires exactly once at 23:59 local time each day.
 */

const { sendDailyReport } = require('./mailer');

const CHECK_INTERVAL_MS = 30_000;

let _timer = null;
let _lastFired = null; // YYYY-MM-DD of the last send, prevents double-fire

function localDateStr() {
    return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function localHHMM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function tick() {
    if (localHHMM() !== '23:59') return;
    const today = localDateStr();
    if (_lastFired === today) return;
    _lastFired = today;
    console.log('[dailyReport] 23:59 — sending daily report…');
    try {
        await sendDailyReport();
    } catch (err) {
        console.error('[dailyReport] uncaught error:', err.message);
    }
}

function start() {
    if (_timer) return;
    console.log('[dailyReport] scheduler started — will fire at 23:59 each day');
    _timer = setInterval(tick, CHECK_INTERVAL_MS);
}

function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { start, stop };
