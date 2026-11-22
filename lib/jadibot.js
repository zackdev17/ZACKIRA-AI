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
const pino = require('pino');
const chalk = require('chalk');
const { Boom } = require('@hapi/boom');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
} = require('@whiskeysockets/baileys');

const { createCtx } = require('./botContext.js');
const { attachHandlers } = require('./botCore.js');
const { resolveNumber } = require('./owner.js');
const rental = require('./rental.js');
const { renderJadibotReceipt } = require('./receipt.js');
const { getOwnerNumbers } = require('./owner.js');

const silent = pino({ level: 'silent' });
const PAIR_TIMEOUT_MS = 2 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 5 * 60 * 1000;
const NUMBER_RE = /^\d{8,15}$/;

const bots = new Map();
const lastRequest = new Map();
let mainZack = null;
let cachedVersion = null;
let restoring = false;
let schedulerTimer = null;
let polling = false;
let ticking = false;
let lastTick = 0;

const root = () => path.join(process.cwd(), 'database', 'jadibot');
const dirOf = (number) => path.join(root(), number);
const sessionOf = (number) => path.join(dirOf(number), 'session');

const enabled = () => String(process.env.JADIBOT_ENABLED || 'true').toLowerCase() !== 'false';
const maxBots = () => Math.max(1, parseInt(process.env.JADIBOT_MAX, 10) || 10);

function setMain(zack) {
    mainZack = zack;
    startScheduler();
}

function botNumbers() {
    const set = new Set(bots.keys());
    const me = mainZack && mainZack.user && mainZack.user.id;
    if (me) set.add(String(me).split('@')[0].split(':')[0].replace(/[^0-9]/g, ''));
    return set;
}

async function isBotPeer(zack, jid) {
    const number = await resolveNumber(zack, jid);
    return !!number && botNumbers().has(number);
}

function notify(number, text) {
    if (!mainZack) return;
    mainZack.sendMessage(`${number}@s.whatsapp.net`, { text }, { quoted: null }).catch(() => {});
}

async function notifyNumber(number, text) {
    return say(`${number}@s.whatsapp.net`, text);
}

async function say(jid, content) {
    if (!mainZack || !jid) return false;
    try {
        await mainZack.sendMessage(jid, typeof content === 'string' ? { text: content } : content, { quoted: null });
        return true;
    } catch (e) {
        console.log(chalk.red('[JADIBOT] gagal kirim pesan:'), e.message);
        return false;
    }
}

