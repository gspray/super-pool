'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const controllers = require('./routes/controllers');
const settingsRoute = require('./routes/settings');
const poller = require('./services/poller');
const watchdog = require('./services/watchdog');
const dailyReport = require('./services/dailyReport');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json());

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api/controllers', controllers);
app.use('/api/settings', settingsRoute);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── PWA static files ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// Catch-all → SPA
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`Sprinkler NAS server listening on http://0.0.0.0:${PORT}`);
    poller.start();
    watchdog.start();
    dailyReport.start();
});

// Graceful shutdown
process.on('SIGTERM', () => { poller.stop(); watchdog.stop(); dailyReport.stop(); process.exit(0); });
process.on('SIGINT', () => { poller.stop(); watchdog.stop(); dailyReport.stop(); process.exit(0); });
