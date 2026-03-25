/* ────────────────────────────────────────────────────────────────────────────
   Sprinkler PWA — app.js
   Pure vanilla ES2020; no bundler needed.
──────────────────────────────────────────────────────────────────────────── */

'use strict';

// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = '';          // same origin
const POLL_MS = 10_000;     // refresh UI every 10 s
const DEFAULT_MINS = 5;

// ── State ───────────────────────────────────────────────────────────────────
let controllers = [];          // cached controller list
let appSettings = {};          // cached server settings
let pollTimer = null;
let countdownTimer = null;
const countdownEnds = new Map(); // ctrlId → absolute end timestamp (ms)
let activeView = 'dashboard'; // 'dashboard' | 'settings'

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $main = document.getElementById('main');
const $backdrop = document.getElementById('modal-backdrop');
const $modalTitle = document.getElementById('modal-title');
const $modalBody = document.getElementById('modal-body');
const $modalOk = document.getElementById('modal-confirm');
const $modalCx = document.getElementById('modal-cancel');
const $btnSettings = document.getElementById('btn-settings');

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

// ── API key (stored in localStorage) ────────────────────────────────────────
function getApiKey() { return localStorage.getItem('sprinkler_api_key') || ''; }
function setApiKey(k) { localStorage.setItem('sprinkler_api_key', k); }

function getLastDuration(ctrlId, zoneId) {
    return parseInt(localStorage.getItem(`sprinkler_dur_${ctrlId}_${zoneId}`), 10) || DEFAULT_MINS;
}
function setLastDuration(ctrlId, zoneId, mins) {
    localStorage.setItem(`sprinkler_dur_${ctrlId}_${zoneId}`, mins);
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function api(method, path, body) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (method !== 'GET') {
        const key = getApiKey();
        if (key) opts.headers['x-api-key'] = key;
    }
    if (body != null) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

const GET = (p) => api('GET', p);
const POST = (p, b) => api('POST', p, b);
const PUT = (p, b) => api('PUT', p, b);
const DELETE = (p) => api('DELETE', p);

// ── Formatting ────────────────────────────────────────────────────────────────
function fmtSec(s) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadControllers() {
    try {
        controllers = await GET('/api/controllers');
        // Update countdown end timestamps: stamp once on start, clear on stop
        controllers.forEach(ctrl => {
            const s = ctrl.status || {};
            if (s.manualRun && s.activeZone) {
                if (!countdownEnds.has(ctrl.id)) {
                    countdownEnds.set(ctrl.id, Date.now() + (s.remainingSec || 0) * 1000);
                }
            } else {
                countdownEnds.delete(ctrl.id);
            }
        });
        renderDashboard();
    } catch (e) {
        $main.innerHTML = `<p class="loading" style="color:var(--red)">Failed to load: ${e.message}</p>`;
    }
}

async function loadAppSettings() {
    try { appSettings = await GET('/api/settings'); }
    catch { appSettings = {}; }
}

// ── Poll loop ─────────────────────────────────────────────────────────────────
function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
        if (activeView !== 'dashboard') return;
        await loadControllers();
    }, POLL_MS);
}

// ── Countdown tick ────────────────────────────────────────────────────────────
function tickCountdown() {
    document.querySelectorAll('.countdown[data-ends]').forEach(el => {
        const remaining = Math.max(0, Math.round((parseInt(el.dataset.ends, 10) - Date.now()) / 1000));
        el.textContent = fmtSec(remaining);
    });
}

function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(tickCountdown, 1000);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard() {
    if (!controllers.length) {
        $main.innerHTML = `<p class="loading">No controllers yet. Tap ⚙️ to add one.</p>`;
        return;
    }
    $main.innerHTML = '';
    controllers.forEach(ctrl => {
        $main.appendChild(buildCtrlCard(ctrl));
    });
}

