/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const DAY = 86400000;
const FALLBACK_LIFETIME = 30 * 60000;
const CREATE_GAP = 20000;
const CHECK_GAP = 3000;
const DEFAULT_PLANS = [1, 3, 7, 14, 30, 90, 180, 365];

let client = null;
const processing = new Set();
const lastCreate = new Map();
const lastCheck = new Map();

const payClient = () => client || require('./syahpay.js');
const setPayClient = (c) => {
    client = c;
};

const paidMode = () => String(process.env.JADIBOT_PAID || 'true').toLowerCase() !== 'false';
const pricePerDay = () => Math.max(1, parseInt(process.env.JADIBOT_PRICE_PER_DAY, 10) || 1000);

function planDays() {
    const raw = String(process.env.JADIBOT_PLANS || '');
    const list = raw
        .split(/[,\s]+/)
        .map((n) => parseInt(n, 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 365);
    const days = [...new Set(list.length ? list : DEFAULT_PLANS)].sort((a, b) => a - b);
    return days.slice(0, 10);
}

function labelOf(d) {
    const fixed = { 7: '1 Minggu', 14: '2 Minggu', 30: '1 Bulan', 60: '2 Bulan', 90: '3 Bulan', 180: '6 Bulan', 365: '1 Tahun' };
    return fixed[d] || `${d} Hari`;
}

function plans() {
    const per = pricePerDay();
    return planDays().map((d) => ({ days: d, price: d * per, label: labelOf(d) }));
}

const rp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

function fmtDate(ms) {
    const s = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(ms));
    return `${s.replace(/\./g, ':').replace(',', '')} WIB`;
}