function fmtCode(code) {
    const c = String(code || '').replace(/[^A-Za-z0-9]/g, '');
    return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

function pairingText(number, prefix) {
    return (
        `🤖 *JADIBOT* untuk nomor ${number}\n\n` +
        `Cara memasang:\n` +
        `1. Buka WhatsApp di HP nomor ${number}\n` +
        `2. Menu ⋮ > *Perangkat tertaut* > *Tautkan perangkat*\n` +
        `3. Pilih *Tautkan dengan nomor telepon saja*\n` +
        `4. Masukkan kode di pesan berikutnya (berlaku 2 menit)\n\n` +
        `⚠️ Penting:\n` +
        `• Sesi nomormu disimpan di server bot ini.\n` +
        `• Orang lain yang chat ke nomormu akan dibalas bot.\n` +
        `• Atur variabel sendiri dengan *${prefix}varcustom*.\n` +
        `• Bot berhenti otomatis saat masa sewa habis, atau lewat *${prefix}jadibot stop*.\n` +
        `• Jangan berikan kode ini ke orang lain.`
    );
}

async function defaultFactory(number) {
    const { state, saveCreds } = await useMultiFileAuthState(sessionOf(number));
    if (!cachedVersion) {
        try {
            cachedVersion = (await fetchLatestBaileysVersion()).version;
        } catch (e) {
            cachedVersion = null;
        }
    }
    const sock = makeWASocket({
        ...(cachedVersion ? { version: cachedVersion } : {}),
        logger: silent,
        printQRInTerminal: false,
        auth: state,
        browser: ['Ubuntu', 'Chrome', '120.0.0'],
        markOnlineOnConnect: false,
    });
    return { sock, state, saveCreds };
}

let factory = defaultFactory;

function setFactory(fn) {
    factory = fn || defaultFactory;
}

function clearTimers(entry) {
    clearTimeout(entry.pairTimer);
    clearTimeout(entry.retryTimer);
    entry.pairTimer = null;
    entry.retryTimer = null;
}

function wipe(number) {
    try {
        fs.rmSync(dirOf(number), { recursive: true, force: true });
    } catch (e) {
        console.log(chalk.red(`[JADIBOT] gagal hapus data ${number}:`), e.message);
    }
}

function teardown(entry, { deleteFiles }) {
    entry.stopped = true;
    clearTimers(entry);
    bots.delete(entry.number);
    try {
        entry.sock?.end(undefined);
    } catch (e) {
        e;
    }
    if (deleteFiles) wipe(entry.number);
}

async function connect(entry) {
    const { number } = entry;
    const { sock, state, saveCreds } = await factory(number);
    entry.sock = sock;
    attachHandlers(sock, entry.ctx);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        if (entry.sock !== sock) return;
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            entry.status = 'online';
            entry.attempts = 0;
            entry.since = Date.now();
            clearTimeout(entry.pairTimer);
            console.log(chalk.greenBright(`[JADIBOT] ${number} online`));
            if (entry.justPaired) {
                entry.justPaired = false;
                notify(
                    number,
                    `✅ Nomor ini sekarang menjadi bot.\n\n` +
                        `• Kirim *.menu* ke nomor ini dari HP lain untuk mencoba.\n` +
                        `• Atur variabel sendiri dengan *.varcustom*.\n` +
                        `• Berhenti kapan saja dengan *.jadibot stop* (kirim ke bot utama).`
                );
            }
            return;
        }

        if (connection !== 'close') return;
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        if (statusCode === DisconnectReason.restartRequired) clearTimeout(entry.pairTimer);
        if (entry.stopped) return;

        if (statusCode === DisconnectReason.loggedOut) {
            console.log(chalk.yellow(`[JADIBOT] ${number} logout, sesi dihapus`));
            teardown(entry, { deleteFiles: true });
            notify(number, 'Sesi bot di nomor ini sudah logout dari WhatsApp, jadi data bot dihapus. Ketik *.jadibot* lagi untuk memasang ulang.');
            return;
        }
        if (!state.creds.registered && statusCode !== DisconnectReason.restartRequired) {
            teardown(entry, { deleteFiles: true });
            notify(number, 'Pairing gagal / terputus sebelum kode dimasukkan. Ketik *.jadibot* lagi untuk coba ulang.');
            return;
        }
        if (statusCode === DisconnectReason.connectionReplaced) {
            console.log(chalk.yellow(`[JADIBOT] ${number} digantikan sesi lain, dihentikan (data tetap)`));
            teardown(entry, { deleteFiles: false });
            return;
        }

        entry.status = 'reconnecting';
        entry.attempts += 1;
        const delay = statusCode === DisconnectReason.restartRequired ? 500 : Math.min(30000, 2000 * 2 ** Math.min(entry.attempts, 5));
        clearTimeout(entry.retryTimer);
        entry.retryTimer = setTimeout(() => {
            if (entry.stopped) return;
            connect(entry).catch((e) => {
                console.log(chalk.red(`[JADIBOT] ${number} gagal reconnect:`), e.message);
                teardown(entry, { deleteFiles: false });
            });
        }, delay);
    });

    if (!state.creds.registered && entry.wantPair) {
        await new Promise((r) => setTimeout(r, entry.pairDelay));
        const code = await sock.requestPairingCode(number);
        entry.pairTimer = setTimeout(() => {
            if (entry.stopped || state.creds.registered) return;
            teardown(entry, { deleteFiles: true });
            notify(number, 'Kode pairing sudah kedaluwarsa (2 menit). Ketik *.jadibot* lagi untuk minta kode baru.');
        }, PAIR_TIMEOUT_MS);
        entry.pairTimer.unref?.();
        return code;
    }
    return null;
}

function newEntry(number, extra = {}) {
    return {
        number,
        ctx: createCtx({ id: number, number, dbDir: dirOf(number) }),
        sock: null,
        status: 'starting',
        stopped: false,
        attempts: 0,
        since: 0,
        pairTimer: null,
        retryTimer: null,
        wantPair: false,
        pairDelay: 1500,
        justPaired: false,
        ...extra,
    };
}

