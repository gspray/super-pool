'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const controllers = require('./routes/controllers');
const poller = require('./services/poller');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json());

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api/controllers', controllers);

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
});

// Graceful shutdown
process.on('SIGTERM', () => { poller.stop(); process.exit(0); });
process.on('SIGINT', () => { poller.stop(); process.exit(0); });
