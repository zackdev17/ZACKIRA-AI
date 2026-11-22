/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const path = require('path');
const { getVar } = require('./botContext.js');
const fs = require('fs');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const FAMILY = 'ZackSans';
let fontsReady = false;
function ensureFonts() {
    if (fontsReady) return;
    fontsReady = true;
    try {
        const dir = path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
        const regular = path.join(dir, 'DejaVuSans.ttf');
        const bold = path.join(dir, 'DejaVuSans-Bold.ttf');
        if (fs.existsSync(regular)) GlobalFonts.registerFromPath(regular, FAMILY);
        if (fs.existsSync(bold)) GlobalFonts.registerFromPath(bold, FAMILY);
    } catch (e) {
        console.log('[imageCard] font DejaVu tidak ditemukan, pakai font sistem:', e.message);
    }
}
const font = (px, bold) => `${bold ? 'bold ' : ''}${px}px "${FAMILY}", "DejaVu Sans", sans-serif`;

const THEMES = {
    dark: { bg1: '#0b1220', bg2: '#1b2540', card: '#222d4a', text: '#f1f5f9', muted: '#a3b0c7', line: '#33415f', accent: '#38bdf8', onAccent: '#06202e' },
    light: { bg1: '#f1f5f9', bg2: '#e2e8f0', card: '#ffffff', text: '#0f172a', muted: '#566377', line: '#d5dde8', accent: '#2563eb', onAccent: '#ffffff' },
    green: { bg1: '#06150f', bg2: '#0f2a1e', card: '#15382a', text: '#ecfdf5', muted: '#9fc7b3', line: '#245240', accent: '#34d399', onAccent: '#052e1c' },
    sunset: { bg1: '#1f1235', bg2: '#4a1d3f', card: '#3a2250', text: '#fdf2f8', muted: '#d1b3d9', line: '#5b3a6e', accent: '#fb923c', onAccent: '#2b1304' },
};

