#pragma once
// AUTO-GENERATED from data/index.html — do not edit directly
// Re-generated every build by pre_gen_ui.py
static const char UI_HTML[] PROGMEM = R"=====(
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Super Pool</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0
        }

        body {
            font-family: system-ui, sans-serif;
            background: #f3f5f7;
            color: #1a1a2e;
            min-height: 100vh
        }

        header {
            background: #0f6cbd;
            color: #fff;
            padding: .7rem 1rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: .5rem
        }

        header h1 {
            font-size: 1.05rem;
            font-weight: 700;
            cursor: pointer;
            flex: 1
        }

        .esp-clock {
            font-size: .75rem;
            opacity: .85
        }

        .hdr-right {
            display: flex;
            align-items: center;
            gap: .5rem
        }

        .badge {
            font-size: .72rem;
            padding: .18rem .45rem;
            border-radius: 99px;
            background: rgba(255, 255, 255, .18);
            white-space: nowrap
        }

        .badge.online {
            background: #22c55e
        }

        .badge.offline {
            background: #ef4444
        }

        .icon-btn {
            background: none;
            border: none;
            font-size: 1.2rem;
            cursor: pointer;
            line-height: 1;
            color: #fff;
            padding: .1rem .2rem
        }

        .stop-all-bar {
            background: #fff;
            border-bottom: 1px solid #e2e5ea;
            padding: .4rem 1rem;
            display: flex;
            justify-content: flex-end;
            max-width: 100%
        }

        .btn-stop-all {
            background: #ef4444;
            color: #fff;
            border: none;
            border-radius: .4rem;
            padding: .28rem .65rem;
            font-size: .78rem;
            font-weight: 700;
            cursor: pointer;
            line-height: 1.4;
            white-space: nowrap
        }

        .btn-stop-all:disabled {
            opacity: .3;
            cursor: default
        }

        main {
            padding: .85rem;
            max-width: 500px;
            margin: 0 auto
        }

        .zones-grid {
            display: grid;
            gap: .7rem
        }

        .zone-card {
            background: #fff;
            border-radius: .75rem;
            padding: .85rem;
            box-shadow: 0 1px 4px rgba(0, 0, 0, .08);
            border: 2px solid transparent
        }

        .zone-card.active {
            border-color: #0f6cbd;
            background: #eff6ff
        }

        .zone-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: .6rem
        }

        .zone-name {
            font-size: .95rem;
            font-weight: 600
        }

        .zone-controls {
            display: flex;
            align-items: center;
            gap: .4rem
        }

        input[type=number] {
            width: 4.2rem;
            padding: .3rem .4rem;
            border: 1px solid #d1d5db;
            border-radius: .4rem;
            font-size: .88rem;
            text-align: center
        }

        input[type=time] {
            padding: .3rem .4rem;
            border: 1px solid #d1d5db;
            border-radius: .4rem;
            font-size: .85rem
        }

        .btn {
            border: none;
            border-radius: .4rem;
            padding: .34rem .8rem;
            font-size: .82rem;
            font-weight: 600;
            cursor: pointer;
            line-height: 1.4
        }

        .btn:disabled {
            opacity: .38;
            cursor: default
        }

        .btn-primary {
            background: #0f6cbd;
            color: #fff
        }

        .btn-danger {
            background: #ef4444;
            color: #fff
        }

        .btn-run {
            background: #0f6cbd;
            color: #fff
        }

        .btn-stop {
            background: #ef4444;
            color: #fff
        }

        .btn-ghost {
            background: #e5e7eb;
            color: #374151
        }

        .btn-sm {
            padding: .28rem .65rem;
            font-size: .78rem
        }

        .min-lbl {
            font-size: .75rem;
            color: #9ca3af
        }

        .timer {
            font-size: .78rem;
            color: #0f6cbd;
            font-weight: 700
        }

        .sched-divider {
            border: none;
            border-top: 1px solid #f0f0f0;
            margin: .6rem 0
        }

        .sched-slot {
            margin-top: .5rem
        }

        .sched-slot.sched-off .sched-time,
        .sched-slot.sched-off .sched-dur,
        .sched-slot.sched-off .sched-label,
        .sched-slot.sched-off .min-lbl,
        .sched-slot.sched-off .days-row {
            opacity: .3;
            pointer-events: none
        }

        .sched-row {
            display: flex;
            align-items: center;
            gap: .4rem;
            flex-wrap: wrap;
            margin-bottom: .3rem
        }

        .sched-label {
            font-size: .75rem;
            color: #6b7280;
            font-weight: 500;
            min-width: 4rem
        }

        .days-row {
            display: flex;
            gap: .25rem;
            flex-wrap: wrap;
            margin-top: .2rem
        }

        .day-cb {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer
        }

        .day-cb input {
            display: none
        }

        .day-cb span {
            width: 1.65rem;
            height: 1.65rem;
            border-radius: 50%;
            border: 1.5px solid #d1d5db;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: .7rem;
            font-weight: 600;
            color: #6b7280;
            background: #fff
        }

        .day-cb input:checked+span {
            background: #0f6cbd;
            border-color: #0f6cbd;
            color: #fff
        }

        .day-cb-all span {
            border-radius: .35rem;
            width: 2.1rem;
            font-size: .65rem
        }

        .sched-save {
            font-size: .72rem;
            margin-top: .3rem;
            min-height: .9rem;
            color: #6b7280
        }

        .sched-save.saving {
            color: #f59e0b
        }

        .sched-save.saved {
            color: #22c55e
        }

        .sched-save.error {
            color: #ef4444
        }

        .overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, .45);
            display: flex;
            align-items: flex-end;
            justify-content: center;
            z-index: 100
        }

        .sheet {
            background: #fff;
            border-radius: 1rem 1rem 0 0;
            padding: 1.1rem 1rem 1.5rem;
            width: 100%;
            max-width: 480px;
            max-height: 85vh;
            overflow-y: auto
        }

        .sheet h2 {
            font-size: 1rem;
            font-weight: 700;
            margin-bottom: .8rem
        }

        .sheet-actions {
            display: flex;
            gap: .5rem;
            margin-top: .9rem;
            justify-content: flex-end
        }

        .zone-row {
            display: flex;
            gap: .4rem;
            align-items: center;
            margin-bottom: .4rem
        }

        .zone-row .z-id {
            width: 3.5rem
        }

        .zone-row .z-name {
            flex: 1;
            padding: .32rem .5rem;
            border: 1px solid #d1d5db;
            border-radius: .4rem;
            font-size: .88rem
        }

        .settings-section {
            background: #fff;
            border-radius: .75rem;
            padding: .85rem;
            box-shadow: 0 1px 4px rgba(0, 0, 0, .08);
            margin-bottom: .7rem
        }

        .settings-section h3 {
            font-size: .9rem;
            font-weight: 700;
            margin-bottom: .65rem;
            color: #374151
        }

        .form-group {
            margin-bottom: .55rem
        }

        .form-group label {
            font-size: .75rem;
            color: #6b7280;
            display: block;
            margin-bottom: .2rem
        }

        .form-group input {
            width: 100%;
            padding: .42rem .5rem;
            border: 1px solid #d1d5db;
            border-radius: .4rem;
            font-size: .88rem
        }

        .setup-wrap {
            background: #fff;
            border-radius: .75rem;
            padding: 1.1rem;
            box-shadow: 0 1px 4px rgba(0, 0, 0, .08);
            margin-top: 1.2rem
        }

        .setup-wrap h2 {
            font-size: 1rem;
            margin-bottom: .7rem
        }

        .setup-wrap .btn {
            width: 100%;
            padding: .5rem;
            font-size: .92rem;
            background: #0f6cbd;
            color: #fff
        }

        .toast-wrap {
            position: fixed;
            bottom: 1.2rem;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            gap: .35rem;
            z-index: 200;
            pointer-events: none
        }

        .toast {
            background: #1e293b;
            color: #fff;
            padding: .45rem .9rem;
            border-radius: .5rem;
            font-size: .82rem;
            opacity: 0;
            animation: ti .2s forwards, to .3s 2.7s forwards
        }

        .toast.success {
            background: #166534
        }

        .toast.error {
            background: #991b1b
        }

        @keyframes ti {
            to {
                opacity: 1
            }
        }

        @keyframes to {
            to {
                opacity: 0
            }
        }

        /* ── Guest splash overlay ───────────────────────────────────────────── */
        #guest-splash {
            position: fixed;
            inset: 0;
            background: linear-gradient(160deg, #0c4a6e 0%, #0f172a 100%);
            color: #f0f9ff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem 1.5rem;
            z-index: 999;
            text-align: center;
        }

        #guest-splash .splash-icon {
            font-size: 3.5rem;
            margin-bottom: .75rem;
        }

        #guest-splash h2 {
            font-size: 1.5rem;
            font-weight: 700;
            margin: 0 0 .5rem;
        }

        #guest-splash .splash-sub {
            font-size: .95rem;
            opacity: .75;
            margin: 0 0 1.25rem;
            letter-spacing: .02em;
        }

        #guest-splash p {
            font-size: .95rem;
            line-height: 1.6;
            max-width: 340px;
            margin: 0 0 2rem;
            opacity: .9;
        }

        #guest-splash .splash-note {
            font-size: .78rem;
            opacity: .55;
            margin: -1.25rem 0 2rem;
        }

        #btn-splash-go {
            background: #0ea5e9;
            color: #fff;
            border: none;
            border-radius: .6rem;
            padding: .8rem 2.2rem;
            font-size: 1.05rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(14, 165, 233, .4);
        }

        #btn-splash-go:active {
            transform: scale(.97);
        }

        #guest-splash.hidden {
            display: none;
        }
    </style>