function buildCtrlCard(ctrl) {
    const status = ctrl.status || {};
    const zones = ctrl.config?.zones || [];
    const online = status.online;
    const collapseKey = `ctrl_collapsed_${ctrl.id}`;
    let collapsed = localStorage.getItem(collapseKey) === '1';

    const card = document.createElement('div');
    card.className = 'ctrl-card';
    card.dataset.id = ctrl.id;

    // ── Header
    const hdr = document.createElement('div');
    hdr.className = 'ctrl-header';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'ctrl-name';
    nameSpan.textContent = ctrl.name;

    const badge = document.createElement('span');
    badge.className = `status-badge ${online ? 'online' : 'offline'}`;
    badge.textContent = online ? '● Online' : '○ Offline';

    const chevron = document.createElement('span');
    chevron.className = 'ctrl-chevron';
    chevron.textContent = collapsed ? '▶' : '▼';

    hdr.appendChild(nameSpan);
    hdr.appendChild(badge);
    hdr.appendChild(chevron);
    card.appendChild(hdr);

    // ── Collapsible body
    const body = document.createElement('div');
    body.className = 'ctrl-body' + (collapsed ? ' collapsed' : '');

    // ── Active status bar
    const bar = document.createElement('div');
    bar.className = `ctrl-status-bar ${status.manualRun ? 'running' : 'idle'}`;
    if (status.manualRun && status.activeZone) {
        const zone = zones.find(z => z.id === status.activeZone);
        const zName = zone ? zone.name : `Zone ${status.activeZone}`;
        const endsAt = countdownEnds.get(ctrl.id) ?? Date.now();
        bar.innerHTML = `▶ ${esc(zName)} running — <span class="countdown" data-ends="${endsAt}">${fmtSec(Math.max(0, Math.round((endsAt - Date.now()) / 1000)))}</span> remaining`;
    }
    body.appendChild(bar);

    // ── Zones grid
    const grid = document.createElement('div');
    grid.className = 'zones-grid';
    if (zones.length === 0) {
        grid.innerHTML = `<p style="color:var(--text-muted);font-size:.85rem">No zones configured.</p>`;
    } else {
        zones.forEach(zone => grid.appendChild(buildZoneCard(ctrl, zone, status)));
    }
    body.appendChild(grid);

    card.appendChild(body);

    // ── Toggle collapse on header click
    hdr.addEventListener('click', () => {
        collapsed = !collapsed;
        body.classList.toggle('collapsed', collapsed);
        chevron.textContent = collapsed ? '▶' : '▼';
        localStorage.setItem(collapseKey, collapsed ? '1' : '0');
    });

    return card;
}

// ── Debounce ─────────────────────────────────────────────────────────────────
function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Schedule helpers ──────────────────────────────────────────────────────────
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function emptySchedule() {
    return { enabled: false, startTime: '07:00', durationMin: 5, days: [false, false, false, false, false, false, false] };
}

