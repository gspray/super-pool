'use strict';

/**
 * Mailer — sends the daily zone-run summary via Gmail using Nodemailer.
 *
 * Requires the following settings (stored in settings.json):
 *   emailEnabled  — boolean
 *   emailTo       — recipient address
 *   emailUser     — Gmail address used to send (App-Password auth)
 *   emailPass     — Gmail App Password (NOT the account password)
 */

const nodemailer = require('nodemailer');
const settings = require('./settings');
const runLog = require('./runLog');

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(entries) {
    const date = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const baseStyle = 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1a1a1a';

    if (entries.length === 0) {
        return `
<div style="${baseStyle};max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#0f6cbd">💧 Sprinkler Daily Report</h2>
  <p style="color:#6b6b6b">${date}</p>
  <p>No zones ran today.</p>
</div>`;
    }

    // Group by controller
    const byCtrl = {};
    for (const e of entries) {
        (byCtrl[e.controllerName] = byCtrl[e.controllerName] || []).push(e);
    }

    const totalMin = entries.reduce((s, e) => s + e.durationMin, 0);

    let tables = '';
    for (const [ctrlName, runs] of Object.entries(byCtrl)) {
        const rows = runs.map(r => {
            const time = new Date(r.startedAt).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit',
            });
            return `<tr>
              <td style="padding:8px 12px;border-bottom:1px solid #dde1e6">${time}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #dde1e6">${r.zoneName}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #dde1e6;text-align:right">${r.durationMin.toFixed(1)} min</td>
            </tr>`;
        }).join('');

        tables += `
        <h3 style="margin:20px 0 8px;color:#0f6cbd">${ctrlName}</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid #dde1e6;border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#f3f5f7">
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #dde1e6">Time</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #dde1e6">Zone</th>
              <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #dde1e6">Duration</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    }

    return `
<div style="${baseStyle};max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#0f6cbd">💧 Sprinkler Daily Report</h2>
  <p style="color:#6b6b6b;margin-top:-8px">${date}</p>
  <p><strong>${entries.length} zone run${entries.length !== 1 ? 's' : ''}</strong>
     — <strong>${totalMin.toFixed(1)} min</strong> total runtime</p>
  ${tables}
  <p style="margin-top:24px;font-size:.85em;color:#6b6b6b">Sent automatically by your Sprinkler server at 11:59 pm.</p>
</div>`;
}

// ── Send ──────────────────────────────────────────────────────────────────────

async function sendDailyReport() {
    const s = settings.getAll();

    if (!s.emailEnabled) return;
    if (!s.emailTo || !s.emailUser || !s.emailPass) {
        console.warn('[mailer] Email enabled but credentials incomplete — skipping');
        return;
    }

    const entries = runLog.getToday();
    const html = buildHtml(entries);
    const dateStr = new Date().toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
    const subject = `💧 Sprinkler Report — ${dateStr} (${entries.length} run${entries.length !== 1 ? 's' : ''})`;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: s.emailUser, pass: s.emailPass },
    });

    try {
        await transporter.sendMail({
            from: `Sprinkler 💧 <${s.emailUser}>`,
            to: s.emailTo,
            subject,
            html,
        });
        console.log(`[mailer] Daily report sent to ${s.emailTo} (${entries.length} entries)`);
    } catch (err) {
        console.error(`[mailer] Failed to send report: ${err.message}`);
    }
}

module.exports = { sendDailyReport, buildHtml };