</head>

<body>
    <!-- Guest splash — only shown when ?key= param is present (landscaper mode) -->
    <div id="guest-splash" class="hidden">
        <div class="splash-icon">&#x1F4A7;</div>
        <h2>Super Pool Control</h2>
        <div class="splash-sub">Guest Access</div>
        <p>You can view zone status and run zones manually.<br>Schedule and config changes are not available in guest mode.</p>
        <p class="splash-note">&#x1F4F6; Stay within range of the pool equipment enclosure.<br>This network has no internet access.</p>
        <button id="btn-splash-go">Get Started</button>
    </div>
    <header>
        <h1 id="h-title">&#x1F4A7; Super Pool</h1>
        <span id="h-clock" class="esp-clock"></span>
        <div class="hdr-right">
            <span id="h-badge" class="badge">...</span>
            <button class="icon-btn" id="btn-nav" title="Settings">&#x2699;&#xFE0F;</button>
        </div>
    </header>
    <div class="stop-all-bar">
        <button class="btn btn-stop-all" id="btn-alloff">&#x23F9; Stop All</button>
    </div>
    <main id="main"></main>
    <div id="toast-wrap" class="toast-wrap"></div>

    <script>
        const KEY = 'esp_api_key';
        // If a ?key= param is in the URL use it for this session (guest/landscaper mode).
        // Never saved to localStorage — doesn't persist after the tab closes.
        const _urlKey = new URLSearchParams(window.location.search).get('key');
        const guestMode = !!_urlKey;
        let apiKey = _urlKey || localStorage.getItem(KEY) || '';
        if (guestMode) {
            document.getElementById('guest-splash').classList.remove('hidden');
            document.getElementById('btn-splash-go').addEventListener('click', () => {
                document.getElementById('guest-splash').classList.add('hidden');
            });
        }
        let cfg = { zones: [] }, st = {}, endsAt = 0, pollTimer = null, cdTimer = null;
        let view = 'dash', espEpoch = 0, epochAt = 0;
        const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        const QR_WIFI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXIAAAFyAQAAAADAX2ykAAACwElEQVR4nO1bUY6jMAx9MfynUg/Qo9CbjfZmcKCV4HMkkFd2AsywUkg1KtMUv48MxU+VFY+TFzt1jEfQ0UN0wPhp0I59C+OnQTv2LYyfBu3YtzB+GrRj38L4Z5gfF1GHJ2CQp8skT7PtfqA/+aAHuCfmNyzo40vnbiPQ9BW7Oyo18Wv7nw06KX+IGcqtDoNz3A51+KiJfbA/uaBsZsDZ+e6DRwBeEtaPiKvy7/mzB9plnJtfbz4zhis7+CkYGMOx/pDxnzI/nlnXYnQX2Y77itFwzF9mzekffX8uKJsZYPys/O2c/qngmv4q2/F1lIEdICJ6hc1nGvRi/FrHr0VK/+nC0N1GMfBL+0/GT4P18NP0i3SWlTosyH4Ec18xt16OS/K6tflMg14yvqxhXKOqOzE0qroTS/QVFt9C9bP/dIzhIoJZX1WqqDjsvaq5jvGHjP+M+emkgtHdmN09nHonKXdMLqazHod/8v3ZoHyqwvg5+eua/jo6oBbVLEmMqUZ3+RufgkFh85kGvaa+EgQZtZ6E8UVuzbD9t8j4cqtthCCjvqvmfiaafi43vsDSJgphDAeicYm05W/R8eWYtVqaXM9MmDsN0HKlrc/l6udLxaqf+c+NGZ229lHFjdnqz29Rv+KQsJuleZy7/5a/xcaXJZYhqhLQuCd7fVoWbotv4fq5DQvynLWY1+cgoi2+Bcd3wXwgioIKYQjVadNX5d+fhHYFY/5O4SZl7Bke6E8+6AHuifmNZuecuu6jX/SzH3/Dn2xQPvXs+hm6DGsTeKlqIMDqG29zf/LumfVqe0xi7R/JdXe73/4O8YXchP4inRVrEboA/9Ogs/b3WUILcHdfr1xV0t+XQbv/h/hDxn9WfxDxVLTWrxDL0WFPtvNRgf+fzn7fXVS8yPhJUNr8H4yfBu3YtzB+GrRj38L4aZQ+P/8AwJLzICDRvYgAAAAASUVORK5CYII=';

        // ── Utility ──────────────────────────────────────────────────────────────────
        function esc(s) {
            return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
        function fmt(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
        function dbc(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

        function toast(msg, type = '') {
            const w = document.getElementById('toast-wrap');
            const el = document.createElement('div');
            el.className = 'toast ' + (type || '');
            el.textContent = msg;
            w.appendChild(el);
            setTimeout(() => el.remove(), 3200);
        }

        // ── API ──────────────────────────────────────────────────────────────────────
        async function api(method, path, body) {
            const r = await fetch(path, {
                method,
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
                body: body ? JSON.stringify(body) : undefined
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
            return d;
        }

        // ── ESP clock ────────────────────────────────────────────────────────────────
        function tickClock() {
            const el = document.getElementById('h-clock');
            if (!el || !espEpoch) return;
            const epoch = espEpoch + Math.floor((Date.now() - epochAt) / 1000);
            const d = new Date(epoch * 1000);
            el.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }

        // ── Schedule helpers ─────────────────────────────────────────────────────────
        function emptySched() {
            return { enabled: false, startTime: '07:00', durationMin: 5, days: [false, false, false, false, false, false, false] };
        }

        function schedSlotHtml(idx, s) {
            s = s || emptySched();
            const days = s.days || [];
            const allCh = days.length > 0 && days.every(Boolean);
            const dayCbs = DAYS.map((d, i) =>
                '<label class="day-cb"><input type="checkbox"' + (days[i] ? ' checked' : '') +
                ' data-day="' + i + '"><span>' + d + '</span></label>'
            ).join('');
            return '<div class="sched-slot">' +
                '<div class="sched-row">' +
                '<input type="checkbox" class="sched-en"' + (s.enabled ? ' checked' : '') + ' title="Enable"/>' +
                '<span class="sched-label">Sched ' + (idx + 1) + '</span>' +
                '<input type="time" class="sched-time" value="' + esc(s.startTime || '07:00') + '"/>' +
                '<input type="number" class="sched-dur" min="1" max="120" value="' + (s.durationMin || 5) + '"/>' +
                '<span class="min-lbl">min</span>' +
                '</div>' +
                '<div class="days-row">' +
                '<label class="day-cb day-cb-all"><input type="checkbox" class="all-cb"' + (allCh ? ' checked' : '') + '><span>All</span></label>' +
                dayCbs +
                '</div>' +
                '</div>';
        }

        function readScheds(card) {
            return [0, 1].map(idx => {
                const sl = card.querySelectorAll('.sched-slot')[idx];
                if (!sl) return emptySched();
                return {
                    enabled: sl.querySelector('.sched-en').checked,
                    startTime: sl.querySelector('.sched-time').value || '07:00',
                    durationMin: parseInt(sl.querySelector('.sched-dur').value, 10) || 5,
                    days: [...sl.querySelectorAll('input[data-day]')].map(c => c.checked)
                };
            });
        }

        // ── Zone card ────────────────────────────────────────────────────────────────
        function durVal(id) { return parseInt(localStorage.getItem('dur' + id), 10) || 5; }

        function zoneCardHtml(z) {
            const active = (st.manualRun || st.scheduledRun) && st.activeZone === z.id;
            const online = st.online;
            const scheds = z.schedules || [emptySched(), emptySched()];
            const rem = active ? Math.max(0, Math.round((endsAt - Date.now()) / 1000)) : 0;
            return '<div class="zone-card' + (active ? ' active' : '') + '" id="zc' + z.id + '">' +
                '<div class="zone-header">' +
                '<div class="zone-name">' + esc(z.name || 'Zone ' + z.id) + '</div>' +
                '<div class="zone-controls">' +
                '<input type="number" class="dur-input" min="1" max="120" value="' + durVal(z.id) + '"/>' +
                '<span class="min-lbl">min</span>' +
                '<button class="btn btn-run btn-sm"' + ((!online || active) ? ' disabled' : '') + '>&#x25B6;</button>' +
                '<button class="btn btn-stop btn-sm"' + (active ? '' : ' disabled') + '>&#x23F9;' +
                (active ? ' <span class="timer cd-timer">' + fmt(rem) + '</span>' : '') +
                '</button>' +
                '</div>' +
                '</div>' +
                '<hr class="sched-divider"/>' +
                schedSlotHtml(0, scheds[0]) +
                schedSlotHtml(1, scheds[1]) +
                '<div class="sched-save"></div>' +
                '</div>';
        }

        function wireCard(z) {
            const card = document.getElementById('zc' + z.id);
            if (!card) return;

            card.querySelector('.btn-run').addEventListener('click', () => {
                const m = parseInt(card.querySelector('.dur-input').value, 10) || 5;
                localStorage.setItem('dur' + z.id, m);
                manual(z.id, true, m);
            });
            card.querySelector('.btn-stop').addEventListener('click', () => manual(z.id, false));

            const save = dbc(async () => {
                const ss = card.querySelector('.sched-save');
                ss.textContent = 'Saving...'; ss.className = 'sched-save saving';
                const nz = (cfg.zones || []).map(zz => zz.id === z.id ? { ...zz, schedules: readScheds(card) } : zz);
                try {
                    await api('POST', '/api/config', { ...cfg, zones: nz });
                    cfg.zones = nz;
                    ss.textContent = 'Saved \u2713'; ss.className = 'sched-save saved';
                    setTimeout(() => { ss.textContent = ''; ss.className = 'sched-save'; }, 2000);
                } catch (e) {
                    ss.textContent = 'Save failed'; ss.className = 'sched-save error';
                }
            }, 1200);

            card.querySelectorAll('.sched-slot').forEach(sl => {
                const enCb = sl.querySelector('.sched-en');
                const allCb = sl.querySelector('.all-cb');
                const dayCbs = [...sl.querySelectorAll('input[data-day]')];

                function applyEnabled() {
                    sl.classList.toggle('sched-off', !enCb.checked);
                }
                applyEnabled();
                enCb.addEventListener('change', applyEnabled);

                if (allCb) {
                    allCb.addEventListener('change', () => dayCbs.forEach(c => c.checked = allCb.checked));
                    dayCbs.forEach(c => c.addEventListener('change', () => allCb.checked = dayCbs.every(d => d.checked)));
                }
                sl.addEventListener('change', save);
                sl.addEventListener('input', save);
            });
        }

        // ── Badge + alloff ───────────────────────────────────────────────────────────
        function updateBadge() {
            const el = document.getElementById('h-badge');
            if (!el) return;
            const on = st.online;
            el.textContent = on ? 'Online' : 'Offline';
            el.className = 'badge ' + (on ? 'online' : 'offline');
            const ao = document.getElementById('btn-alloff');
            if (ao) ao.disabled = !(on && (st.manualRun || st.scheduledRun));
        }

        // ── Dashboard render ─────────────────────────────────────────────────────────
        function renderDash() {
            const main = document.getElementById('main');
            const zones = cfg.zones || [];
            if (!zones.length) {
                main.innerHTML = '<p style="color:#6b7280;font-size:.85rem;padding:1rem 0">No zones. Tap &#x2699;&#xFE0F; &rarr; Edit Zones to add some.</p>';
                return;
            }
            const active = (st.manualRun || st.scheduledRun) && st.activeZone;
            main.innerHTML =
                '<div class="zones-grid">' + zones.map(z => zoneCardHtml(z)).join('') + '</div>';
            zones.forEach(z => wireCard(z));
        }

        // ── Poll ────────────────────────────────────────────────────────────────────
        function mainHasFocus() {
            const ae = document.activeElement;
            return ae && document.getElementById('main').contains(ae) &&
                (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA');
        }

        // Lightweight patch: updates only active-state, buttons and timers without
        // rebuilding the DOM (used when an input inside #main is focused).
        function patchDash() {
            const active = (st.manualRun || st.scheduledRun) && st.activeZone;
            (cfg.zones || []).forEach(z => {
                const card = document.getElementById('zc' + z.id);
                if (!card) return;
                const isActive = active && st.activeZone === z.id;
                card.classList.toggle('active', !!isActive);
                const runBtn = card.querySelector('.btn-run');
                const stopBtn = card.querySelector('.btn-stop');
                if (runBtn) runBtn.disabled = !st.online || !!isActive;
                if (stopBtn) stopBtn.disabled = !isActive;
            });
        }

        async function poll() {
            try {
                const [s, c] = await Promise.all([api('GET', '/api/status'), api('GET', '/api/config')]);
                st = s; cfg = c || { zones: [] };
                if ((st.manualRun || st.scheduledRun) && st.activeZone && !endsAt) endsAt = Date.now() + (st.remainingSec || 0) * 1000;
                else if (!st.manualRun && !st.scheduledRun) endsAt = 0;
                try {
                    const t = await api('GET', '/api/time');
                    if (t.epoch > 1e9) { espEpoch = t.epoch; epochAt = Date.now(); }
                } catch { }
            } catch { st = { online: false }; }
            if (view === 'dash') {
                if (mainHasFocus()) patchDash();
                else renderDash();
            }
            updateBadge();
        }

        function startPoll() {
            clearInterval(pollTimer);
            pollTimer = setInterval(poll, (st.manualRun || st.scheduledRun) ? 3000 : 8000);
        }

        function startCd() {
            clearInterval(cdTimer);
            cdTimer = setInterval(() => {
                tickClock();
                if (!endsAt) return;
                const rem = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
                document.querySelectorAll('.cd-timer').forEach(el => el.textContent = fmt(rem));
                if (rem === 0) { endsAt = 0; poll(); }
            }, 1000);
        }

        // ── Manual run ───────────────────────────────────────────────────────────────
        async function manual(id, on, mins) {
            clearInterval(pollTimer);
            endsAt = on ? Date.now() + (mins || 0) * 60000 : 0;
            try {
                const r = await api('POST', '/api/manual', { zone: id, on, durationMin: mins });
                if (on && r.manualRun && r.remainingSec) endsAt = Date.now() + r.remainingSec * 1000;
                else if (!r.manualRun) endsAt = 0;
                toast(on ? 'Zone ' + id + ' started' : 'Zone ' + id + ' stopped', 'success');
                await poll();
            } catch (e) { endsAt = 0; toast(e.message, 'error'); }
            startPoll();
        }

        // ── Settings ─────────────────────────────────────────────────────────────────
        function renderSettings() {
            document.getElementById('main').innerHTML =
                '<div class="settings-section">' +
                '<h3>API Key</h3>' +
                '<div class="form-group"><label>Key</label>' +
                '<input id="f-key" type="text" autocomplete="off" spellcheck="false" style="font-family:monospace" value="' + esc(apiKey) + '"/>' +
                '</div>' +
                '<button class="btn btn-primary btn-sm" id="btn-savekey">Save</button>' +
                '</div>' +
                '<div class="settings-section">' +
                '<h3>Zones</h3>' +
                '<button class="btn btn-primary btn-sm" id="btn-editzones">&#x1F33F; Edit Zones</button>' +
                '</div>' +
                '<div class="settings-section">' +
                '<h3>Guest Access</h3>' +
                '<p style="font-size:.85rem;opacity:.7;margin:.25rem 0 .75rem">Print and affix to the enclosure.<br>Guests scan to join the Super Pool Wi\u2011Fi and open the app.</p>' +
                '<div style="display:flex;flex-direction:column;align-items:center;gap:.6rem;margin-bottom:.5rem">' +
                '<img src="' + QR_WIFI + '" style="width:160px;height:160px;border-radius:.5rem;background:#fff;padding:6px" alt="Wi-Fi QR"/>' +
                '<div style="font-size:.8rem;opacity:.6;text-align:center">Network: <b>Super Pool</b><br>Password: <b>superpoolNow</b></div>' +
                '</div>' +
                '<button class="btn btn-primary btn-sm" id="btn-print-qr">&#x1F5A8; Print</button>' +
                '</div>';
            document.getElementById('btn-savekey').onclick = () => {
                const k = document.getElementById('f-key').value.trim();
                if (!k) return toast('API Key required', 'error');
                apiKey = k; localStorage.setItem(KEY, k);
                toast('Saved', 'success');
            };
            document.getElementById('btn-editzones').onclick = openEditZones;
            document.getElementById('btn-print-qr').onclick = () => {
                const w = window.open('', '_blank');
                w.document.write('<html><body style="text-align:center;font-family:sans-serif;padding:2rem">' +
                    '<h2>Super Pool Guest Access</h2>' +
                    '<p>Scan to join the Super Pool Wi-Fi, then the app opens automatically.</p>' +
                    '<img src="' + QR_WIFI + '" style="width:220px;height:220px"/>' +
                    '<p><b>Network:</b> Super Pool &nbsp;&nbsp; <b>Password:</b> superpoolNow</p>' +
                    '<p style="font-size:.85rem;color:#666">Stay within range of the pool equipment enclosure &bull; No internet access</p>' +
                    '<script>window.onload=()=>window.print()<\/script>' +
                    '</body></html>');
                w.document.close();
            };
        }

        // ── Edit Zones sheet ─────────────────────────────────────────────────────────
        function openEditZones() {
            const zones = (cfg.zones || []).map(z => ({ ...z }));

            function rowsHtml() {
                return zones.map((z, i) =>
                    '<div class="zone-row" data-i="' + i + '">' +
                    '<input type="number" class="z-id" value="' + z.id + '" min="1" max="8"/>' +
                    '<input type="text" class="z-name" value="' + esc(z.name) + '" placeholder="Name"/>' +
                    '<button class="btn btn-danger btn-sm z-del" data-i="' + i + '">&#x2715;</button>' +
                    '</div>'
                ).join('');
            }

            function syncRows(sheet) {
                sheet.querySelectorAll('.zone-row').forEach((row, i) => {
                    const ex = zones[i] || {};
                    zones[i] = {
                        ...ex,
                        id: parseInt(row.querySelector('.z-id').value, 10) || i + 1,
                        name: row.querySelector('.z-name').value.trim() || 'Zone ' + (i + 1)
                    };
                });
            }

            const sheet = document.createElement('div');
            sheet.className = 'overlay';
            sheet.innerHTML =
                '<div class="sheet">' +
                '<h2>Edit Zones</h2>' +
                '<div id="zrows">' + rowsHtml() + '</div>' +
                '<button class="btn btn-ghost btn-sm" id="btn-addzone" style="margin-top:.5rem">+ Add zone</button>' +
                '<div class="sheet-actions">' +
                '<button class="btn btn-ghost" id="sh-cancel">Cancel</button>' +
                '<button class="btn btn-primary" id="sh-save">Save</button>' +
                '</div>' +
                '</div>';
            document.body.appendChild(sheet);

            sheet.querySelector('#btn-addzone').onclick = () => {
                syncRows(sheet);
                zones.push({ id: zones.length + 1, name: 'Zone ' + (zones.length + 1), schedules: [emptySched(), emptySched()] });
                sheet.querySelector('#zrows').innerHTML = rowsHtml();
            };
            sheet.querySelector('#sh-cancel').onclick = () => sheet.remove();
            sheet.querySelector('#sh-save').onclick = async () => {
                syncRows(sheet);
                try {
                    const r = await api('POST', '/api/config', { ...cfg, zones });
                    cfg.zones = zones;
                    toast('Zones saved (v' + r.configVersion + ') \u2713', 'success');
                    sheet.remove();
                    if (view === 'dash') renderDash();
                } catch (e) { toast(e.message, 'error'); }
            };
            sheet.querySelector('#zrows').addEventListener('click', e => {
                const btn = e.target.closest('.z-del');
                if (!btn) return;
                syncRows(sheet);
                zones.splice(parseInt(btn.dataset.i, 10), 1);
                sheet.querySelector('#zrows').innerHTML = rowsHtml();
            });
            sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
        }

        // ── Setup screen ─────────────────────────────────────────────────────────────
        function renderSetup() {
            document.getElementById('main').innerHTML =
                '<div class="setup-wrap">' +
                '<h2>Enter API Key</h2>' +
                '<div class="form-group" style="margin-bottom:.7rem">' +
                '<label>Key</label>' +
                '<input id="su-key" type="text" autocomplete="off" spellcheck="false" style="font-family:monospace" autofocus/>' +
                '</div>' +
                '<button class="btn" id="su-save">Connect</button>' +
                '</div>';
            document.getElementById('su-save').onclick = () => {
                const k = document.getElementById('su-key').value.trim();
                if (!k) return toast('API Key required', 'error');
                apiKey = k; localStorage.setItem(KEY, k);
                init();
            };
        }

        // ── Navigation ───────────────────────────────────────────────────────────────
        if (guestMode) {
            // Landscaper QR session — hide settings, show read-only label
            document.getElementById('btn-nav').style.display = 'none';
            document.getElementById('h-title').innerHTML = '&#x1F4A7; Super Pool <span style="font-size:.7rem;opacity:.7;font-weight:400">Guest</span>';
        }

        document.getElementById('btn-nav').addEventListener('click', () => {
            if (guestMode) return; // no settings access in guest mode
            if (view === 'settings') {
                view = 'dash';
                document.getElementById('btn-nav').innerHTML = '&#x2699;&#xFE0F;';
                document.getElementById('h-title').innerHTML = '&#x1F4A7; Super Pool';
                poll(); startPoll();
            } else {
                view = 'settings';
                clearInterval(pollTimer);
                document.getElementById('btn-nav').innerHTML = '&#x1F3E0;';
                document.getElementById('h-title').textContent = 'Settings';
                renderSettings();
            }
        });

        document.getElementById('h-title').addEventListener('click', () => {
            if (view === 'settings') document.getElementById('btn-nav').click();
        });

        document.getElementById('btn-alloff').addEventListener('click', async () => {
            try {
                await api('POST', '/api/manual', { zone: 0, on: false });
                endsAt = 0;
                toast('All zones off', 'success');
                await poll();
            } catch (e) { toast(e.message, 'error'); }
        });

        // ── Boot ─────────────────────────────────────────────────────────────────────
        async function init() {
            if (!apiKey) { renderSetup(); return; }
            await poll();
            startPoll();
            startCd();
        }
        init();
    </script>
</body>

</html>
)=====";
