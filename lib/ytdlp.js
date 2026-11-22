/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
const { execFile } = require('child_process');

const BIN_DIR = path.join(process.cwd(), 'bin');
const TMP_DIR = path.join(process.cwd(), 'database', 'tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });

function assetName() {
    const p = os.platform();
    const a = os.arch();
    if (p === 'win32') return 'yt-dlp.exe';
    if (p === 'darwin') return 'yt-dlp_macos';
    if (p === 'linux') return a === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
    return 'yt-dlp';
}

let binPathPromise = null;
let jsFlags = [];

function ensureYtDlp() {
    if (binPathPromise) return binPathPromise;
    binPathPromise = (async () => {
        const bin = await locateOrDownload();
        await detectJsFlags(bin);
        return bin;
    })().catch((e) => {
        binPathPromise = null;
        throw new Error('Gagal menyiapkan yt-dlp: ' + e.message);
    });
    return binPathPromise;
}

async function detectJsFlags(bin) {
    try {
        const help = await exec(bin, ['--help'], 20000);
        jsFlags = [];
        if (/--js-runtimes/.test(help)) jsFlags.push('--js-runtimes', `node:${process.execPath}`);
        if (/--remote-components/.test(help)) jsFlags.push('--remote-components', 'ejs:github');
        console.log(`[yt-dlp] js runtime: ${jsFlags.length ? 'node (' + process.execPath + ')' : 'tidak didukung, update yt-dlp!'}`);
    } catch (e) {
        console.log('[yt-dlp] gagal cek flag:', e.message);
    }
}

function locateOrDownload() {
    return (async () => {
        if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
        const file = path.join(BIN_DIR, assetName());
        if (fs.existsSync(file)) return file;
        fs.mkdirSync(BIN_DIR, { recursive: true });
        console.log('[yt-dlp] mengunduh binary...');
        const res = await axios.get(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName()}`, {
            responseType: 'arraybuffer',
            maxRedirects: 5,
            timeout: 120000,
        });
        fs.writeFileSync(file, Buffer.from(res.data));
        fs.chmodSync(file, 0o755);
        console.log('[yt-dlp] siap dipakai');
        return file;
    })();
}

let updatePromise = null;
function updateYtDlp() {
    if (!updatePromise) {
        updatePromise = (async () => {
            const bin = await ensureYtDlp();
            try {
                const out = await exec(bin, ['-U'], 120000);
                console.log('[yt-dlp] update:', String(out).trim().split('\n').pop());
                return true;
            } catch (e) {
                console.log('[yt-dlp] update gagal:', e.message);
                return false;
            }
        })();
    }
    return updatePromise;
}

function exec(bin, args, timeout) {
    return new Promise((resolve, reject) => {
        execFile(bin, args, { timeout, maxBuffer: 30 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
                const line = String(stderr || err.message).trim().split('\n').filter(Boolean).pop() || err.message;
                return reject(new Error(line.replace(/^ERROR:\s*/, '')));
            }
            resolve(stdout);
        });
    });
}

let ffmpegChecked = null;
function hasFfmpeg() {
    if (ffmpegChecked !== null) return Promise.resolve(ffmpegChecked);
    return new Promise((resolve) => {
        execFile('ffmpeg', ['-version'], { timeout: 5000 }, (err) => {
            ffmpegChecked = !err;
            resolve(ffmpegChecked);
        });
    });
}

function prepareCookies() {
    const src = process.env.YTDLP_COOKIES || global.ytCookiesPath;
    if (!src) return null;
    if (!fs.existsSync(src)) {
        if (!prepareCookies.warned) console.log(`[yt-dlp] file cookies tidak ditemukan: ${src}`);
        prepareCookies.warned = true;
        return null;
    }
    const dest = path.join(TMP_DIR, 'cookies-runtime.txt');
    try {
        if (!fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs) {
            fs.copyFileSync(src, dest);
        }
        return dest;
    } catch {
        return src;
    }
}

function commonArgs() {
    const args = ['--no-warnings', '--no-playlist', '--no-colors', ...jsFlags];
    const cookies = prepareCookies();
    if (cookies) args.push('--cookies', cookies);
    return args;
}

function isUrl(s) {
    return /^https?:\/\//i.test(String(s).trim());
}

async function search(query, limit = 5) {
    const bin = await ensureYtDlp();
    limit = Math.min(Math.max(parseInt(limit) || 5, 1), 8);
    const out = await exec(
        bin,
        [`ytsearch${limit}:${query}`, '--flat-playlist', '-J', ...commonArgs()],
        45000
    );
    const data = JSON.parse(out);
    return (data.entries || [])
        .filter((e) => e && e.id)
        .map((e) => ({
            title: e.title,
            url: `https://www.youtube.com/watch?v=${e.id}`,
            channel: e.channel || e.uploader || '',
            duration: e.duration || null,
            thumbnail: `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
        }));
}

async function info(url) {
    const bin = await ensureYtDlp();
    const out = await exec(bin, [...commonArgs(), '-J', url], 60000);
    const d = JSON.parse(out);
    return {
        id: d.id,
        title: d.title,
        duration: d.duration || 0,
        isLive: !!d.is_live,
        channel: d.channel || d.uploader || '',
        webpage: d.webpage_url || url,
    };
}

async function download(url, kind) {
    const bin = await ensureYtDlp();
    const id = crypto.randomBytes(6).toString('hex');
    const template = path.join(TMP_DIR, `${id}.%(ext)s`);
    const maxSize = process.env.MAX_MEDIA_MB || global.maxMediaMB || 45;
    const ffmpeg = await hasFfmpeg();

    const build = () => {
        const args = [...commonArgs(), '--max-filesize', `${maxSize}M`, '-o', template];
        if (kind === 'audio') {
            if (ffmpeg) args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '5');
            else args.push('-f', 'ba[ext=m4a]/ba/b[ext=mp4]/b');
        } else {
            args.push('-f', '18/b[ext=mp4][height<=480]/b[height<=480]/b');
        }
        args.push(url);
        return args;
    };

    try {
        await exec(bin, build(), 240000);
    } catch (e) {
        if (/format is not available|nsig|n challenge|signature/i.test(e.message)) {
            console.log('[yt-dlp] format tidak tersedia, mencoba update lalu ulang...');
            if (await updateYtDlp()) {
                await detectJsFlags(bin);
                await exec(bin, build(), 240000);
            } else throw e;
        } else throw e;
    }

    const file = fs
        .readdirSync(TMP_DIR)
        .find((f) => f.startsWith(id + '.') && !f.endsWith('.part') && !f.endsWith('.ytdl'));
    if (!file) throw new Error(`File tidak dihasilkan (kemungkinan lebih besar dari ${maxSize}MB)`);
    const full = path.join(TMP_DIR, file);
    return { path: full, ext: path.extname(file).slice(1).toLowerCase(), size: fs.statSync(full).size };
}

function cleanup(filePath) {
    try {
        fs.unlinkSync(filePath);
    } catch {}
}

module.exports = { search, info, download, cleanup, isUrl, ensureYtDlp };