function buildScheduleSlot(idx, sched) {
    const s = sched || emptySchedule();
    const wrap = document.createElement('div');
    wrap.className = 'schedule-slot';
    wrap.dataset.slot = idx;

    // ── row 1: enabled + label + time + duration
    const row = document.createElement('div');
    row.className = 'sched-row';

    const enabledCb = document.createElement('input');
    enabledCb.type = 'checkbox';
    enabledCb.className = 'sched-enabled';
    enabledCb.checked = !!s.enabled;
    enabledCb.title = 'Enable this schedule';

    const lbl = document.createElement('span');
    lbl.className = 'sched-label';
    lbl.textContent = `Schedule ${idx + 1}`;

    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.className = 'sched-time';
    timeInput.value = s.startTime || '07:00';

    const durInput = document.createElement('input');
    durInput.type = 'number';
    durInput.className = 'sched-duration';
    durInput.min = 1;
    durInput.max = 120;
    durInput.value = s.durationMin || 5;
    durInput.setAttribute('aria-label', 'Duration (minutes)');

    row.appendChild(enabledCb);
    row.appendChild(lbl);
    row.appendChild(timeInput);
    row.appendChild(durInput);
    wrap.appendChild(row);

    // ── row 2: day checkboxes
    const daysRow = document.createElement('div');
    daysRow.className = 'days-row';

    // "All" toggle
    const allLbl = document.createElement('label');
    allLbl.className = 'day-cb day-cb-all';
    const allCb = document.createElement('input');
    allCb.type = 'checkbox';
    const days = s.days || [];
    allCb.checked = days.length > 0 && days.every(Boolean);
    allCb.title = 'Toggle all days';
    const allSpan = document.createElement('span');
    allSpan.textContent = 'All';
    allLbl.appendChild(allCb);
    allLbl.appendChild(allSpan);
    daysRow.appendChild(allLbl);

    const dayCbs = [];
    DAY_LABELS.forEach((d, di) => {
        const dayLbl = document.createElement('label');
        dayLbl.className = 'day-cb';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!days[di];
        cb.dataset.day = di;
        const span = document.createElement('span');
        span.textContent = d;
        dayLbl.appendChild(cb);
        dayLbl.appendChild(span);
        daysRow.appendChild(dayLbl);
        dayCbs.push(cb);
    });

    // All checkbox logic
    allCb.addEventListener('change', () => {
        dayCbs.forEach(cb => { cb.checked = allCb.checked; });
    });
    dayCbs.forEach(cb => cb.addEventListener('change', () => {
        allCb.checked = dayCbs.every(c => c.checked);
    }));

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

async function saveZoneSchedule(ctrl, zoneId, schedules) {
    const zones = (ctrl.config?.zones || []).map(z => z.id === zoneId ? { ...z, schedules } : z);
    await PUT(`/api/controllers/${ctrl.id}/config`, { ...ctrl.config, zones });
}

// ── Zone card ─────────────────────────────────────────────────────────────────
function buildZoneCard(ctrl, zone, status) {
    const isActive = status.activeZone === zone.id && status.manualRun;
    const online = status.online;
    const schedules = zone.schedules || [emptySchedule(), emptySchedule()];

    const zCard = document.createElement('div');
    zCard.className = `zone-card ${isActive ? 'active' : ''}`;

    // ── Header: name + run controls
    const header = document.createElement('div');
    header.className = 'zone-header';

    const name = document.createElement('div');
    name.className = 'zone-name';
    name.textContent = zone.name || `Zone ${zone.id}`;
    header.appendChild(name);

    const controls = document.createElement('div');
    controls.className = 'zone-controls';

    const sel = document.createElement('input');
    sel.type = 'number';
    sel.className = 'duration-select';
    sel.min = 1;
    sel.max = 120;
    sel.value = getLastDuration(ctrl.id, zone.id);
    sel.setAttribute('aria-label', 'Duration (minutes)');
    controls.appendChild(sel);

    const btnRun = document.createElement('button');
    btnRun.className = 'btn btn-run btn-sm';
    btnRun.textContent = '▶';
    btnRun.title = `Run zone ${zone.id}`;
    btnRun.disabled = !online || isActive;
    btnRun.addEventListener('click', () => {
        const mins = parseInt(sel.value, 10);
        setLastDuration(ctrl.id, zone.id, mins);
        handleManual(ctrl.id, zone.id, true, mins);
    });
    controls.appendChild(btnRun);

    const btnStop = document.createElement('button');
    btnStop.className = 'btn btn-stop btn-sm';
    btnStop.textContent = '⏹';
    btnStop.title = 'Stop';
    btnStop.disabled = !isActive;
    btnStop.addEventListener('click', () => handleManual(ctrl.id, zone.id, false));
    controls.appendChild(btnStop);

    header.appendChild(controls);
    zCard.appendChild(header);

    // ── Schedule slots
    const slot0 = buildScheduleSlot(0, schedules[0]);
    const slot1 = buildScheduleSlot(1, schedules[1]);
    zCard.appendChild(slot0);
    zCard.appendChild(slot1);

    // ── Auto-save schedules on any change (debounced)
    const schedArea = document.createElement('div');
    schedArea.className = 'zone-sched-area';
    const saveStatus = document.createElement('span');
    saveStatus.className = 'sched-save-status';
    schedArea.appendChild(saveStatus);
    zCard.appendChild(schedArea);

    const doSave = debounce(async () => {
        saveStatus.textContent = 'Saving…';
        saveStatus.className = 'sched-save-status saving';
        const newSchedules = [readScheduleSlot(zCard, 0), readScheduleSlot(zCard, 1)];
        try {
            await saveZoneSchedule(ctrl, zone.id, newSchedules);
            saveStatus.textContent = 'Saved ✓';
            saveStatus.className = 'sched-save-status saved';
            setTimeout(() => { saveStatus.textContent = ''; saveStatus.className = 'sched-save-status'; }, 2000);
        } catch {
            saveStatus.textContent = 'Save failed';
            saveStatus.className = 'sched-save-status error';
        }
    }, 1200);

    zCard.addEventListener('change', e => {
        if (e.target.closest('.schedule-slot')) doSave();
    });
    zCard.addEventListener('input', e => {
        if (e.target.closest('.schedule-slot')) doSave();
    });

    return zCard;
}

// ── Actions ───────────────────────────────────────────────────────────────────
async function handleManual(ctrlId, zoneId, on, durationMin) {
    try {
        if (on) {
            countdownEnds.set(ctrlId, Date.now() + (durationMin || 0) * 60 * 1000);
        } else {
            countdownEnds.delete(ctrlId);
        }
        await POST(`/api/controllers/${ctrlId}/manual`, { zone: zoneId, on, durationMin });
        toast(on ? `Zone ${zoneId} started` : `Zone ${zoneId} stopped`, 'success');
        await loadControllers();
    } catch (e) {
        if (on) countdownEnds.delete(ctrlId); // roll back on failure
        toast(`Error: ${e.message}`, 'error');
    }
}

// ── Settings view ─────────────────────────────────────────────────────────────
function renderSettings() {
    activeView = 'settings';
    $main.innerHTML = '';

    // ── API key section
    const keySection = document.createElement('div');
    keySection.className = 'settings-section';
    keySection.innerHTML = `
      <h3>API Key</h3>
      <div class="form-group" style="flex-direction:row;align-items:center;gap:.5rem">
        <input id="f-apikey" type="text" placeholder="Paste your API key" autocomplete="off" spellcheck="false"
               value="${esc(getApiKey())}"
               style="flex:1;font-family:monospace" />
        <button id="btn-save-key" class="btn btn-primary btn-sm">Save</button>
      </div>`;
    $main.appendChild(keySection);
    document.getElementById('btn-save-key').addEventListener('click', () => {
        const val = document.getElementById('f-apikey').value.trim();
        setApiKey(val);
        toast('API key saved', 'success');
    });

    // ── Watchdog section
    const wdSection = document.createElement('div');
    wdSection.className = 'settings-section';
    const maxMin = appSettings.maxZoneMinutes ?? 30;
    wdSection.innerHTML = `
      <h3>Watchdog</h3>
      <p class="settings-hint">Independent safety timer. If a zone runs longer than this limit the server
        will force it off, even if the app is closed.</p>
      <div class="form-group" style="flex-direction:row;align-items:center;gap:.5rem">
        <label style="white-space:nowrap">Max zone runtime</label>
        <input id="f-max-min" type="number" min="0" step="1" value="${maxMin}"
               style="width:5rem" />
        <span style="color:var(--text-muted);font-size:.85rem">minutes &nbsp;(0 = disabled)</span>
        <button id="btn-save-wd" class="btn btn-primary btn-sm" style="margin-left:auto">Save</button>
      </div>`;
    $main.appendChild(wdSection);
    document.getElementById('btn-save-wd').addEventListener('click', async () => {
        const val = parseInt(document.getElementById('f-max-min').value, 10);
        if (!Number.isFinite(val) || val < 0) return toast('Enter a valid number (0 to disable)', 'error');
        try {
            appSettings = await PUT('/api/settings', { maxZoneMinutes: val });
            toast(val === 0 ? 'Watchdog disabled' : `Watchdog set to ${val} min`, 'success');
        } catch (e) { toast(e.message, 'error'); }
    });

    // ── Email report section
    const emailSection = document.createElement('div');
    emailSection.className = 'settings-section';
    emailSection.innerHTML = `
      <h3>Daily Email Report</h3>
      <p class="settings-hint">Sends a summary of all zones that ran at 11:59 pm each day using your Gmail account.
        Gmail requires an <strong>App Password</strong> — enable 2-Step Verification on your Google account then
        create an App Password at <a href="https://myaccount.google.com/apppasswords" target="_blank">myaccount.google.com/apppasswords</a>.</p>
      <div class="form-group" style="flex-direction:row;align-items:center;gap:.5rem;margin-bottom:.9rem">
        <label style="white-space:nowrap;margin-bottom:0">Enable</label>
        <input id="f-email-enabled" type="checkbox" style="width:1.58rem;height:1.58rem;accent-color:var(--blue);cursor:pointer;flex-shrink:0"
               ${appSettings.emailEnabled ? 'checked' : ''} />
      </div>
      <div class="form-group">
        <label>Send report to</label>
        <input id="f-email-to" type="email" placeholder="you@example.com" value="${esc(appSettings.emailTo || '')}" />
      </div>
      <div class="form-group">
        <label>Gmail address (sender)</label>
        <input id="f-email-user" type="email" placeholder="yourname@gmail.com" value="${esc(appSettings.emailUser || '')}" />
      </div>
      <div class="form-group">
        <label>Gmail App Password</label>
        <input id="f-email-pass" type="password" placeholder="xxxx xxxx xxxx xxxx" autocomplete="new-password"
               value="${esc(appSettings.emailPass || '')}" />
      </div>
      <button id="btn-save-email" class="btn btn-primary btn-sm">Save Email Settings</button>`;
    $main.appendChild(emailSection);
    document.getElementById('btn-save-email').addEventListener('click', async () => {
        const patch = {
            emailEnabled: document.getElementById('f-email-enabled').checked,
            emailTo: document.getElementById('f-email-to').value.trim(),
            emailUser: document.getElementById('f-email-user').value.trim(),
            emailPass: document.getElementById('f-email-pass').value,
        };
        try {
            appSettings = await PUT('/api/settings', patch);
            toast('Email settings saved', 'success');
        } catch (e) { toast(e.message, 'error'); }
    });

    const section = document.createElement('div');
    section.className = 'settings-section';
    const h3 = document.createElement('h3');
    h3.textContent = 'Controllers';
    section.appendChild(h3);

    controllers.forEach(ctrl => {
        const row = document.createElement('div');
        row.className = 'ctrl-list-item';
        row.innerHTML = `
      <div>
        <div class="item-info">${esc(ctrl.name)}</div>
        <div class="item-url">${esc(ctrl.espUrl)}</div>
      </div>`;
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '.4rem';

        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-ghost btn-sm';
        btnEdit.textContent = '✏️ Edit';
        btnEdit.addEventListener('click', () => openEditController(ctrl));
        actions.appendChild(btnEdit);

        const btnZones = document.createElement('button');
        btnZones.className = 'btn btn-primary btn-sm';
        btnZones.textContent = '🌿 Zones';
        btnZones.addEventListener('click', () => openEditZones(ctrl));
        actions.appendChild(btnZones);

        const btnDel = document.createElement('button');
        btnDel.className = 'btn btn-danger btn-sm';
        btnDel.textContent = '🗑';
        btnDel.addEventListener('click', () => handleDeleteController(ctrl.id));
        actions.appendChild(btnDel);

        row.appendChild(actions);
        section.appendChild(row);
    });

    const btnAdd = document.createElement('button');
    btnAdd.className = 'btn btn-primary';
    btnAdd.style.marginTop = '.5rem';
    btnAdd.textContent = '+ Add Controller';
    btnAdd.addEventListener('click', openAddController);
    section.appendChild(btnAdd);

    $main.appendChild(section);
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
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

/**
 * Lightweight confirm overlay — independent of the main modal so it can be
 * used inside the zone editor without clobbering _modalResolve.
 */
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

// ── Add controller ────────────────────────────────────────────────────────────
function openAddController() {
    openModal('Add Controller', `
    <div class="form-group"><label>ID (slug, eg: backyard)</label>
      <input id="f-id" placeholder="backyard" /></div>
    <div class="form-group"><label>Name</label>
      <input id="f-name" placeholder="Backyard" /></div>
    <div class="form-group"><label>ESP32 URL</label>
      <input id="f-url" placeholder="http://192.168.1.50" /></div>
  `).then(async ok => {
        if (!ok) return;
        const id = document.getElementById('f-id')?.value.trim();
        const name = document.getElementById('f-name')?.value.trim();
        const url = document.getElementById('f-url')?.value.trim();
        if (!id || !url) return toast('ID and URL are required', 'error');
        try {
            await POST('/api/controllers', { id, name: name || id, espUrl: url });
            toast('Controller added', 'success');
            await loadControllers();
            renderSettings();
        } catch (e) { toast(e.message, 'error'); }
    });
}

// ── Edit controller ───────────────────────────────────────────────────────────
function openEditController(ctrl) {
    openModal(`Edit: ${ctrl.name}`, `
    <div class="form-group"><label>Name</label>
      <input id="f-name" value="${esc(ctrl.name)}" /></div>
    <div class="form-group"><label>ESP32 URL</label>
      <input id="f-url" value="${esc(ctrl.espUrl)}" /></div>
  `).then(async ok => {
        if (!ok) return;
        const name = document.getElementById('f-name')?.value.trim();
        const url = document.getElementById('f-url')?.value.trim();
        try {
            await PUT(`/api/controllers/${ctrl.id}`, { name, espUrl: url });
            toast('Saved', 'success');
            await loadControllers();
            renderSettings();
        } catch (e) { toast(e.message, 'error'); }
    });
}

// ── Delete controller ─────────────────────────────────────────────────────────
async function handleDeleteController(id) {
    if (!await confirmDialog(`Delete controller "${id}"?`)) return;
    try {
        await DELETE(`/api/controllers/${id}`);
        toast('Deleted', 'success');
        await loadControllers();
        renderSettings();
    } catch (e) { toast(e.message, 'error'); }
}

// ── Zone editor ───────────────────────────────────────────────────────────────
function openEditZones(ctrl) {
    const zones = (ctrl.config?.zones || []).map(z => ({ ...z }));

    function buildZoneRows() {
        return zones.map((z, i) => `
      <div class="zone-row" data-i="${i}">
        <input type="number" class="z-id" value="${z.id}" min="1" max="16"
               style="width:52px" placeholder="ID" title="Zone number (relay index)" />
        <input type="text" class="z-name" value="${esc(z.name)}" placeholder="Zone name" />
        <button type="button" class="btn btn-danger btn-sm z-del">✕</button>
      </div>`).join('');
    }

    $modalTitle.textContent = `Zones: ${ctrl.name}`;
    $modalBody.innerHTML = `
    <div id="zone-rows">${buildZoneRows()}</div>
    <button type="button" id="btn-add-zone" class="btn btn-ghost btn-sm" style="margin-top:.4rem">
      + Add zone
    </button>`;
    $backdrop.classList.remove('hidden');

    function syncZoneRows() {
        document.querySelectorAll('#zone-rows .zone-row').forEach((row, i) => {
            zones[i] = {
                id: parseInt(row.querySelector('.z-id').value, 10) || i + 1,
                name: row.querySelector('.z-name').value.trim() || `Zone ${i + 1}`,
            };
        });
    }

    $modalBody.addEventListener('click', async e => {
        if (e.target.classList.contains('z-del')) {
            const row = e.target.closest('[data-i]');
            const zoneName = row.querySelector('.z-name').value.trim() || `Zone ${parseInt(row.dataset.i, 10) + 1}`;
            if (!await confirmDialog(`Remove zone "${zoneName}"?`)) return;
            const i = parseInt(row.dataset.i, 10);
            syncZoneRows();
            zones.splice(i, 1);
            document.getElementById('zone-rows').innerHTML = buildZoneRows();
        }
    });

    document.getElementById('btn-add-zone').addEventListener('click', () => {
        syncZoneRows();
        zones.push({ id: zones.length + 1, name: `Zone ${zones.length + 1}` });
        document.getElementById('zone-rows').innerHTML = buildZoneRows();
    });

    return new Promise(res => { _modalResolve = res; }).then(async ok => {
        if (!ok) return;
        syncZoneRows();
        try {
            const result = await PUT(`/api/controllers/${ctrl.id}/config`, {
                ...ctrl.config,
                zones,
            });
            if (result.pushed) {
                toast('Config saved & pushed to ESP ✓', 'success');
            } else {
                toast('Config saved — ESP offline, will push when back online', 'error');
            }
            await loadControllers();
            renderSettings();
        } catch (e) { toast(e.message, 'error'); }
    });
}

// ── Navigation ────────────────────────────────────────────────────────────────
$btnSettings.addEventListener('click', () => {
    if (activeView === 'settings') {
        activeView = 'dashboard';
        $btnSettings.title = 'Settings';
        clearInterval(pollTimer);
        loadControllers();
        startPolling();
    } else {
        clearInterval(pollTimer);
        activeView = 'settings';
        $btnSettings.title = 'Dashboard';
        Promise.all([loadControllers(), loadAppSettings()]).then(() => renderSettings());
    }
    $btnSettings.textContent = activeView === 'settings' ? '🏠' : '⚙️';
});

// ── Tiny HTML escape ──────────────────────────────────────────────────────────
function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
loadAppSettings();
loadControllers();
startPolling();
startCountdown();