function clean(s, max = 400) {
    s = String(s ?? '')
        .replace(/[\u{1F000}-\u{1FFFF}️‍]/gu, '')
        .replace(/\*\*?([^*\n]+)\*\*?/g, '$1')
        .replace(/`([^`\n]+)`/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function wrap(ctx, text, maxW) {
    const lines = [];
    for (const para of String(text).split('\n')) {
        let line = '';
        for (let word of para.split(' ')) {
            while (ctx.measureText(word).width > maxW && word.length > 1) {
                let cut = word.length - 1;
                while (cut > 1 && ctx.measureText(word.slice(0, cut)).width > maxW) cut--;
                if (line) {
                    lines.push(line);
                    line = '';
                }
                lines.push(word.slice(0, cut));
                word = word.slice(cut);
            }
            const test = line ? `${line} ${word}` : word;
            if (!line || ctx.measureText(test).width <= maxW) line = test;
            else {
                lines.push(line);
                line = word;
            }
        }
        lines.push(line);
    }
    return lines.length ? lines : [''];
}

function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
}

function background(ctx, W, H, t) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, t.bg1);
    g.addColorStop(1, t.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
}

const PAD = 56;
const W = 1080;

function pickTheme(theme, accent) {
    const t = { ...(THEMES[String(theme || 'dark').toLowerCase()] || THEMES.dark) };
    if (/^#[0-9a-f]{6}$/i.test(accent || '')) t.accent = accent;
    return t;
}

function header(ctx, title, subtitle) {
    ctx.font = font(54, true);
    const tl = wrap(ctx, title, W - PAD * 2);
    ctx.font = font(28, false);
    const sl = subtitle ? wrap(ctx, subtitle, W - PAD * 2) : [];
    return { tl, sl, height: tl.length * 66 + (sl.length ? 10 + sl.length * 38 : 0) + 36 };
}

function drawHeader(ctx, h, t, y) {
    ctx.textBaseline = 'top';
    ctx.fillStyle = t.accent;
    rr(ctx, PAD, y, 90, 8, 4);
    ctx.fill();
    y += 26;
    ctx.fillStyle = t.text;
    ctx.font = font(54, true);
    for (const l of h.tl) {
        ctx.fillText(l, PAD, y);
        y += 66;
    }
    if (h.sl.length) {
        y += 10;
        ctx.fillStyle = t.muted;
        ctx.font = font(28, false);
        for (const l of h.sl) {
            ctx.fillText(l, PAD, y);
            y += 38;
        }
    }
    return y + 10;
}

function footerText(ctx, t, y, text) {
    ctx.font = font(22, false);
    ctx.fillStyle = t.muted;
    ctx.textBaseline = 'top';
    ctx.fillText(text, PAD, y);
}

function renderListCard(o) {
    ensureFonts();
    const t = pickTheme(o.theme, o.accent);
    const items = (Array.isArray(o.items) ? o.items : [])
        .map((it) => (typeof it === 'string' ? { title: it } : it || {}))
        .map((it) => ({ title: clean(it.title ?? it.judul ?? '', 160), desc: clean(it.description ?? it.desc ?? '', 420) }))
        .filter((it) => it.title || it.desc)
        .slice(0, 24);
    if (!items.length) throw new Error('items kosong');
    const numbered = o.numbered !== false;
    const footer = clean(o.footer ?? (getVar('botname') ? `Dibuat oleh ${getVar('botname')}` : ''), 80);

    const m = createCanvas(W, 100).getContext('2d');
    const hd = header(m, clean(o.title || 'Daftar', 120), clean(o.subtitle || '', 200));
    const textX = PAD + 30 + 56 + 24;
    const textW = W - PAD - 30 - textX;
    const GAP = 18;
    const laid = items.map((it) => {
        m.font = font(32, true);
        const tl = it.title ? wrap(m, it.title, textW) : [];
        m.font = font(26, false);
        const dl = it.desc ? wrap(m, it.desc, textW) : [];
        const h = 28 * 2 + tl.length * 42 + (dl.length ? (tl.length ? 8 : 0) + dl.length * 36 : 0);
        return { tl, dl, h: Math.max(h, 28 * 2 + 56) };
    });
    const H = Math.min(8000, PAD + hd.height + laid.reduce((a, l) => a + l.h + GAP, 0) + (footer ? 60 : 24) + PAD / 2);

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    background(ctx, W, H, t);
    let y = drawHeader(ctx, hd, t, PAD - 10) + 6;
    ctx.textBaseline = 'top';
    laid.forEach((l, i) => {
        ctx.fillStyle = t.card;
        rr(ctx, PAD, y, W - PAD * 2, l.h, 24);
        ctx.fill();
        ctx.strokeStyle = t.line;
        ctx.lineWidth = 2;
        ctx.stroke();
        const cx = PAD + 30 + 28;
        const cy = y + l.h / 2;
        ctx.fillStyle = t.accent;
        ctx.beginPath();
        ctx.arc(cx, cy, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = t.onAccent;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = font(numbered ? 28 : 24, true);
        ctx.fillText(numbered ? String(i + 1) : '•', cx, cy + 1);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        let ty = l.dl.length ? y + 28 : y + (l.h - l.tl.length * 42) / 2;
        ctx.fillStyle = t.text;
        ctx.font = font(32, true);
        for (const line of l.tl) {
            ctx.fillText(line, textX, ty);
            ty += 42;
        }
        if (l.dl.length) {
            ty += l.tl.length ? 8 : 0;
            ctx.fillStyle = t.muted;
            ctx.font = font(26, false);
            for (const line of l.dl) {
                ctx.fillText(line, textX, ty);
                ty += 36;
            }
        }
        y += l.h + GAP;
    });
    if (footer) footerText(ctx, t, y + 6, footer);
    return { buffer: canvas.toBuffer('image/png'), width: W, height: H };
}

function renderTableCard(o) {
    ensureFonts();
    const t = pickTheme(o.theme, o.accent);
    const columns = (Array.isArray(o.columns) ? o.columns : []).slice(0, 6).map((c) => clean(c, 60));
    const n = columns.length;
    if (!n) throw new Error('columns kosong');
    const rows = (Array.isArray(o.rows) ? o.rows : [])
        .filter(Array.isArray)
        .slice(0, 40)
        .map((r) => Array.from({ length: n }, (_, i) => clean(r[i] ?? '', 200)));
    if (!rows.length) throw new Error('rows kosong');
    const footer = clean(o.footer ?? (getVar('botname') ? `Dibuat oleh ${getVar('botname')}` : ''), 80);

    const fs_ = n > 4 ? 22 : n > 3 ? 24 : 26;
    const lh = Math.round(fs_ * 1.4);
    const CP = 18;
    const VP = 16;
    const avail = W - PAD * 2;
    const m = createCanvas(W, 100).getContext('2d');

    const nat = new Array(n).fill(0);
    const min = new Array(n).fill(0);
    const measureAll = (i, s, bold) => {
        m.font = font(fs_, bold);
        nat[i] = Math.max(nat[i], m.measureText(s).width + CP * 2);
        const longest = Math.max(...s.split(' ').map((w) => m.measureText(w).width), 0);
        min[i] = Math.max(min[i], Math.min(longest + CP * 2, avail / 2.2));
    };
    columns.forEach((c, i) => measureAll(i, c, true));
    rows.forEach((r) => r.forEach((c, i) => measureAll(i, c, false)));
    for (let i = 0; i < n; i++) min[i] = Math.max(min[i], Math.min(nat[i], avail * 0.24));
    let widths = min.slice();
    const sumMin = widths.reduce((x, y) => x + y, 0);
    if (sumMin >= avail) {
        widths = widths.map((w) => (w / sumMin) * avail);
    } else {
        const extra = nat.map((w, i) => Math.max(0, w - min[i]));
        const sumExtra = extra.reduce((x, y) => x + y, 0);
        const free = avail - sumMin;
        widths = widths.map((w, i) => w + (sumExtra ? Math.min(extra[i], (extra[i] / sumExtra) * free * 1.0) : free / n));
        const left = avail - widths.reduce((x, y) => x + y, 0);
        if (left > 0) {
            const grow = extra.map((e) => e || 1);
            const sg = grow.reduce((x, y) => x + y, 0);
            widths = widths.map((w, i) => w + (grow[i] / sg) * left);
        }
    }

    const hd = header(m, clean(o.title || 'Tabel', 120), clean(o.subtitle || '', 200));
    const wrapCell = (s, i, bold) => {
        m.font = font(fs_, bold);
        return wrap(m, s, widths[i] - CP * 2);
    };
    const headLines = columns.map((c, i) => wrapCell(c, i, true));
    const headH = Math.max(...headLines.map((l) => l.length)) * lh + VP * 2;
    const rowLines = rows.map((r) => r.map((c, i) => wrapCell(c, i, false)));
    const rowH = rowLines.map((rl) => Math.max(...rl.map((l) => l.length)) * lh + VP * 2);
    const tableH = headH + rowH.reduce((a, b) => a + b, 0);
    const H = Math.min(8000, PAD + hd.height + tableH + (footer ? 70 : 34) + PAD / 2);

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    background(ctx, W, H, t);
    const y0 = drawHeader(ctx, hd, t, PAD - 10) + 6;

    ctx.save();
    rr(ctx, PAD, y0, avail, tableH, 22);
    ctx.clip();
    ctx.fillStyle = t.card;
    ctx.fillRect(PAD, y0, avail, tableH);
    ctx.fillStyle = t.accent;
    ctx.fillRect(PAD, y0, avail, headH);
    let y = y0 + headH;
    rowH.forEach((h, ri) => {
        if (ri % 2 === 1) {
            ctx.fillStyle = t.bg2;
            ctx.globalAlpha = 0.45;
            ctx.fillRect(PAD, y, avail, h);
            ctx.globalAlpha = 1;
        }
        ctx.fillStyle = t.line;
        ctx.fillRect(PAD, y, avail, 1.5);
        y += h;
    });
    ctx.restore();

    ctx.textBaseline = 'top';
    const draw = (lines, x, top, color, bold) => {
        ctx.fillStyle = color;
        ctx.font = font(fs_, bold);
        lines.forEach((ln, k) => ctx.fillText(ln, x, top + k * lh));
    };
    let x = PAD;
    headLines.forEach((hl, i) => {
        draw(hl, x + CP, y0 + VP, t.onAccent, true);
        x += widths[i];
    });
    y = y0 + headH;
    rowLines.forEach((rl, ri) => {
        x = PAD;
        rl.forEach((cl, i) => {
            draw(cl, x + CP, y + VP, i === 0 ? t.text : t.text, i === 0);
            x += widths[i];
        });
        y += rowH[ri];
    });
    ctx.strokeStyle = t.line;
    ctx.lineWidth = 1.5;
    x = PAD;
    for (let i = 0; i < n - 1; i++) {
        x += widths[i];
        ctx.beginPath();
        ctx.moveTo(x, y0 + headH);
        ctx.lineTo(x, y0 + tableH);
        ctx.stroke();
    }
    if (footer) footerText(ctx, t, y0 + tableH + 22, footer);
    return { buffer: canvas.toBuffer('image/png'), width: W, height: H };
}

module.exports = { renderListCard, renderTableCard, THEMES };
