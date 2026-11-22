/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUNNER = path.join(__dirname, 'drawRunner.js');
const MIN = 256;
const MAX = 2048;
const MAX_CODE = 14000;
const TIMEOUT_MS = 20000;
const MAX_OUT = 14 * 1024 * 1024;

const FORBIDDEN = /\b(constructor|__proto__|prototype|require|import|eval|Function|Reflect|Proxy|globalThis|process|fetch|XMLHttpRequest|WebSocket|WebAssembly|child_process|SharedArrayBuffer|Atomics|setTimeout|setInterval|setImmediate)\b/;
function scanCode(code) {
    const bare = code
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ')
        .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, '""');
    const m = bare.match(FORBIDDEN);
    if (m) throw new Error(`kode memakai "${m[1]}" yang tidak diizinkan; gambar hanya dengan ctx dan fungsi bantu (rect, circle, poly, text, ...)`);
}

function permissionFlag() {
    const f = process.allowedNodeEnvironmentFlags;
    return f.has('--permission') && f.has('--allow-addons') ? '--permission' : null;
}

function resolvePaths() {
    const canvasPath = require.resolve('@napi-rs/canvas');
    const fonts = [];
    try {
        const dir = path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
        for (const f of ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf']) {
            if (fs.existsSync(path.join(dir, f))) fonts.push([path.join(dir, f), 'ZackSans']);
        }
    } catch {}
    const nm = canvasPath.split(`${path.sep}node_modules${path.sep}`)[0] + `${path.sep}node_modules`;
    return { canvasPath, fonts, nm };
}

function drawWithCode({ code, width = 1024, height = 1024 }) {
    return new Promise((resolve, reject) => {
        code = String(code || '');
        if (code.trim().length < 5) return reject(new Error('Kode gambar kosong'));
        if (code.length > MAX_CODE) return reject(new Error(`Kode terlalu panjang (maks ${MAX_CODE} karakter), sederhanakan gambarnya`));
        width = Math.min(Math.max(parseInt(width) || 1024, MIN), MAX);
        height = Math.min(Math.max(parseInt(height) || 1024, MIN), MAX);

        try {
            scanCode(code);
        } catch (e) {
            return reject(e);
        }
        const flag = permissionFlag();
        if (!flag) return reject(new Error('Fitur gambar kode butuh Node.js 22.13 atau lebih baru (ada pengaman permission)'));

        let p;
        try {
            p = resolvePaths();
        } catch (e) {
            return reject(new Error('Pustaka canvas belum terpasang (jalankan npm install)'));
        }

        const args = [
            flag,
            '--allow-addons',
            '--no-warnings',
            `--allow-fs-read=${p.nm}`,
            `--allow-fs-read=${RUNNER}`,
            '--max-old-space-size=192',
            RUNNER,
        ];
        const env = process.platform === 'win32' && process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {};
        const child = spawn(process.execPath, args, { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

        const out = [];
        let outLen = 0;
        let err = '';
        let done = false;
        const finish = (fn, v) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            fn(v);
        };
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            finish(reject, new Error('Menggambar terlalu lama (timeout), sederhanakan kodenya'));
        }, TIMEOUT_MS);

        child.stdout.on('data', (d) => {
            outLen += d.length;
            if (outLen > MAX_OUT) {
                child.kill('SIGKILL');
                return finish(reject, new Error('Hasil gambar terlalu besar'));
            }
            out.push(d);
        });
        child.stderr.on('data', (d) => {
            if (err.length < 4000) err += d;
        });
        child.on('error', (e) => finish(reject, new Error(`Gagal menjalankan penggambar: ${e.message}`)));
        child.on('close', (codeExit) => {
            if (done) return;
            const buf = Buffer.concat(out);
            if (codeExit === 0 && buf.length > 100 && buf.slice(1, 4).toString() === 'PNG') {
                return finish(resolve, { buffer: buf, width, height });
            }
            let msg = 'kode gambar gagal dijalankan';
            const jsonLine = err.split('\n').reverse().find((l) => l.trim().startsWith('{'));
            try {
                const j = JSON.parse(jsonLine);
                msg = `${j.error}${j.line ? ` (baris ${j.line})` : ''}`;
            } catch {
                if (/ERR_ACCESS_DENIED/.test(err)) msg = 'kode mencoba mengakses sesuatu yang dilarang (file/jaringan)';
                else if (/out of memory|heap/i.test(err)) msg = 'gambar terlalu berat (kehabisan memori), sederhanakan kodenya';
                else if (err.trim()) msg = err.trim().split('\n').slice(-1)[0].slice(0, 200);
            }
            finish(reject, new Error(msg));
        });

        child.stdin.on('error', () => {});
        child.stdin.end(JSON.stringify({ code, width, height, canvasPath: p.canvasPath, fonts: p.fonts }));
    });
}

module.exports = { drawWithCode };