async function startPairing(number, { cooldownMs = REQUEST_COOLDOWN_MS } = {}) {
    if (!enabled()) return { ok: false, reason: 'disabled' };
    if (!NUMBER_RE.test(number)) return { ok: false, reason: 'invalid' };
    if (bots.has(number)) return { ok: false, reason: 'exists', status: bots.get(number).status };

    const last = lastRequest.get(number) || 0;
    const wait = cooldownMs - (Date.now() - last);
    if (wait > 0) return { ok: false, reason: 'cooldown', waitSec: Math.ceil(wait / 1000) };
    if (bots.size >= maxBots()) return { ok: false, reason: 'full', max: maxBots() };

    lastRequest.set(number, Date.now());
    fs.rmSync(sessionOf(number), { recursive: true, force: true });
    fs.mkdirSync(sessionOf(number), { recursive: true });

    const entry = newEntry(number, { wantPair: true, justPaired: true, status: 'pairing' });
    bots.set(number, entry);
    try {
        const code = await connect(entry);
        return { ok: true, code };
    } catch (e) {
        teardown(entry, { deleteFiles: true });
        lastRequest.delete(number);
        return { ok: false, reason: 'error', message: e.message };
    }
}

async function stop(number) {
    const entry = bots.get(number);
    const hadData = fs.existsSync(dirOf(number));
    if (!entry && !hadData) return false;
    if (entry) {
        entry.stopped = true;
        try {
            await Promise.race([entry.sock?.logout(), new Promise((r) => setTimeout(r, 5000))]);
        } catch (e) {
            e;
        }
        teardown(entry, { deleteFiles: true });
    } else {
        wipe(number);
    }
    return true;
}

function isRegistered(number) {
    try {
        const creds = JSON.parse(fs.readFileSync(path.join(sessionOf(number), 'creds.json'), 'utf8'));
        return creds && creds.registered === true;
    } catch {
        return false;
    }
}

async function restoreAll() {
    if (!enabled() || restoring) return;
    restoring = true;
    try {
        let names = [];
        try {
            names = fs.readdirSync(root()).filter((n) => NUMBER_RE.test(n));
        } catch {
            return;
        }
        for (const number of names) {
            if (bots.has(number) || !isRegistered(number)) continue;
            const rent = rental.getRental(number);
            if (rent && (rent.state === 'expired' || rent.expiresAt <= Date.now())) continue;
            if (bots.size >= maxBots()) break;
            const entry = newEntry(number);
            bots.set(number, entry);
            try {
                await connect(entry);
                console.log(chalk.cyan(`[JADIBOT] dipulihkan: ${number}`));
            } catch (e) {
                console.log(chalk.red(`[JADIBOT] gagal memulihkan ${number}:`), e.message);
                teardown(entry, { deleteFiles: false });
            }
            await new Promise((r) => setTimeout(r, 2500));
        }
    } finally {
        restoring = false;
    }
}

function list() {
    return [...bots.values()].map((e) => ({ number: e.number, status: e.status, since: e.since }));
}

async function onPaid(order, result) {
    const prefix = global.prefix || '.';
    const until = rental.fmtDate(result.rental.expiresAt);
    await say(
        order.requester,
        `✅ *Pembayaran diterima!*\n\n• Paket : ${rental.labelOf(order.days)}\n• Nomor : ${order.number}\n• Aktif sampai : ${until}`
    );
    try {
        const phone = getOwnerNumbers()[0];
        const image = renderJadibotReceipt(order, { buyerName: order.buyerName, storeName: global.botname, phone: phone ? `+${phone}` : undefined });
        await say(order.requester, { image, caption: `🧾 Struk pembayaran ${order.id}` });
    } catch (e) {
        console.log(chalk.red('[JADIBOT] gagal membuat struk:'), e.message);
    }
    if (bots.has(order.number)) {
        await say(order.requester, `Sewa nomor ${order.number} diperpanjang. Bot tetap berjalan.`);
        return;
    }
    const res = await startPairing(order.number, { cooldownMs: 0 });
    if (!res.ok) {
        const why = res.reason === 'full' ? 'kuota jadibot sedang penuh' : res.message || res.reason;
        await say(order.requester, `Sewa sudah aktif, tetapi kode pairing belum bisa dibuat (${why}). Ketik *${prefix}jadibot* sebentar lagi untuk meminta kode.`);
        return;
    }
    await say(order.requester, pairingText(order.number, prefix));
    await say(order.requester, fmtCode(res.code));
}

