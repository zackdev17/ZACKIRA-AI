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
const chalk = require('chalk');

const KINDS = ['rentals', 'orders', 'premium'];
const COLLECTIONS = { rentals: 'jadibot_rentals', orders: 'jadibot_orders', premium: 'jadibot_premium' };
const MAX_ORDERS = 200;
const WEEK = 7 * 86400000;

const state = {
    mode: 'file',
    loaded: false,
    rentals: {},
    orders: {},
    premium: {},
    cols: null,
    queue: [],
    working: null,
    retryTimer: null,
    initPromise: null,
};

const dbDir = () => path.join(process.cwd(), 'database');
const files = () => Object.fromEntries(KINDS.map((k) => [k, path.join(dbDir(), `${COLLECTIONS[k]}.json`)]));

function readJson(file) {
    try {
        const v = JSON.parse(fs.readFileSync(file, 'utf8'));
        return v && typeof v === 'object' ? v : {};
    } catch {
        return {};
    }
}

function writeJson(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
}

function ensure() {
    if (state.loaded) return;
    const f = files();
    for (const k of KINDS) state[k] = readJson(f[k]);
    state.loaded = true;
}

function persistFile(kind) {
    writeJson(files()[kind], state[kind]);
}

function enqueue(op) {
    state.queue.push(op);
    drain();
}

async function drain() {
    if (state.working) return state.working;
    if (!state.queue.length || !state.cols) return Promise.resolve();
    state.working = (async () => {
        await Promise.resolve();
        while (state.queue.length) {
            const op = state.queue[0];
            try {
                const col = state.cols[op.kind];
                if (op.type === 'set') await col.replaceOne({ _id: op.id }, { _id: op.id, ...op.doc }, { upsert: true });
                else await col.deleteOne({ _id: op.id });
                state.queue.shift();
            } catch (e) {
                console.log(chalk.red('[SEWA] gagal menulis ke MongoDB, dicoba lagi:'), e.message);
                clearTimeout(state.retryTimer);
                state.retryTimer = setTimeout(drain, 15000);
                state.retryTimer.unref?.();
                break;
            }
        }
        state.working = null;
    })();
    return state.working;
}

function flush() {
    return state.mode === 'mongo' ? drain() : Promise.resolve();
}

function write(kind, type, id, doc) {
    ensure();
    if (type === 'set') state[kind][id] = doc;
    else delete state[kind][id];
    if (state.mode === 'mongo') enqueue({ kind, type, id, doc });
    else persistFile(kind);
}

const rentals = () => (ensure(), state.rentals);
const orders = () => (ensure(), state.orders);
const putRental = (number, rec) => write('rentals', 'set', number, rec);
const delRental = (number) => write('rentals', 'del', number);
const delOrder = (id) => write('orders', 'del', id);
const premium = () => (ensure(), state.premium);
const putPremium = (number, rec) => write('premium', 'set', number, rec);
const delPremium = (number) => write('premium', 'del', number);

function putOrder(order) {
    write('orders', 'set', order.id, order);
    const all = Object.values(state.orders);
    if (all.length > MAX_ORDERS) {
        all.filter((o) => o.status !== 'pending' && Date.now() - (o.createdAt || 0) > WEEK)
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
            .slice(0, all.length - MAX_ORDERS)
            .forEach((o) => delOrder(o.id));
    }
}

const strip = (doc) => {
    const { _id, ...rest } = doc;
    return rest;
};

async function init() {
    if (state.initPromise) return state.initPromise;
    state.initPromise = (async () => {
        ensure();
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.log(chalk.cyan('[SEWA] data sewa disimpan di database lokal.'));
            return 'file';
        }
        try {
            const { getDb } = require('./mongoAuth.js');
            const db = await getDb(uri);
            const cols = Object.fromEntries(KINDS.map((k) => [k, db.collection(COLLECTIONS[k])]));
            const docs = await Promise.all(KINDS.map((k) => cols[k].find({}).toArray()));
            const merged = {};
            KINDS.forEach((k, i) => {
                merged[k] = {};
                docs[i].forEach((d) => (merged[k][d._id] = strip(d)));
            });

            const local = Object.fromEntries(KINDS.map((k) => [k, { ...state[k] }]));
            const missing = [];
            for (const kind of KINDS) {
                for (const [id, doc] of Object.entries(local[kind])) {
                    if (!merged[kind][id]) {
                        merged[kind][id] = doc;
                        missing.push({ kind, type: 'set', id, doc });
                    }
                }
            }
            KINDS.forEach((k) => (state[k] = merged[k]));
            state.cols = cols;
            state.mode = 'mongo';
            missing.forEach((op) => state.queue.push(op));
            await drain();

            const f = files();
            for (const file of Object.values(f)) {
                if (fs.existsSync(file) && state.queue.length === 0) fs.renameSync(file, `${file}.migrated`);
            }
            console.log(
                chalk.cyan(`[SEWA] data sewa disimpan di MongoDB (${Object.keys(merged.rentals).length} sewa, ${missing.length} diimpor dari lokal).`)
            );
            return 'mongo';
        } catch (e) {
            state.mode = 'file';
            state.cols = null;
            console.log(chalk.yellow(`[SEWA] MongoDB tidak bisa dipakai (${e.message}), pakai database lokal.`));
            return 'file';
        }
    })();
    return state.initPromise;
}

const mode = () => state.mode;

function reset() {
    clearTimeout(state.retryTimer);
    Object.assign(state, { mode: 'file', loaded: false, rentals: {}, orders: {}, premium: {}, cols: null, queue: [], working: null, retryTimer: null, initPromise: null });
}

module.exports = { init, mode, flush, reset, rentals, orders, premium, putRental, delRental, putOrder, delOrder, putPremium, delPremium };
