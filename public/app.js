/* ────────────────────────────────────────────────────────────────────────────
   Sprinkler PWA — app.js
   Pure vanilla ES2020; no bundler needed.
──────────────────────────────────────────────────────────────────────────── */

'use strict';

// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = '';          // same origin
const POLL_MS = 10_000;     // refresh UI every 10 s
const DEFAULT_MINS = 10;
const DURATION_OPTIONS = [5, 10, 15, 20, 30];

// ── State ───────────────────────────────────────────────────────────────────
let controllers = [];          // cached controller list
let pollTimer = null;
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
        renderDashboard();
    } catch (e) {
        $main.innerHTML = `<p class="loading" style="color:var(--red)">Failed to load: ${e.message}</p>`;
    }
}

// ── Poll loop ─────────────────────────────────────────────────────────────────
function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
        if (activeView !== 'dashboard') return;
        await loadControllers();
    }, POLL_MS);
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
        bar.innerHTML = `▶ ${esc(zName)} running — <span class="countdown">${fmtSec(status.remainingSec || 0)}</span> remaining`;
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

    // ── Footer
    const footer = document.createElement('div');
    footer.className = 'ctrl-footer';
    const btnAllOff = document.createElement('button');
    btnAllOff.className = 'btn btn-danger btn-sm';
    btnAllOff.textContent = '⏹ All Off';
    btnAllOff.disabled = !online;
    btnAllOff.addEventListener('click', e => { e.stopPropagation(); handleAllOff(ctrl.id); });
    footer.appendChild(btnAllOff);
    body.appendChild(footer);

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

// ── Schedule helpers ──────────────────────────────────────────────────────────
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function emptySchedule() {
    return { enabled: false, startTime: '07:00', durationMin: 10, days: [false, false, false, false, false, false, false] };
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

    const durSel = document.createElement('select');
    durSel.className = 'sched-duration';
    DURATION_OPTIONS.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = `${m} min`;
        if (m === (s.durationMin || 10)) opt.selected = true;
        durSel.appendChild(opt);
    });

    row.appendChild(enabledCb);
    row.appendChild(lbl);
    row.appendChild(timeInput);
    row.appendChild(durSel);
    wrap.appendChild(row);

    // ── row 2: day checkboxes
    const daysRow = document.createElement('div');
    daysRow.className = 'days-row';
    DAY_LABELS.forEach((d, di) => {
        const dayLbl = document.createElement('label');
        dayLbl.className = 'day-cb';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!(s.days || [])[di];
        cb.dataset.day = di;
        const span = document.createElement('span');
        span.textContent = d;
        dayLbl.appendChild(cb);
        dayLbl.appendChild(span);
        daysRow.appendChild(dayLbl);
    });
    wrap.appendChild(daysRow);

    return wrap;
}

function readScheduleSlot(zCard, idx) {
    const slot = zCard.querySelector(`.schedule-slot[data-slot="${idx}"]`);
    if (!slot) return emptySchedule();
    return {
        enabled: slot.querySelector('.sched-enabled').checked,
        startTime: slot.querySelector('.sched-time').value || '07:00',
        durationMin: parseInt(slot.querySelector('.sched-duration').value, 10) || 10,
        days: Array.from(slot.querySelectorAll('.day-cb input[type=checkbox]')).map(cb => cb.checked),
    };
}

async function saveZoneSchedule(ctrl, zoneId, schedules) {
    const zones = (ctrl.config?.zones || []).map(z => z.id === zoneId ? { ...z, schedules } : z);
    try {
        const result = await PUT(`/api/controllers/${ctrl.id}/config`, { ...ctrl.config, zones });
        toast(result.pushed ? 'Schedule saved & pushed to ESP ✓' : 'Schedule saved — ESP offline', result.pushed ? 'success' : 'error');
        await loadControllers();
    } catch (e) { toast(e.message, 'error'); }
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

    const sel = document.createElement('select');
    sel.className = 'duration-select';
    sel.setAttribute('aria-label', 'Duration');
    DURATION_OPTIONS.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = `${m} min`;
        if (m === DEFAULT_MINS) opt.selected = true;
        sel.appendChild(opt);
    });
    controls.appendChild(sel);

    if (isActive) {
        const btnStop = document.createElement('button');
        btnStop.className = 'btn btn-stop btn-sm';
        btnStop.textContent = '⏹';
        btnStop.title = 'Stop';
        btnStop.addEventListener('click', () => handleManual(ctrl.id, zone.id, false));
        controls.appendChild(btnStop);
    } else {
        const btnRun = document.createElement('button');
        btnRun.className = 'btn btn-run btn-sm';
        btnRun.textContent = '▶';
        btnRun.title = `Run zone ${zone.id}`;
        btnRun.disabled = !online;
        btnRun.addEventListener('click', () =>
            handleManual(ctrl.id, zone.id, true, parseInt(sel.value, 10)));
        controls.appendChild(btnRun);
    }

    header.appendChild(controls);
    zCard.appendChild(header);

    // ── Schedule slots
    zCard.appendChild(buildScheduleSlot(0, schedules[0]));
    zCard.appendChild(buildScheduleSlot(1, schedules[1]));

    // ── Save schedule footer
    const schedFooter = document.createElement('div');
    schedFooter.className = 'zone-sched-footer';
    const btnSave = document.createElement('button');
    btnSave.className = 'btn btn-primary btn-sm';
    btnSave.textContent = '💾 Save schedule';
    btnSave.addEventListener('click', () => {
        const newSchedules = [readScheduleSlot(zCard, 0), readScheduleSlot(zCard, 1)];
        saveZoneSchedule(ctrl, zone.id, newSchedules);
    });
    schedFooter.appendChild(btnSave);
    zCard.appendChild(schedFooter);

    return zCard;
}

// ── Actions ───────────────────────────────────────────────────────────────────
async function handleManual(ctrlId, zoneId, on, durationMin) {
    try {
        await POST(`/api/controllers/${ctrlId}/manual`, { zone: zoneId, on, durationMin });
        toast(on ? `Zone ${zoneId} started` : `Zone ${zoneId} stopped`, 'success');
        await loadControllers();
    } catch (e) {
        toast(`Error: ${e.message}`, 'error');
    }
}

async function handleAllOff(ctrlId) {
    try {
        await POST(`/api/controllers/${ctrlId}/alloff`, {});
        toast('All zones stopped', 'success');
        await loadControllers();
    } catch (e) {
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
    if (!confirm(`Delete controller "${id}"?`)) return;
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

    $modalBody.addEventListener('click', e => {
        if (e.target.classList.contains('z-del')) {
            const i = parseInt(e.target.closest('[data-i]').dataset.i, 10);
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
        loadControllers().then(renderSettings);
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
loadControllers();
startPolling();
