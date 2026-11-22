/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

'use strict';
const vm = require('vm');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
    try {
        main(JSON.parse(raw));
    } catch (e) {
        fail(e);
    }
});

function fail(e) {
    const msg = String(e && e.message ? e.message : e).slice(0, 300);
    const m = String((e && e.stack) || '').match(/<ai-code>:(\d+):(\d+)/);
    process.stderr.write(JSON.stringify({ error: msg, line: m ? Number(m[1]) : undefined }));
    process.exit(2);
}

function main({ code, width, height, canvasPath, fonts }) {
    const { createCanvas, GlobalFonts } = require(canvasPath);
    for (const [p, fam] of fonts || []) {
        try {
            GlobalFonts.registerFromPath(p, fam);
        } catch {}
    }
    const FAMILY = 'ZackSans';
    const W = width;
    const H = height;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const font = (size = 32, bold = false) => `${bold ? 'bold ' : ''}${Math.round(size)}px "${FAMILY}", sans-serif`;
    const paint = (fill, stroke, lw) => {
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lw || 2;
            ctx.stroke();
        }
    };
    const rect = (x, y, w, h, fill, radius = 0, stroke, lw) => {
        ctx.beginPath();
        if (radius) ctx.roundRect(x, y, w, h, radius);
        else ctx.rect(x, y, w, h);
        paint(fill, stroke, lw);
    };
    const circle = (x, y, r, fill, stroke, lw) => {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
        paint(fill, stroke, lw);
    };
    const ellipse = (x, y, rx, ry, fill, rotation = 0, stroke, lw) => {
        ctx.beginPath();
        ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rotation, 0, Math.PI * 2);
        paint(fill, stroke, lw);
    };
    const line = (x1, y1, x2, y2, color = '#fff', lw = 2) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.stroke();
    };
    const poly = (pts, fill, stroke, lw) => {
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
        paint(fill, stroke, lw);
    };
    const grad = (x0, y0, x1, y1, stops) => {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        (stops || []).forEach((s, i, a) => g.addColorStop(Array.isArray(s) ? s[0] : a.length > 1 ? i / (a.length - 1) : 0, Array.isArray(s) ? s[1] : s));
        return g;
    };
    const rgrad = (x0, y0, r0, x1, y1, r1, stops) => {
        const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
        (stops || []).forEach((s, i, a) => g.addColorStop(Array.isArray(s) ? s[0] : a.length > 1 ? i / (a.length - 1) : 0, Array.isArray(s) ? s[1] : s));
        return g;
    };
    const text = (str, x, y, o = {}) => {
        ctx.font = font(o.size || 32, o.bold);
        ctx.fillStyle = o.color || '#fff';
        ctx.textAlign = o.align || 'left';
        ctx.textBaseline = o.baseline || 'alphabetic';
        ctx.fillText(String(str), x, y);
    };
    const wrap = (str, x, y, maxW, lineH, o = {}) => {
        ctx.font = font(o.size || 32, o.bold);
        ctx.fillStyle = o.color || '#fff';
        ctx.textAlign = o.align || 'left';
        ctx.textBaseline = 'alphabetic';
        let ln = '';
        for (const w of String(str).split(/\s+/)) {
            const t = ln ? `${ln} ${w}` : w;
            if (ln && ctx.measureText(t).width > maxW) {
                ctx.fillText(ln, x, y);
                y += lineH;
                ln = w;
            } else ln = t;
        }
        if (ln) ctx.fillText(ln, x, y);
        return y + lineH;
    };
    let seed = 1234567;
    const rand = (min, max) => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        return min === undefined ? r : max === undefined ? r * min : min + r * (max - min);
    };

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const lock = (obj, key) => {
        try {
            Object.defineProperty(obj, key, { value: undefined, writable: false, configurable: false });
        } catch {}
    };
    lock(Function.prototype, 'constructor');
    for (const f of [async function () {}, function* () {}, async function* () {}]) lock(Object.getPrototypeOf(f), 'constructor');
    lock(Error, 'prepareStackTrace');
    try {
        globalThis.fetch = undefined;
        globalThis.WebAssembly = undefined;
    } catch {}

    const sandbox = { ctx, W, H, font, rect, circle, ellipse, line, poly, grad, rgrad, text, wrap, rand, console: { log() {}, error() {}, warn() {} } };
    vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
    new vm.Script(String(code), { filename: '<ai-code>' }).runInContext(sandbox, { timeout: 8000 });

    const png = canvas.toBuffer('image/png');
    process.stdout.write(png, () => process.exit(0));
}
