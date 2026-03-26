/* ────────────────────────────────────────────────────────────────────────────
   Sprinkler PWA — app.js
   Single ESP32 controller, direct HTTP calls, no server required.
──────────────────────────────────────────────────────────────────────────── */

'use strict';

// ── Config ───────────────────────────────────────────────────────────────────
const POLL_MS = 10_000;  // idle poll interval
const POLL_FAST_MS = 2_000;  // poll interval when a zone is running
const DEFAULT_MINS = 5;

// ── State ────────────────────────────────────────────────────────────────────
let esp = null;        // { url, name } from localStorage
let status = {};       // latest GET /api/status
let config = {};       // latest GET /api/config  { zones, configVersion }
let endsAt = 0;        // countdown end timestamp (ms)
let lastOnlineAt = 0;  // Date.now() of last successful contact
let pollTimer = null;
let countdownTimer = null;
let activeView = 'dashboard';
let espEpochAtFetch = 0;       // epoch seconds from ESP at time of last fetch
let localMsAtFetch = 0;        // Date.now() when that fetch happened
let renderedConfigVersion = -1; // configVersion of the last full dashboard render

// ── DOM refs ──────────────────────────────────────────────────────────────
const $main = document.getElementById('main');
const $backdrop = document.getElementById('modal-backdrop');
const $modalTitle = document.getElementById('modal-title');
const $modalBody = document.getElementById('modal-body');
const $modalOk = document.getElementById('modal-confirm');
const $modalCx = document.getElementById('modal-cancel');
const $btnSettings = document.getElementById('btn-settings');
const $appTitle = document.getElementById('app-title');
const $espClock = document.getElementById('esp-clock');
const $batteryIndicator = document.getElementById('battery-indicator');

// ── Persistence ───────────────────────────────────────────────────────────────
function getApiKey() { return localStorage.getItem('sprinkler_api_key') || ''; }
function setApiKey(k) { localStorage.setItem('sprinkler_api_key', k); }

function getEsp() {
    try { return JSON.parse(localStorage.getItem('sprinkler_esp') || 'null'); }
    catch { return null; }
}
function saveEsp(obj) {
    localStorage.setItem('sprinkler_esp', obj ? JSON.stringify(obj) : 'null');
}

function getLastDuration(zoneId) {
    return parseInt(localStorage.getItem(`sprinkler_dur_${zoneId}`), 10) || DEFAULT_MINS;
}
function setLastDuration(zoneId, mins) {
    localStorage.setItem(`sprinkler_dur_${zoneId}`, mins);
}

