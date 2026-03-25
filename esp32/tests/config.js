/**
 * config.js — runtime configuration for ESP32 integration tests.
 *
 * Override via environment variables:
 *   ESP32_HOST=192.168.1.42  API_KEY=mysecret  npm test
 *
 * Or pass CLI args using cross-env / dotenv if preferred.
 */

const config = {
  host:    process.env.ESP32_HOST || "192.168.1.100",
  port:    parseInt(process.env.ESP32_PORT || "80", 10),
  apiKey:  process.env.API_KEY    || "change-me-to-something-secret",
};

config.baseUrl = `http://${config.host}:${config.port}`;

module.exports = config;
