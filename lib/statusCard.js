/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const path = require('path');
const fs = require('fs');
const { createCanvas, GlobalFonts, Path2D } = require('@napi-rs/canvas');

const SANS = 'ZkInter';
const MONO = 'ZkMono';
const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
let fontsReady = false;

function ensureFonts() {
    if (fontsReady) return;
    fontsReady = true;
    try {
        for (const f of fs.readdirSync(FONT_DIR)) {
            if (!f.endsWith('.woff')) continue;
            GlobalFonts.registerFromPath(path.join(FONT_DIR, f), f.startsWith('inter') ? SANS : MONO);
        }
    } catch {}
    try {
        const dir = path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
        GlobalFonts.registerFromPath(path.join(dir, 'DejaVuSans.ttf'), 'ZkFallback');
        GlobalFonts.registerFromPath(path.join(dir, 'DejaVuSans-Bold.ttf'), 'ZkFallback');
    } catch {}
}

const sans = (size, weight = 400) => `${weight} ${size}px ${SANS}, ZkFallback, sans-serif`;
const mono = (size, weight = 500) => `${weight} ${size}px ${MONO}, ZkFallback, monospace`;

const SCALE = 2;
const PAGE_W = 1200;
const MARGIN = 20;
const FRAME_W = PAGE_W - MARGIN * 2;
const HEADER_H = 104;
const PAD = 28;
const GAP_Y = 24;
const GAP_X = 20;
const KPI_H = 189;
const CHART_H = 384;
const FOOTER_H = 20;
const FRAME_H = HEADER_H + PAD + KPI_H + GAP_Y + CHART_H + 24 + FOOTER_H + PAD;
const PAGE_H = FRAME_H + MARGIN * 2;

const K = {
    slate50: '#F8FAFC',
    slate100: '#F1F5F9',
    slate200: '#E2E8F0',
    slate300: '#CBD5E1',
    slate400: '#94A3B8',
    slate500: '#64748B',
    slate600: '#475569',
    slate700: '#334155',
    slate900: '#0F172A',
    blue600: '#2563EB',
    blue700: '#1D4ED8',
    sky500: '#0EA5E9',
    sky400: '#38BDF8',
    page: '#EEF2F7',
};