// ── ESP HTTP helper ───────────────────────────────────────────────────────────
async function espFetch(method, path, body) {
    if (!esp) throw new Error('No ESP configured');
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json', 'x-api-key': getApiKey() },
    };
    if (body != null) opts.body = JSON.stringify(body);
    const res = await fetch(`${esp.url}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

// ── Toast ────────────────────────────────────────────────────────────────────
let $toastWrap;
function toast(msg, type = '') {
    if (!$toastWrap) {
        $toastWrap = document.createElement('div');
        $toastWrap.className = 'toast-wrap';
        document.body.appendChild($toastWrap);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    $toastWrap.appendChild(el);
    setTimeout(() => el.remove(), 3200);
}

// ── Tiny HTML escape ──────────────────────────────────────────────────────────
function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Formatting ────────────────────────────────────────────────────────────────
function fmtSec(s) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
}

// ── Debounce ─────────────────────────────────────────────────────────────────
function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadData() {
    esp = getEsp();
    if (!esp) { renderSetup(); return; }

    try {
        const [s, c] = await Promise.all([
            espFetch('GET', '/api/status'),
            espFetch('GET', '/api/config'),
        ]);
        status = s;
        config = c || { zones: [] };
        lastOnlineAt = Date.now();
        fetchEspTime(); // fire-and-forget; updates clock header
        updateBatteryIndicator();

        if (status.manualRun && status.activeZone && !endsAt) {
            endsAt = Date.now() + (status.remainingSec || 0) * 1000;
        } else if (!status.manualRun) {
            endsAt = 0;
        }
    } catch (e) {
        status = { online: false, manualRun: false, activeZone: 0, remainingSec: 0 };
        if (!config.zones) config = { zones: [] };
    }

    if (activeView === 'dashboard') {
        const configChanged = (config.configVersion !== renderedConfigVersion);
        const domEmpty = !$main.querySelector('.ctrl-header');
        if (configChanged || domEmpty) {
            renderDashboard();
        } else {
            patchDashboardStatus();
        }
    }
}

// ── Poll + countdown ──────────────────────────────────────────────────────────
let currentPollMs = POLL_MS;
function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    currentPollMs = status.manualRun ? POLL_FAST_MS : POLL_MS;
    pollTimer = setInterval(async () => {
        if (activeView !== 'dashboard') return;
        await loadData();
        // Adjust interval if run state changed
        const desired = status.manualRun ? POLL_FAST_MS : POLL_MS;
        if (desired !== currentPollMs) { currentPollMs = desired; startPolling(); }
    }, currentPollMs);
}

function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        let anyExpired = false;
        document.querySelectorAll('.countdown[data-ends]').forEach(el => {
            const rem = Math.max(0, Math.round((parseInt(el.dataset.ends, 10) - Date.now()) / 1000));
            el.textContent = fmtSec(rem);
            if (rem === 0) anyExpired = true;
        });
        // When countdown hits 0, immediately fetch status so UI updates promptly
        if (anyExpired && endsAt && Date.now() >= endsAt) {
            endsAt = 0;  // prevent repeated triggers
            loadData();
        }
        updateEspClock();
    }, 1000);
}

// ── ESP time ──────────────────────────────────────────────────────────────
async function fetchEspTime() {
    try {
        const t = await espFetch('GET', '/api/time');
        if (t.epoch && t.epoch > 1000000000) {
            espEpochAtFetch = t.epoch;
            localMsAtFetch = Date.now();
            updateEspClock();
        }
    } catch { /* ignore — older firmware without /api/time */ }
}

function currentEspEpoch() {
    if (!espEpochAtFetch) return 0;
    return espEpochAtFetch + Math.floor((Date.now() - localMsAtFetch) / 1000);
}

function updateEspClock() {
    if (!$espClock) return;
    const epoch = currentEspEpoch();
    if (!epoch || epoch < 1000000000) {
        $espClock.textContent = '';
        $espClock.title = '';
        return;
    }
    const d = new Date(epoch * 1000);
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $espClock.innerHTML = `<span class="esp-clock-label">Time</span>${timeStr}`;
    $espClock.title = 'ESP32 time: ' + d.toLocaleString();
}

// ── Battery indicator ─────────────────────────────────────────────────────────
function updateBatteryIndicator() {
    if (!$batteryIndicator) return;
    const pct = status.batteryPct;
    if (pct == null) {
        $batteryIndicator.classList.add('hidden');
        return;
    }
    const level = pct > 50 ? 'high' : pct > 20 ? 'medium' : 'low';
    $batteryIndicator.classList.remove('hidden');
    $batteryIndicator.title = `Battery: ${pct}%`;
    $batteryIndicator.innerHTML = `
        <div class="battery-bar"><div class="battery-fill ${level}" style="width:${pct}%"></div></div>
        <span>${pct}%</span>`;
}

// ── Setup screen (first run) ──────────────────────────────────────────────────
function renderSetup() {
    $main.innerHTML = `
      <div class="settings-section" style="max-width:420px;margin:2rem auto">
        <h3>Connect to your ESP32</h3>
        <p class="settings-hint">Enter the URL and API key for your sprinkler controller.</p>
        <div class="form-group">
          <label>ESP32 URL</label>
          <input id="su-url" type="text" value="http://esp-sprinkler.local" />
        </div>
        <div class="form-group">
          <label>Name (optional)</label>
          <input id="su-name" type="text" placeholder="Backyard" />
        </div>
        <div class="form-group">
          <label>API Key</label>
          <input id="su-key" type="text" placeholder="your-api-key" autocomplete="off" spellcheck="false"
                 style="font-family:monospace" value="${esc(getApiKey())}" />
        </div>
        <button id="su-save" class="btn btn-primary" style="width:100%">Connect</button>
      </div>`;

    document.getElementById('su-save').addEventListener('click', async () => {
        const url = document.getElementById('su-url').value.trim().replace(/\/$/, '');
        const name = document.getElementById('su-name').value.trim();
        const key = document.getElementById('su-key').value.trim();
        if (!url) return toast('URL is required', 'error');
        setApiKey(key);
        saveEsp({ url, name: name || 'Sprinkler' });
        esp = getEsp();
        toast('Connecting...', '');
        await loadData();
        startPolling();
    });
}

// ── Status badge helper ─────────────────────────────────────────────────────
function getStatusBadge() {
    if (status.online) {
        if ((status.uptimeSec ?? 9999) < 15) {
            return { cls: 'warming', text: '\u25d4 Warming Up' };
        }
        return { cls: 'online', text: '\u25cf Online' };
    }
    // Offline — but was reachable recently? Likely rebooting.
    const secSinceContact = lastOnlineAt ? (Date.now() - lastOnlineAt) / 1000 : Infinity;
    if (secSinceContact < 30) {
        return { cls: 'warming', text: '\u21bb Reconnecting\u2026' };
    }
    return { cls: 'offline', text: '\u25cb Offline' };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

// Patches only the status bar, badge, and All Off button without rebuilding
// zone cards — preserves any in-progress user edits.
function patchDashboardStatus() {
    const badge = $main.querySelector('.status-badge');
    if (badge) {
        const { cls, text } = getStatusBadge();
        badge.className = `status-badge ${cls}`;
        badge.textContent = text;
    }

    const btnAllOff = $main.querySelector('.ctrl-header .btn-stop');
    if (btnAllOff) {
        btnAllOff.disabled = !status.online || !status.manualRun;
    }

    // Update per-zone run/stop buttons and active styling
    $main.querySelectorAll('.zone-card[data-zone]').forEach(card => {
        const zId = parseInt(card.dataset.zone, 10);
        const isActive = status.activeZone === zId && status.manualRun;
        card.classList.toggle('active', isActive);
        const btnRun = card.querySelector('.btn-run');
        const btnStop = card.querySelector('.btn-stop');
        if (btnRun) btnRun.disabled = !status.online || isActive;
        if (btnStop) btnStop.disabled = !isActive;
    });

    const bar = $main.querySelector('.ctrl-status-bar');
    if (bar) {
        bar.className = `ctrl-status-bar ${status.manualRun ? 'running' : 'idle'}`;
        if (status.manualRun && status.activeZone) {
            const zones = config.zones || [];
            const zone = zones.find(z => z.id === status.activeZone);
            const zName = zone ? zone.name : `Zone ${status.activeZone}`;
            let runType = 'manual';
            if (status.scheduledRun) {
                const idx = (status.activeScheduleIdx ?? -1) + 1;
                runType = idx > 0 ? `schedule ${idx}` : 'scheduled';
            }
            const end = endsAt || Date.now();
            bar.innerHTML = `&#x25B6; ${esc(zName)} <em>${runType}</em> &mdash; <span class="countdown" data-ends="${end}">${fmtSec(Math.max(0, Math.round((end - Date.now()) / 1000)))}</span> remaining`;
        } else {
            bar.innerHTML = '';
        }
    }
}