function fmtLeft(ms) {
    const left = Math.max(0, ms);
    const d = Math.floor(left / DAY);
    const h = Math.floor((left % DAY) / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    if (d > 0) return `${d} hari ${h} jam`;
    if (h > 0) return `${h} jam ${m} menit`;
    return `${m} menit`;
}

const store = require('./rentalStore.js');

function getRental(number) {
    const r = store.rentals()[number];
    return r ? { ...r } : null;
}

function isActive(number, now = Date.now()) {
    const r = getRental(number);
    return !!r && r.state !== 'expired' && r.expiresAt > now;
}

function extend(number, days, now = Date.now()) {
    const cur = store.rentals()[number];
    const base = cur && cur.state !== 'expired' && cur.expiresAt > now ? cur.expiresAt : now;
    const next = {
        expiresAt: base + days * DAY,
        state: 'active',
        noticed: false,
        tries: 0,
        warn24: false,
        warn3: false,
        totalDays: (cur && cur.state !== 'expired' ? cur.totalDays || 0 : 0) + days,
        updatedAt: now,
    };
    store.putRental(number, next);
    return { ...next };
}

function patchRental(number, patch) {
    const cur = store.rentals()[number];
    if (!cur) return null;
    const next = { ...cur, ...patch };
    store.putRental(number, next);
    return { ...next };
}

function removeRental(number) {
    store.delRental(number);
}

function listRentals() {
    return Object.entries(store.rentals()).map(([number, r]) => ({ number, ...r }));
}

function getOrder(id) {
    const o = store.orders()[id];
    return o ? { ...o } : null;
}

function pendingOrders() {
    return Object.values(store.orders())
        .filter((o) => o.status === 'pending')
        .map((o) => ({ ...o }));
}

function pendingFor(number) {
    return pendingOrders()
        .filter((o) => o.number === number)
        .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}

function setOrder(order) {
    store.putOrder(order);
    return order;
}

async function createOrder({ number, requester, days, buyerName }) {
    const plan = plans().find((p) => p.days === days);
    if (!plan) return { ok: false, reason: 'plan' };
    const pay = payClient();
    if (!pay.ready()) return { ok: false, reason: 'not_configured' };

    const now = Date.now();
    const old = pendingFor(number);
    if (old && old.days === days && old.expiresAt > now + 30000) return { ok: true, order: old, reused: true };

    const gap = CREATE_GAP - (now - (lastCreate.get(number) || 0));
    if (gap > 0) return { ok: false, reason: 'slow', waitSec: Math.ceil(gap / 1000) };
    lastCreate.set(number, now);

    if (old) {
        await pay.cancelInvoice(old.id).catch(() => false);
        setOrder({ ...old, status: 'canceled' });
    }

    let inv;
    try {
        inv = await pay.createInvoice(plan.price);
    } catch (e) {
        lastCreate.delete(number);
        return { ok: false, reason: 'gateway', message: e.message };
    }
    const order = setOrder({
        id: inv.invoiceId,
        number,
        requester,
        buyerName: String(buyerName || '').slice(0, 40),
        days,
        amount: plan.price,
        fee: inv.fee,
        total: inv.total,
        qrImage: inv.qrImage,
        payUrl: inv.payUrl,
        status: 'pending',
        createdAt: now,
        expiresAt: inv.expiresAt || now + FALLBACK_LIFETIME,
    });
    return { ok: true, order, reused: false };
}

function amountsMatch(order, st) {
    if (st.invoiceId && st.invoiceId !== order.id) return false;
    if (st.amount !== undefined && st.amount !== order.amount && st.amount !== order.total) return false;
    if (st.total !== undefined && st.total !== order.total && st.total !== order.amount) return false;
    return true;
}

async function checkOrder(id, { force = false } = {}) {
    const order = getOrder(id);
    if (!order) return { state: 'error', order: null };
    if (order.status === 'paid') return { state: 'paid', order, rental: getRental(order.number), already: true };
    if (order.status !== 'pending') return { state: order.status, order };
    if (processing.has(id)) return { state: 'pending', order };

    const now = Date.now();
    if (!force && now - (lastCheck.get(id) || 0) < CHECK_GAP) return { state: 'pending', order };
    lastCheck.set(id, now);

    processing.add(id);
    try {
        const pay = payClient();
        let st;
        try {
            st = await pay.getInvoiceStatus(id);
        } catch (e) {
            if (Date.now() > order.expiresAt + 5 * 60000) {
                setOrder({ ...order, status: 'expired' });
                return { state: 'expired', order: { ...order, status: 'expired' } };
            }
            return { state: 'error', order, message: e.message };
        }

        const fresh = getOrder(id);
        if (!fresh || fresh.status !== 'pending') return { state: fresh ? fresh.status : 'error', order: fresh };

        if (st.status === 'paid') {
            if (!amountsMatch(fresh, st)) {
                setOrder({ ...fresh, status: 'rejected' });
                return { state: 'rejected', order: { ...fresh, status: 'rejected' } };
            }
            const paid = setOrder({ ...fresh, status: 'paid', paidAt: Date.now() });
            const rental = extend(paid.number, paid.days);
            return { state: 'paid', order: paid, rental };
        }
        if (st.status === 'canceled' || st.status === 'expired') {
            setOrder({ ...fresh, status: st.status });
            return { state: st.status, order: { ...fresh, status: st.status } };
        }
        if (Date.now() > fresh.expiresAt) {
            setOrder({ ...fresh, status: 'expired' });
            await pay.cancelInvoice(id).catch(() => false);
            return { state: 'expired', order: { ...fresh, status: 'expired' } };
        }
        return { state: 'pending', order: fresh };
    } finally {
        processing.delete(id);
    }
}

async function cancelPending(number) {
    const order = pendingFor(number);
    if (!order) return null;
    await payClient().cancelInvoice(order.id).catch(() => false);
    const latest = getOrder(order.id);
    if (latest && latest.status === 'pending') setOrder({ ...latest, status: 'canceled' });
    return order;
}

function resetThrottle() {
    lastCreate.clear();
    lastCheck.clear();
}

module.exports = {
    DAY,
    paidMode,
    pricePerDay,
    plans,
    labelOf,
    rp,
    fmtDate,
    fmtLeft,
    getRental,
    isActive,
    extend,
    patchRental,
    removeRental,
    listRentals,
    getOrder,
    pendingOrders,
    pendingFor,
    createOrder,
    checkOrder,
    cancelPending,
    setPayClient,
    resetThrottle,
    initStore: () => store.init(),
    storeMode: () => store.mode(),
    flushStore: () => store.flush(),
};