function fmtBytes(b) {
    if (!b || b < 0) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
    const v = b / Math.pow(1024, i);
    return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${u[i]}`;
}

function fmtRate(b) {
    return `${fmtBytes(b)}/s`;
}

function fmtUptime(sec) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (d > 0) return `${d}h ${h}j ${m}m`;
    return `${h}j ${m}m ${s}d`;
}

function level(pct) {
    if (pct >= 90) return { name: 'Kritis', stroke: '#EF4444', bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA', dot: '#EF4444' };
    if (pct >= 75) return { name: 'Tinggi', stroke: '#F59E0B', bg: '#FFFBEB', fg: '#B45309', border: '#FDE68A', dot: '#F59E0B' };
    return { name: 'Normal', stroke: K.blue600, bg: '#ECFDF5', fg: '#047857', border: '#A7F3D0', dot: '#10B981' };
}

function rr(ctx, x, y, w, h, r) {
    const q = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + q, y);
    ctx.arcTo(x + w, y, x + w, y + h, q);
    ctx.arcTo(x + w, y + h, x, y + h, q);
    ctx.arcTo(x, y + h, x, y, q);
    ctx.arcTo(x, y, x + w, y, q);
    ctx.closePath();
}

function text(ctx, str, x, y, { font, color, align = 'left', spacing = 0 }) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    try {
        ctx.letterSpacing = `${spacing}px`;
    } catch {}
    ctx.fillText(str, x, y);
    try {
        ctx.letterSpacing = '0px';
    } catch {}
}

function measure(ctx, str, font, spacing = 0) {
    ctx.font = font;
    try {
        ctx.letterSpacing = `${spacing}px`;
    } catch {}
    const w = ctx.measureText(str).width;
    try {
        ctx.letterSpacing = '0px';
    } catch {}
    return w;
}

const ICONS = {
    server: [['rect', 3, 3, 18, 7, 2], ['rect', 3, 14, 18, 7, 2], ['dot', 7, 6.5, 1], ['dot', 7, 17.5, 1], ['path', 'M11 6.5h6M11 17.5h6']],
    signal: [['path', 'M2 20h.01'], ['path', 'M7 20v-4'], ['path', 'M12 20v-8'], ['path', 'M17 20V8'], ['path', 'M22 4v16']],
    cpu: [['rect', 4, 4, 16, 16, 2], ['rect', 9, 9, 6, 6, 0], ['path', 'M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3']],
    ram: [['path', 'M6 19v-3M10 19v-3M14 19v-3M18 19v-3M8 11V9M16 11V9M12 11V9M2 15h20'], ['path', 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z']],
    disk: [['ellipse', 12, 5, 9, 3], ['path', 'M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5'], ['path', 'M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3']],
    info: [['circle', 12, 12, 10], ['path', 'M12 16v-4'], ['path', 'M12 8h.01']],
    clock: [['circle', 12, 12, 10], ['path', 'M12 6v6l4 2']],
    hosts: [['rect', 2, 2, 20, 8, 2], ['rect', 2, 14, 20, 8, 2], ['path', 'M6 6h.01'], ['path', 'M6 18h.01']],
    down: [['path', 'M7 10l5 5 5-5'], ['path', 'M12 15V3'], ['path', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4']],
    cube: [['path', 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z']],
    term: [['path', 'M4 17l6-6-6-6'], ['path', 'M12 19h8']],
    hex: [['path', 'M12 2l10 6.5v7L12 22 2 15.5v-7z']],
    chip: [['rect', 4, 4, 16, 16, 2], ['rect', 9, 9, 6, 6, 0]],
};

function icon(ctx, name, x, y, size, color, sw = 2) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = sw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const op of ICONS[name]) {
        if (op[0] === 'rect') {
            rr(ctx, op[1], op[2], op[3], op[4], op[5]);
            ctx.stroke();
        } else if (op[0] === 'circle') {
            ctx.beginPath();
            ctx.arc(op[1], op[2], op[3], 0, Math.PI * 2);
            ctx.stroke();
        } else if (op[0] === 'ellipse') {
            ctx.beginPath();
            ctx.ellipse(op[1], op[2], op[3], op[4], 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (op[0] === 'dot') {
            ctx.beginPath();
            ctx.arc(op[1], op[2], op[3], 0, Math.PI * 2);
            ctx.fill();
        } else if (op[0] === 'path') {
            ctx.stroke(new Path2D(op[1]));
        }
    }
    ctx.restore();
}

function card(ctx, x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.05)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#FFFFFF';
    rr(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.95)';
    ctx.lineWidth = 1;
    rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 16);
    ctx.stroke();
}

function glow(ctx, cx, cy, rx, ry, rgb, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawHeader(ctx, s) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, FRAME_W, HEADER_H);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, FRAME_W, 0);
    g.addColorStop(0, '#172554');
    g.addColorStop(0.5, '#1E3A8A');
    g.addColorStop(1, '#2563EB');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FRAME_W, HEADER_H);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= FRAME_W; x += 28) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, HEADER_H);
    }
    for (let y = 0; y <= HEADER_H; y += 28) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(FRAME_W, y + 0.5);
    }
    ctx.stroke();

    glow(ctx, FRAME_W - 80, 64 - 0, 144, 144, '56, 189, 248', 0.22);
    glow(ctx, FRAME_W / 3 + 160, HEADER_H + 8, 160, 88, '96, 165, 250', 0.16);
    ctx.restore();

    const cy = HEADER_H / 2;
    const ix = 32;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    rr(ctx, ix, cy - 24, 48, 48, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 1;
    rr(ctx, ix + 0.5, cy - 23.5, 47, 47, 16);
    ctx.stroke();
    icon(ctx, 'server', ix + 12, cy - 12, 24, '#BAE6FD', 1.8);

    const tx = ix + 48 + 16;
    const title = s.title || 'ZACKIRA AI';
    text(ctx, title, tx, cy - 14, { font: sans(24, 800), color: '#FFFFFF', spacing: -0.4 });
    const tw = measure(ctx, title, sans(24, 800), -0.4);

    const bx = tx + tw + 10;
    const label = 'ONLINE';
    const bw = measure(ctx, label, sans(11, 700), 0.6) + 12 + 8 + 6 + 10 + 10 - 6;
    ctx.fillStyle = 'rgba(16,185,129,0.15)';
    rr(ctx, bx, cy - 26, bw, 24, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(52,211,153,0.30)';
    rr(ctx, bx + 0.5, cy - 25.5, bw - 1, 23, 12);
    ctx.stroke();
    ctx.fillStyle = 'rgba(52,211,153,0.30)';
    ctx.beginPath();
    ctx.arc(bx + 18, cy - 14, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#34D399';
    ctx.beginPath();
    ctx.arc(bx + 18, cy - 14, 4, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, label, bx + 29, cy - 14, { font: sans(11, 700), color: '#A7F3D0', spacing: 0.6 });

    text(ctx, 'Status sistem realtime', tx, cy + 14, { font: sans(14, 500), color: 'rgba(219,234,254,0.85)' });

    const ping = Math.round(s.ping);
    const pingText = `${ping} ms`;
    const pw = measure(ctx, pingText, mono(26, 700), -0.3);
    const lw = measure(ctx, 'LATENCY', sans(11, 700), 1.6) + 20;
    const boxW = 16 + Math.max(lw, 70) + 14 + 1 + 14 + pw + 16;
    const boxH = 56;
    const bxr = FRAME_W - 32 - boxW;
    const byr = cy - boxH / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    rr(ctx, bxr, byr, boxW, boxH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    rr(ctx, bxr + 0.5, byr + 0.5, boxW - 1, boxH - 1, 16);
    ctx.stroke();

    icon(ctx, 'signal', bxr + 16, byr + 13, 14, '#7DD3FC', 2.2);
    text(ctx, 'LATENCY', bxr + 16 + 20, byr + 20, { font: sans(11, 700), color: 'rgba(219,234,254,0.9)', spacing: 1.6 });
    const st = ping < 180 ? { t: 'Optimal', c: '#A7F3D0', d: '#34D399' } : ping < 400 ? { t: 'Stabil', c: '#FDE68A', d: '#FBBF24' } : { t: 'Lambat', c: '#FECACA', d: '#F87171' };
    ctx.fillStyle = st.d;
    ctx.beginPath();
    ctx.arc(bxr + 16 + 3, byr + 38, 3, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, st.t, bxr + 16 + 12, byr + 38, { font: sans(11, 500), color: st.c });

    const dx = bxr + 16 + Math.max(lw, 70) + 14;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(dx, cy - 16, 1, 32);
    text(ctx, pingText, bxr + boxW - 16, cy + 1, { font: mono(26, 700), color: '#FFFFFF', align: 'right', spacing: -0.3 });
}

function badge(ctx, rightX, cy, lv) {
    const w = measure(ctx, lv.name, sans(11, 600)) + 10 + 6 + 6 + 10;
    const x = rightX - w;
    ctx.fillStyle = lv.bg;
    rr(ctx, x, cy - 10, w, 20, 10);
    ctx.fill();
    ctx.strokeStyle = lv.border;
    ctx.globalAlpha = 0.75;
    rr(ctx, x + 0.5, cy - 9.5, w - 1, 19, 10);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = lv.dot;
    ctx.beginPath();
    ctx.arc(x + 10 + 3, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, lv.name, x + 10 + 6 + 6, cy + 0.5, { font: sans(11, 600), color: lv.fg });
}

function gauge(ctx, cx, cy, pct, color, caption) {
    const r = 38.4;
    const p = Math.max(0, Math.min(100, pct));
    ctx.lineWidth = 8.64;
    ctx.lineCap = 'round';
    ctx.strokeStyle = K.slate200;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    if (p > 0) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p / 100));
        ctx.stroke();
    }
    ctx.lineCap = 'butt';
    text(ctx, `${Math.round(p)}%`, cx, cy - 4, { font: sans(21, 800), color: K.slate900, align: 'center', spacing: -0.3 });
    text(ctx, caption.toUpperCase(), cx, cy + 14, { font: sans(9, 600), color: K.slate400, align: 'center', spacing: 0.8 });
}

function kpi(ctx, x, y, w, m) {
    card(ctx, x, y, w, KPI_H);
    const hy = y + 24 + 14;
    ctx.fillStyle = '#EFF6FF';
    rr(ctx, x + 24, hy - 14, 28, 28, 8);
    ctx.fill();
    ctx.strokeStyle = '#DBEAFE';
    rr(ctx, x + 24.5, hy - 13.5, 27, 27, 8);
    ctx.stroke();
    icon(ctx, m.icon, x + 24 + 6, hy - 8, 16, K.blue600, 2);
    text(ctx, m.label, x + 24 + 28 + 8, hy, { font: sans(12, 700), color: K.slate600, spacing: 0.6 });
    const lv = m.badge || level(m.pct);
    badge(ctx, x + w - 24, hy, lv);

    const by = y + 24 + 28 + 16;
    const bodyH = KPI_H - 24 - 28 - 16 - 24;
    const gcx = x + 24 + 48;
    const gcy = by + bodyH / 2;
    gauge(ctx, gcx, gcy, m.pct, level(m.pct).stroke, m.caption);

    const ix = x + 24 + 96 + 20;
    const iw = w - 24 - 24 - 96 - 20;
    const top = gcy - 48;
    text(ctx, m.value, ix, top + 13, { font: sans(19, 700), color: K.slate900, spacing: -0.2 });
    text(ctx, m.sub, ix, top + 38, { font: sans(13, 500), color: K.slate500 });
    const dy = top + 60;
    ctx.fillStyle = K.slate100;
    ctx.fillRect(ix, dy, iw, 1);
    text(ctx, m.micro[0], ix, dy + 19, { font: sans(11, 400), color: K.slate400 });
    text(ctx, m.micro[1], ix + iw, dy + 19, { font: mono(11, 500), color: K.slate600, align: 'right' });
    const barY = dy + 31;
    ctx.fillStyle = K.slate100;
    rr(ctx, ix, barY, iw, 6, 3);
    ctx.fill();
    const fw = Math.max(6, (iw * Math.max(0, Math.min(100, m.pct))) / 100);
    ctx.fillStyle = level(m.pct).stroke;
    rr(ctx, ix, barY, fw, 6, 3);
    ctx.fill();
}

function smooth(ctx, pts, tension) {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i === 0 ? i : i - 1];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
        ctx.bezierCurveTo(p1.x + (p2.x - p0.x) * tension, p1.y + (p2.y - p0.y) * tension, p2.x - (p3.x - p1.x) * tension, p2.y - (p3.y - p1.y) * tension, p2.x, p2.y);
    }
}

function chartCard(ctx, x, y, w, h, history) {
    card(ctx, x, y, w, h);
    const pts = history.length >= 2 ? history : [...history, ...history, { cpu: 0, ram: 0, t: Date.now() }, { cpu: 0, ram: 0, t: Date.now() }].slice(0, 2);
    const spanSec = Math.max(1, Math.round((pts[pts.length - 1].t - pts[0].t) / 1000));

    text(ctx, 'Riwayat penggunaan', x + 24, y + 24 + 12, { font: sans(16, 700), color: K.slate900, spacing: -0.2 });
    text(ctx, `Telemetri beban prosesor & memori dalam jendela ${spanSec} detik`, x + 24, y + 24 + 24 + 2 + 9, { font: sans(12, 400), color: K.slate400 });

    const items = [['CPU', K.blue700], ['RAM', K.sky500]];
    const wCpu = measure(ctx, 'CPU', sans(12, 600));
    const wRam = measure(ctx, 'RAM', sans(12, 600));
    const lgW = 12 + 18 + wCpu + 8 + 4 + 8 + 18 + wRam + 12;
    const lgX = x + w - 24 - lgW;
    const lgY = y + 24 + 4;
    ctx.fillStyle = K.slate50;
    rr(ctx, lgX, lgY, lgW, 34, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(226,232,240,0.75)';
    rr(ctx, lgX + 0.5, lgY + 0.5, lgW - 1, 33, 12);
    ctx.stroke();
    let cx = lgX + 12;
    items.forEach(([name, color], i) => {
        ctx.fillStyle = color;
        rr(ctx, cx, lgY + 15, 12, 4, 2);
        ctx.fill();
        text(ctx, name, cx + 18, lgY + 17.5, { font: sans(12, 600), color: K.slate700 });
        cx += 18 + (i === 0 ? wCpu : wRam);
        if (i === 0) {
            text(ctx, '|', cx + 8, lgY + 17, { font: sans(12, 400), color: K.slate300 });
            cx += 8 + 4 + 8;
        }
    });

    const cw = w - 48;
    const chh = 272;
    const cx0 = x + 24;
    const cy0 = y + 24 + 44 + 20;
    const pad = { top: 12, right: 14, bottom: 28, left: 42 };
    const pw = cw - pad.left - pad.right;
    const ph = chh - pad.top - pad.bottom;
    const n = pts.length;
    const gx = (i) => cx0 + pad.left + (i / (n - 1)) * pw;
    const gy = (v) => cy0 + pad.top + ((100 - Math.max(0, Math.min(100, v))) / 100) * ph;
    const bottom = cy0 + pad.top + ph;

    for (const t of [100, 75, 50, 25, 0]) {
        const yy = gy(t);
        ctx.strokeStyle = t === 0 ? K.slate300 : K.slate200;
        ctx.lineWidth = 1;
        ctx.setLineDash(t === 0 ? [] : [4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx0 + pad.left, Math.round(yy) + 0.5);
        ctx.lineTo(cx0 + cw - pad.right, Math.round(yy) + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        text(ctx, `${t}%`, cx0 + pad.left - 10, yy, { font: mono(11, 500), color: K.slate400, align: 'right' });
    }

    const cpu = pts.map((p, i) => ({ x: gx(i), y: gy(p.cpu) }));
    const ram = pts.map((p, i) => ({ x: gx(i), y: gy(p.ram) }));

    const area = (series, tension, c0, c1) => {
        const g = ctx.createLinearGradient(0, cy0 + pad.top, 0, bottom);
        g.addColorStop(0, c0);
        g.addColorStop(1, c1);
        ctx.beginPath();
        smooth(ctx, series, tension);
        ctx.lineTo(series[series.length - 1].x, bottom);
        ctx.lineTo(series[0].x, bottom);
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
    };
    area(ram, 0.25, 'rgba(14,165,233,0.13)', 'rgba(14,165,233,0)');
    area(cpu, 0.2, 'rgba(29,78,216,0.16)', 'rgba(29,78,216,0)');

    const line = (series, tension, color) => {
        ctx.beginPath();
        smooth(ctx, series, tension);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };
    line(ram, 0.25, K.sky400);
    line(cpu, 0.2, K.blue700);

    const endDot = (p, color) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = color;
        ctx.stroke();
    };
    endDot(ram[n - 1], K.sky400);
    endDot(cpu[n - 1], K.blue700);

    ctx.strokeStyle = K.slate300;
    ctx.lineWidth = 1;
    for (const f of [0.25, 0.5, 0.75]) {
        const tx = Math.round(gx(Math.round((n - 1) * f))) + 0.5;
        ctx.beginPath();
        ctx.moveTo(tx, bottom);
        ctx.lineTo(tx, bottom + 4);
        ctx.stroke();
    }
    text(ctx, `${spanSec} dtk lalu`, cx0 + pad.left, cy0 + chh - 10, { font: sans(11, 500), color: K.slate400 });
    text(ctx, 'sekarang', cx0 + cw - pad.right, cy0 + chh - 10, { font: sans(11, 600), color: K.slate500, align: 'right' });
}

function infoCard(ctx, x, y, w, h, s) {
    card(ctx, x, y, w, h);
    const hy = y + 24 + 14;
    ctx.fillStyle = K.slate100;
    rr(ctx, x + 24, hy - 14, 28, 28, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(226,232,240,0.8)';
    rr(ctx, x + 24.5, hy - 13.5, 27, 27, 8);
    ctx.stroke();
    icon(ctx, 'info', x + 24 + 6, hy - 8, 16, K.slate700, 2);
    text(ctx, 'Informasi sistem', x + 24 + 28 + 8, hy, { font: sans(16, 700), color: K.slate900, spacing: -0.2 });
    text(ctx, 'Host & Runtime', x + w - 24, hy, { font: sans(11, 500), color: K.slate400, align: 'right' });

    const rows = [
        ['clock', 'Uptime bot', fmtUptime(s.uptimeBot)],
        ['hosts', 'Uptime server', fmtUptime(s.uptimeServer)],
        ['down', 'NET', `${fmtRate(s.rxRate)}|${fmtRate(s.txRate)}`],
        ['cube', 'Memori bot', fmtBytes(s.botMem)],
        ['term', 'Platform', `${s.platform} ${s.arch}`],
        ['hex', 'Node.js', s.nodeVersion],
        ['chip', 'CPU', `${s.cpuModel} · ${s.cpuSpeed}`],
    ];
    const top = y + 24 + 28 + 12;
    const rowH = (h - 24 - (top - y)) / rows.length;
    rows.forEach((r, i) => {
        const ry = top + i * rowH;
        const cy = ry + rowH / 2;
        if (i > 0) {
            ctx.fillStyle = K.slate100;
            ctx.fillRect(x + 24, Math.round(ry), w - 48, 1);
        }
        icon(ctx, r[0], x + 24, cy - 7, 14, K.slate400, 2);
        let lx = x + 24 + 14 + 8;
        if (r[1] === 'NET') {
            text(ctx, 'Jaringan', lx, cy, { font: sans(13, 500), color: K.slate500 });
            lx += measure(ctx, 'Jaringan', sans(13, 500)) + 6;
            icon(ctx, 'down', lx, cy - 6, 12, K.blue600, 2.6);
            lx += 12 + 4;
            text(ctx, '/', lx, cy, { font: sans(13, 500), color: K.slate500 });
            lx += measure(ctx, '/', sans(13, 500)) + 4;
            ctx.save();
            ctx.translate(lx + 6, cy);
            ctx.scale(1, -1);
            ctx.translate(-(lx + 6), -cy);
            icon(ctx, 'down', lx, cy - 6, 12, K.sky500, 2.6);
            ctx.restore();
        } else {
            text(ctx, r[1], lx, cy, { font: sans(13, 500), color: K.slate500 });
        }
        const small = r[1] === 'CPU';
        const f = mono(small ? 12 : 13, 600);
        if (r[1] === 'NET') {
            const [a, b] = r[2].split('|');
            const wb = measure(ctx, b, f);
            text(ctx, b, x + w - 24, cy, { font: f, color: K.slate900, align: 'right' });
            text(ctx, '/', x + w - 24 - wb - 6, cy, { font: f, color: K.slate300, align: 'right' });
            text(ctx, a, x + w - 24 - wb - 6 - measure(ctx, '/', f) - 6, cy, { font: f, color: K.slate900, align: 'right' });
        } else {
            let v = String(r[2]);
            const maxW = w - 48 - 14 - 8 - measure(ctx, r[1], sans(13, 500)) - 12;
            while (measure(ctx, v, f) > maxW && v.length > 6) v = v.slice(0, -2);
            if (v !== String(r[2])) v = v.trimEnd() + '…';
            text(ctx, v, x + w - 24, cy, { font: f, color: K.slate900, align: 'right' });
        }
    });
}

function renderStatusCard(s) {
    ensureFonts();
    const canvas = createCanvas(PAGE_W * SCALE, PAGE_H * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    ctx.fillStyle = K.page;
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.10)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = K.slate50;
    rr(ctx, MARGIN, MARGIN, FRAME_W, FRAME_H, 22);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(MARGIN, MARGIN);
    rr(ctx, 0, 0, FRAME_W, FRAME_H, 22);
    ctx.clip();
    ctx.fillStyle = K.slate50;
    ctx.fillRect(0, 0, FRAME_W, FRAME_H);

    drawHeader(ctx, s);

    const innerW = FRAME_W - PAD * 2;
    const kw = (innerW - GAP_X * 2) / 3;
    const ky = HEADER_H + PAD;
    const ramPct = s.ramTotal ? (s.ramUsed / s.ramTotal) * 100 : 0;
    const diskPct = s.diskTotal ? (s.diskUsed / s.diskTotal) * 100 : 0;
    const diskLevel = level(diskPct);
    kpi(ctx, PAD, ky, kw, {
        icon: 'cpu', label: 'CPU', pct: s.cpu, caption: 'Beban', value: `${s.cpuCores} Core`, sub: `Load ${s.load.toFixed(2)}`,
        micro: ['Utilisasi', `${Math.round(s.cpu)} / 100%`],
    });
    kpi(ctx, PAD + kw + GAP_X, ky, kw, {
        icon: 'ram', label: 'RAM', pct: ramPct, caption: 'Memori', value: fmtBytes(s.ramUsed), sub: `dari ${fmtBytes(s.ramTotal)}`,
        micro: ['Alokasi', `${fmtBytes(s.ramUsed)} / ${fmtBytes(s.ramTotal)}`],
    });
    kpi(ctx, PAD + (kw + GAP_X) * 2, ky, kw, {
        icon: 'disk', label: 'PENYIMPANAN', pct: diskPct, caption: 'Disk', value: fmtBytes(s.diskUsed), sub: `dari ${fmtBytes(s.diskTotal)}`,
        micro: ['Kapasitas', `${fmtBytes(Math.max(0, s.diskTotal - s.diskUsed))} bebas`],
        badge: diskPct < 75 ? { name: 'Aman', bg: '#F0F9FF', fg: '#0369A1', border: '#BAE6FD', dot: '#0EA5E9' } : diskLevel,
    });

    const by = ky + KPI_H + GAP_Y;
    const col = (innerW - GAP_X * 11) / 12;
    const cw = col * 7 + GAP_X * 6;
    const iw = col * 5 + GAP_X * 4;
    chartCard(ctx, PAD, by, cw, CHART_H, s.history || []);
    infoCard(ctx, PAD + cw + GAP_X, by, iw, CHART_H, s);

    const fy = by + CHART_H + 24 + FOOTER_H / 2;
    ctx.fillStyle = 'rgba(16,185,129,0.9)';
    ctx.beginPath();
    ctx.arc(PAD + 4, fy, 4, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, `Diperbarui ${s.timestamp}`, PAD + 16, fy, { font: sans(12, 500), color: K.slate500 });
    text(ctx, `${s.title || 'ZACKIRA AI'} · v${s.version || '1.0.0'}`, FRAME_W - PAD, fy, { font: mono(11, 600), color: K.slate400, align: 'right', spacing: 0.3 });

    ctx.restore();

    return canvas.toBuffer('image/jpeg', 92);
}

module.exports = { ensureFonts, renderStatusCard, fmtBytes, fmtRate, fmtUptime };