function renderDashboard() {
    renderedConfigVersion = config.configVersion ?? -1;
    $main.innerHTML = '';

    const zones = config.zones || [];
    const online = status.online;

    // Header bar: name + status badge + All Off
    const hdr = document.createElement('div');
    hdr.className = 'ctrl-header';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'ctrl-name';
    nameSpan.textContent = esp?.name || 'Sprinkler';

    const { cls, text } = getStatusBadge();
    const badge = document.createElement('span');
    badge.className = `status-badge ${cls}`;
    badge.textContent = text;

    const btnAllOff = document.createElement('button');
    btnAllOff.className = 'btn btn-stop btn-sm';
    btnAllOff.textContent = '\u23f9 All Off';
    btnAllOff.title = 'Stop all zones';
    btnAllOff.disabled = !online || !status.manualRun;
    btnAllOff.addEventListener('click', async () => {
        try {
            await espFetch('POST', '/api/manual', { zone: 0, on: false });
            endsAt = 0;
            toast('All zones stopped', 'success');
            await loadData();
        } catch (e) { toast(e.message, 'error'); }
    });

    hdr.append(nameSpan, badge, btnAllOff);
    $main.appendChild(hdr);

    // Active status bar
    const bar = document.createElement('div');
    bar.className = `ctrl-status-bar ${status.manualRun ? 'running' : 'idle'}`;
    if (status.manualRun && status.activeZone) {
        const zone = zones.find(z => z.id === status.activeZone);
        const zName = zone ? zone.name : `Zone ${status.activeZone}`;
        let runType = 'manual';
        if (status.scheduledRun) {
            const idx = (status.activeScheduleIdx ?? -1) + 1;
            runType = idx > 0 ? `schedule ${idx}` : 'scheduled';
        }
        const end = endsAt || Date.now();
        bar.innerHTML = `&#x25B6; ${esc(zName)} <em>${runType}</em> &mdash; <span class="countdown" data-ends="${end}">${fmtSec(Math.max(0, Math.round((end - Date.now()) / 1000)))}</span> remaining`;
    }
    $main.appendChild(bar);

    // Zone grid
    if (!zones.length) {
        const p = document.createElement('p');
        p.style.cssText = 'color:var(--text-muted);font-size:.85rem;padding:1rem 0';
        p.textContent = 'No zones configured. Tap \u2699\ufe0f \u2192 Edit Zones to add some.';
        $main.appendChild(p);
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'zones-grid';
    zones.forEach(zone => grid.appendChild(buildZoneCard(zone)));
    $main.appendChild(grid);
}

// ── Schedule helpers ──────────────────────────────────────────────────────────
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function emptySchedule() {
    return {
        enabled: false, startTime: '07:00', durationMin: 5,
        days: [false, false, false, false, false, false, false]
    };
}

function buildScheduleSlot(idx, sched) {
    const s = sched || emptySchedule();
    const wrap = document.createElement('div');
    wrap.className = 'schedule-slot';
    wrap.dataset.slot = idx;

    const row = document.createElement('div');
    row.className = 'sched-row';

    const enabledCb = document.createElement('input');
    enabledCb.type = 'checkbox'; enabledCb.className = 'sched-enabled';
    enabledCb.checked = !!s.enabled; enabledCb.title = 'Enable this schedule';

    const lbl = document.createElement('span');
    lbl.className = 'sched-label';
    lbl.textContent = `Schedule ${idx + 1}`;

    const timeInput = document.createElement('input');
    timeInput.type = 'time'; timeInput.className = 'sched-time';
    timeInput.value = s.startTime || '07:00';

    const durInput = document.createElement('input');
    durInput.type = 'number'; durInput.className = 'sched-duration';
    durInput.min = 1; durInput.max = 120; durInput.value = s.durationMin || 5;
    durInput.setAttribute('aria-label', 'Duration (minutes)');

    row.append(enabledCb, lbl, timeInput, durInput);
    wrap.appendChild(row);

    const daysRow = document.createElement('div');
    daysRow.className = 'days-row';

    const allLbl = document.createElement('label');
    allLbl.className = 'day-cb day-cb-all';
    const allCb = document.createElement('input');
    allCb.type = 'checkbox';
    const days = s.days || [];
    allCb.checked = days.length > 0 && days.every(Boolean);
    allCb.title = 'Toggle all days';
    const allSpan = document.createElement('span');
    allSpan.textContent = 'All';
    allLbl.append(allCb, allSpan);
    daysRow.appendChild(allLbl);

    const dayCbs = [];
    DAY_LABELS.forEach((d, di) => {
        const lbl2 = document.createElement('label');
        lbl2.className = 'day-cb';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = !!days[di]; cb.dataset.day = di;
        const sp = document.createElement('span');
        sp.textContent = d;
        lbl2.append(cb, sp);
        daysRow.appendChild(lbl2);
        dayCbs.push(cb);
    });

    allCb.addEventListener('change', () => dayCbs.forEach(cb => { cb.checked = allCb.checked; }));
    dayCbs.forEach(cb => cb.addEventListener('change', () => { allCb.checked = dayCbs.every(c => c.checked); }));

    wrap.appendChild(daysRow);
    return wrap;
}

function readScheduleSlot(zCard, idx) {
    const slot = zCard.querySelector(`.schedule-slot[data-slot="${idx}"]`);
    if (!slot) return emptySchedule();
    return {
        enabled: slot.querySelector('.sched-enabled').checked,
        startTime: slot.querySelector('.sched-time').value || '07:00',
        durationMin: parseInt(slot.querySelector('.sched-duration').value, 10) || 5,
        days: Array.from(slot.querySelectorAll('.day-cb input[data-day]')).map(cb => cb.checked),
    };
}

// ── Zone card ─────────────────────────────────────────────────────────────────
function buildZoneCard(zone) {
    const isActive = status.activeZone === zone.id && status.manualRun;
    const online = status.online;
    const schedules = zone.schedules || [emptySchedule(), emptySchedule()];

    const zCard = document.createElement('div');
    zCard.className = `zone-card ${isActive ? 'active' : ''}`;
    zCard.dataset.zone = zone.id;

    const header = document.createElement('div');
    header.className = 'zone-header';

    const nameEl = document.createElement('div');
    nameEl.className = 'zone-name';
    nameEl.textContent = zone.name || `Zone ${zone.id}`;
    header.appendChild(nameEl);

    const controls = document.createElement('div');
    controls.className = 'zone-controls';

    const sel = document.createElement('input');
    sel.type = 'number'; sel.className = 'duration-select';
    sel.min = 1; sel.max = 120; sel.value = getLastDuration(zone.id);
    sel.setAttribute('aria-label', 'Duration (minutes)');
    controls.appendChild(sel);

    const btnRun = document.createElement('button');
    btnRun.className = 'btn btn-run btn-sm';
    btnRun.textContent = '\u25b6'; btnRun.title = `Run zone ${zone.id}`;
    btnRun.disabled = !online || isActive;
    btnRun.addEventListener('click', () => {
        const mins = parseInt(sel.value, 10);
        setLastDuration(zone.id, mins);
        handleManual(zone.id, true, mins);
    });
    controls.appendChild(btnRun);

    const btnStop = document.createElement('button');
    btnStop.className = 'btn btn-stop btn-sm';
    btnStop.textContent = '\u23f9'; btnStop.title = 'Stop';
    btnStop.disabled = !isActive;
    btnStop.addEventListener('click', () => handleManual(zone.id, false));
    controls.appendChild(btnStop);

    header.appendChild(controls);
    zCard.appendChild(header);

    zCard.appendChild(buildScheduleSlot(0, schedules[0]));
    zCard.appendChild(buildScheduleSlot(1, schedules[1]));

    const schedArea = document.createElement('div');
    schedArea.className = 'zone-sched-area';
    const saveStatus = document.createElement('span');
    saveStatus.className = 'sched-save-status';
    schedArea.appendChild(saveStatus);
    zCard.appendChild(schedArea);

    const doSave = debounce(async () => {
        saveStatus.textContent = 'Saving...';
        saveStatus.className = 'sched-save-status saving';
        const newSchedules = [readScheduleSlot(zCard, 0), readScheduleSlot(zCard, 1)];
        const updatedZones = (config.zones || []).map(z =>
            z.id === zone.id ? { ...z, schedules: newSchedules } : z
        );
        try {
            await espFetch('POST', '/api/config', { ...config, zones: updatedZones });
            config.zones = updatedZones;
            saveStatus.textContent = 'Saved \u2713';
            saveStatus.className = 'sched-save-status saved';
            setTimeout(() => { saveStatus.textContent = ''; saveStatus.className = 'sched-save-status'; }, 2000);
        } catch {
            saveStatus.textContent = 'Save failed';
            saveStatus.className = 'sched-save-status error';
        }
    }, 1200);

    zCard.addEventListener('change', e => { if (e.target.closest('.schedule-slot')) doSave(); });
    zCard.addEventListener('input', e => { if (e.target.closest('.schedule-slot')) doSave(); });

    return zCard;
}

// ── Manual run/stop ───────────────────────────────────────────────────────────
async function handleManual(zoneId, on, durationMin) {
    // Pause polling so an in-flight poll can't race and clear endsAt mid-request
    clearInterval(pollTimer);
    try {
        endsAt = on ? Date.now() + (durationMin || 0) * 60 * 1000 : 0;
        const result = await espFetch('POST', '/api/manual', { zone: zoneId, on, durationMin });
        // Prefer ESP's confirmed remainingSec over our pre-calculated estimate
        if (on && result.manualRun && result.remainingSec) {
            endsAt = Date.now() + result.remainingSec * 1000;
        } else if (!result.manualRun) {
            endsAt = 0;
        }
        toast(on ? `Zone ${zoneId} started` : `Zone ${zoneId} stopped`, 'success');
        await loadData();
    } catch (e) {
        endsAt = 0;
        toast(`Error: ${e.message}`, 'error');
    }
    startPolling(); // always restart polling
}

// ── Settings view ─────────────────────────────────────────────────────────────
function renderSettings() {
    activeView = 'settings';
    $main.innerHTML = '';

    const connSection = document.createElement('div');
    connSection.className = 'settings-section';
    connSection.innerHTML = `
      <h3>ESP32 Connection</h3>
      <div class="form-group">
        <label>Name</label>
        <input id="f-name" value="${esc(esp?.name || '')}" placeholder="Backyard" />
      </div>
      <div class="form-group">
        <label>URL</label>
        <input id="f-url" value="${esc(esp?.url || '')}" placeholder="http://esp-sprinkler.local" />
      </div>
      <div class="form-group">
        <label>API Key</label>
        <input id="f-apikey" type="text" autocomplete="off" spellcheck="false"
               style="font-family:monospace" value="${esc(getApiKey())}" />
      </div>
      <button id="btn-save-conn" class="btn btn-primary btn-sm">Save</button>`;
    $main.appendChild(connSection);

    document.getElementById('btn-save-conn').addEventListener('click', () => {
        const url = document.getElementById('f-url').value.trim().replace(/\/$/, '');
        const name = document.getElementById('f-name').value.trim();
        const key = document.getElementById('f-apikey').value.trim();
        if (!url) return toast('URL is required', 'error');
        setApiKey(key);
        saveEsp({ url, name: name || 'Sprinkler' });
        esp = getEsp();
        toast('Settings saved', 'success');
    });

    const zonesSection = document.createElement('div');
    zonesSection.className = 'settings-section';
    const zh3 = document.createElement('h3');
    zh3.textContent = 'Zones';
    zonesSection.appendChild(zh3);
    const btnZones = document.createElement('button');
    btnZones.className = 'btn btn-primary btn-sm';
    btnZones.textContent = '🌿 Edit Zones';
    btnZones.addEventListener('click', openEditZones);
    zonesSection.appendChild(btnZones);
    $main.appendChild(zonesSection);

    // ── Debug section ──────────────────────────────────────────────────────
    const dbgSection = document.createElement('div');
    dbgSection.className = 'settings-section';
    const dbgH3 = document.createElement('h3');
    dbgH3.textContent = 'Debug';
    dbgSection.appendChild(dbgH3);

    const dbgPre = document.createElement('pre');
    dbgPre.id = 'debug-output';
    dbgPre.style.cssText = 'font-size:.72rem;background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:.75rem 1rem;overflow-x:auto;max-height:360px;overflow-y:auto;white-space:pre-wrap;word-break:break-all';
    dbgPre.textContent = 'Press "Fetch Debug" to load…';
    dbgSection.appendChild(dbgPre);

    const btnDbg = document.createElement('button');
    btnDbg.className = 'btn btn-ghost btn-sm';
    btnDbg.style.marginTop = '.5rem';
    btnDbg.textContent = '🔍 Fetch Debug';
    btnDbg.addEventListener('click', async () => {
        btnDbg.disabled = true;
        btnDbg.textContent = 'Loading…';
        try {
            const d = await espFetch('GET', '/api/debug');
            dbgPre.textContent = JSON.stringify(d, null, 2);
        } catch (e) {
            dbgPre.textContent = 'Error: ' + e.message;
        }
        btnDbg.disabled = false;
        btnDbg.textContent = '🔍 Fetch Debug';
    });
    dbgSection.appendChild(btnDbg);
    $main.appendChild(dbgSection);
}
let _modalResolve = null;

function openModal(title, bodyHtml) {
    $modalTitle.textContent = title;
    $modalBody.innerHTML = bodyHtml;
    $backdrop.classList.remove('hidden');
    return new Promise(res => { _modalResolve = res; });
}

function closeModal(value) {
    $backdrop.classList.add('hidden');
    if (_modalResolve) { _modalResolve(value); _modalResolve = null; }
}

$modalOk.addEventListener('click', () => closeModal(true));
$modalCx.addEventListener('click', () => closeModal(false));

function confirmDialog(message) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
          <div class="confirm-box">
            <p class="confirm-msg">${esc(message)}</p>
            <div class="confirm-actions">
              <button class="btn btn-ghost btn-sm" data-v="cancel">Cancel</button>
              <button class="btn btn-danger btn-sm" data-v="ok">Delete</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => {
            const v = e.target.closest('[data-v]')?.dataset.v;
            if (!v) return;
            overlay.remove();
            resolve(v === 'ok');
        });
    });
}