async function pollOrders() {
    if (polling || !mainZack) return;
    polling = true;
    try {
        const pending = rental.pendingOrders().sort((a, b) => a.createdAt - b.createdAt).slice(0, 5);
        for (const order of pending) {
            const result = await rental.checkOrder(order.id);
            if (result.state === 'paid' && !result.already) {
                await onPaid(order, result);
            } else if (result.state === 'expired' || result.state === 'canceled') {
                await say(order.requester, `Pembayaran ${order.id} ${result.state === 'expired' ? 'kedaluwarsa' : 'dibatalkan'}. Ketik *${global.prefix || '.'}jadibot* untuk memesan lagi.`);
            } else if (result.state === 'rejected') {
                await say(order.requester, `Pembayaran ${order.id} tidak cocok dengan pesanan, jadi tidak diproses. Hubungi owner bila kamu sudah membayar.`);
            }
        }
    } catch (e) {
        console.log(chalk.red('[JADIBOT] poll pesanan error:'), e.message);
    } finally {
        polling = false;
    }
}

async function expireRental(number) {
    const prefix = global.prefix || '.';
    rental.patchRental(number, { state: 'expired', noticed: false });
    const sent = await say(
        `${number}@s.whatsapp.net`,
        `⏰ *Masa sewa jadibot habis*\n\nSewa untuk nomor ${number} sudah berakhir. Sesi bot dihapus dan perangkat tertaut di WhatsApp-mu sudah di-logout, jadi bot di nomor ini berhenti.\n\nMau lanjut? Ketik *${prefix}jadibot* untuk menyewa lagi.`
    );
    await stop(number);
    if (sent) rental.removeRental(number);
    console.log(chalk.yellow(`[JADIBOT] sewa ${number} habis, bot dihentikan`));
}

async function tickRentals() {
    if (ticking || !mainZack) return;
    ticking = true;
    try {
        const now = Date.now();
        for (const r of rental.listRentals()) {
            if (r.state === 'expired') {
                const sent = await say(`${r.number}@s.whatsapp.net`, `⏰ Masa sewa jadibot nomor ${r.number} sudah habis dan bot dihentikan. Ketik *${global.prefix || '.'}jadibot* untuk menyewa lagi.`);
                const tries = (r.tries || 0) + 1;
                if (sent || tries >= 30) rental.removeRental(r.number);
                else rental.patchRental(r.number, { tries });
                continue;
            }
            if (r.expiresAt <= now) {
                await expireRental(r.number);
                continue;
            }
            const left = r.expiresAt - now;
            if (left <= 3 * 3600000 && !r.warn3) {
                rental.patchRental(r.number, { warn3: true, warn24: true });
                await say(`${r.number}@s.whatsapp.net`, `⚠️ Sewa jadibot tinggal *${rental.fmtLeft(left)}* lagi. Perpanjang dengan *${global.prefix || '.'}jadibot sewa* sebelum bot berhenti.`);
            } else if (left <= 24 * 3600000 && !r.warn24 && (r.totalDays || 0) > 1) {
                rental.patchRental(r.number, { warn24: true });
                await say(`${r.number}@s.whatsapp.net`, `⚠️ Sewa jadibot tinggal *${rental.fmtLeft(left)}* lagi (sampai ${rental.fmtDate(r.expiresAt)}). Perpanjang dengan *${global.prefix || '.'}jadibot sewa*.`);
            }
        }
    } catch (e) {
        console.log(chalk.red('[JADIBOT] cek sewa error:'), e.message);
    } finally {
        ticking = false;
    }
}

function startScheduler(intervalMs = 10000) {
    if (schedulerTimer) return;
    schedulerTimer = setInterval(() => {
        pollOrders();
        if (Date.now() - lastTick >= 30000) {
            lastTick = Date.now();
            tickRentals();
        }
    }, intervalMs);
    schedulerTimer.unref?.();
    lastTick = Date.now();
    tickRentals();
    pollOrders();
}

function stopScheduler() {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
}

module.exports = { notifyNumber, fmtCode, pairingText, onPaid, pollOrders, tickRentals, expireRental, startScheduler, stopScheduler, isBotPeer, setMain, setFactory, startPairing, stop, restoreAll, list, enabled, maxBots, isRegistered, bots, lastRequest, NUMBER_RE };
