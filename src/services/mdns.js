'use strict';

/**
 * mDNS advertisement — lets Home Assistant auto-discover this server
 * via its zeroconf integration mechanism.
 *
 * Service type : _sprinklerapi._tcp
 * HA manifest  : "zeroconf": [{"type": "_sprinklerapi._tcp.local."}]
 *
 * TXT records carried by the advertisement:
 *   model  = SprayCtrl
 *   api    = 1           (bumped if the REST API changes in breaking ways)
 *   id     = <SERVER_ID> (unique instance identifier, defaults to hostname)
 */

const { Bonjour } = require('bonjour-service');
const os = require('os');

const bonjour = new Bonjour();
let _service = null;

const SERVER_ID = process.env.SERVER_ID || os.hostname();

function start(port) {
    if (_service) return; // already advertising

    _service = bonjour.publish({
        name: `Sprinkler NAS (${SERVER_ID})`,
        type: 'sprinklerapi',
        protocol: 'tcp',
        port,
        txt: {
            model: 'SprayCtrl',
            api: '1',
            id: SERVER_ID,
        },
    });

    _service.on('up', () =>
        console.log(`[mdns] advertising _sprinklerapi._tcp on port ${port}  id=${SERVER_ID}`)
    );
    _service.on('error', (err) =>
        console.warn(`[mdns] advertisement error: ${err.message}`)
    );
}

function stop() {
    if (!_service) return;
    bonjour.unpublishAll(() => {
        bonjour.destroy();
        _service = null;
        console.log('[mdns] advertisement stopped');
    });
}

module.exports = { start, stop };