function openEditZones() {
    const zones = (config.zones || []).map(z => ({ ...z }));

    function buildZoneRows() {
        return zones.map((z, i) => `
          <div class="zone-row" data-i="${i}">
            <input type="number" class="z-id" value="${z.id}" min="1" max="8"
                   style="width:52px" placeholder="ID" title="Zone number (relay index)" />
            <input type="text" class="z-name" value="${esc(z.name)}" placeholder="Zone name" />
            <button type="button" class="btn btn-danger btn-sm z-del">\u2715</button>
          </div>`).join('');
    }

    $modalTitle.textContent = 'Edit Zones';
    $modalBody.innerHTML = `
      <div id="zone-rows">${buildZoneRows()}</div>
      <button type="button" id="btn-add-zone" class="btn btn-ghost btn-sm" style="margin-top:.4rem">
        + Add zone
      </button>`;
    $backdrop.classList.remove('hidden');

    function syncRows() {
        document.querySelectorAll('#zone-rows .zone-row').forEach((row, i) => {
            const existing = zones[i] || {};
            zones[i] = {
                ...existing,
                id: parseInt(row.querySelector('.z-id').value, 10) || i + 1,
                name: row.querySelector('.z-name').value.trim() || `Zone ${i + 1}`,
            };
        });
    }

    $modalBody.addEventListener('click', async e => {
        if (!e.target.classList.contains('z-del')) return;
        const row = e.target.closest('[data-i]');
        const zName = row.querySelector('.z-name').value.trim() || `Zone ${parseInt(row.dataset.i, 10) + 1}`;
        if (!await confirmDialog(`Remove zone "${zName}"?`)) return;
        syncRows();
        zones.splice(parseInt(row.dataset.i, 10), 1);
        document.getElementById('zone-rows').innerHTML = buildZoneRows();
    });

    document.getElementById('btn-add-zone').addEventListener('click', () => {
        syncRows();
        zones.push({ id: zones.length + 1, name: `Zone ${zones.length + 1}` });
        document.getElementById('zone-rows').innerHTML = buildZoneRows();
    });

    return new Promise(res => { _modalResolve = res; }).then(async ok => {
        if (!ok) return;
        syncRows();
        try {
            const result = await espFetch('POST', '/api/config', { ...config, zones });
            config.zones = zones;
            toast(`Zones saved (v${result.configVersion}) \u2713`, 'success');
        } catch (e) { toast(e.message, 'error'); }
    });
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goToDashboard() {
    activeView = 'dashboard';
    $btnSettings.textContent = '\u2699\ufe0f';
    $btnSettings.title = 'Settings';
    $appTitle.style.cursor = '';
    loadData();
    startPolling();
}

$appTitle.addEventListener('click', () => {
    if (activeView === 'settings') goToDashboard();
});

$btnSettings.addEventListener('click', () => {
    if (activeView === 'settings') {
        goToDashboard();
    } else {
        clearInterval(pollTimer);
        activeView = 'settings';
        $btnSettings.textContent = '🏠';
        $btnSettings.title = 'Dashboard';
        $appTitle.style.cursor = 'pointer';
        renderSettings();
    }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
loadData();
startPolling();
startCountdown();
