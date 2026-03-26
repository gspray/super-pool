'use strict';

/**
 * Static file server — serves the PWA from public/.
 * All API calls go direct from the browser to each ESP32.
 * This process can be replaced with any static host (nginx, Caddy, HA panel).
 */

require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA catch-all
app.get('*', (_req, res) =>
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
);

app.listen(PORT, () =>
    console.log(`Sprinkler static server on http://0.0.0.0:${PORT}`)
);

