/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const axios = require('axios');

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : undefined);
const num = (v) => {
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) ? n : undefined;
};

class SyahPayError extends Error {
    constructor(code, message, httpStatus) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
    }
}

function config() {
    const apiKey = (process.env.SYAHPAY_API_KEY || '').trim();
    if (!apiKey) return null;
    const base = (process.env.SYAHPAY_BASE || 'https://syahpay.biz.id')
        .trim()
        .replace(/\/+$/, '')
        .replace(/\/api$/i, '')
        .replace(/\/+$/, '');
    return { apiKey, base };
}

const ready = () => config() !== null;

async function call(method, path, params, timeout = 12000) {
    const cfg = config();
    if (!cfg) throw new SyahPayError('not_configured', 'SyahPay belum dikonfigurasi.');
    let res;
    try {
        res = await axios({
            method,
            url: `${cfg.base}${path}`,
            params: { apikey: cfg.apiKey, ...params },
            timeout,
            headers: { Accept: 'application/json' },
            validateStatus: () => true,
        });
    } catch {
        throw new SyahPayError('network', 'Tidak bisa menghubungi SyahPay.');
    }
    if (res.status < 200 || res.status >= 300) {
        throw new SyahPayError('http', `SyahPay menjawab HTTP ${res.status}.`, res.status);
    }
    let data = res.data;
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch {
            data = null;
        }
    }
    if (!isObj(data)) throw new SyahPayError('bad_response', 'Respons SyahPay bukan JSON objek.');
    return data;
}

function unwrap(r) {
    for (const k of ['data', 'invoice', 'result']) {
        if (isObj(r[k])) return { ...r, ...r[k] };
    }
    return r;
}

function parseExpiry(raw, now = Date.now()) {
    if (!raw) return null;
    const s = String(raw).trim();
    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(s);
    const iso = s.replace(' ', 'T');
    const candidates = hasZone ? [Date.parse(iso)] : [Date.parse(`${iso}Z`), Date.parse(`${iso}+07:00`)];
    const ok = candidates.filter((t) => Number.isFinite(t) && t > now && t - now <= 3 * 3600000);
    return ok.length ? Math.min(...ok) : null;
}

function imageSource(v, base) {
    const raw = str(v);
    if (!raw) return null;
    const s = raw.trim();
    if (/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= 400000) return s;
    let url = s;
    if (s.startsWith('//')) url = `https:${s}`;
    else if (s.startsWith('/')) url = `${base}${s}`;
    return /^https:\/\//i.test(url) ? url : null;
}

async function createInvoice(amount) {
    const cfg = config();
    if (!cfg) throw new SyahPayError('not_configured', 'SyahPay belum dikonfigurasi.');
    const r = unwrap(await call('GET', '/api/invoice', { amount }));
    if (r.success === false) throw new SyahPayError('bad_response', 'SyahPay menolak membuat invoice.');
    const invoiceId = str(r.invoice_id) || str(r.invoiceId) || str(r.id);
    const qrImage = imageSource(r.qris_image ?? r.qr_image ?? r.qris_url ?? r.qr_url, cfg.base);
    const payRaw = imageSource(r.payment_link ?? r.payment_url ?? r.url, cfg.base);
    const payUrl = payRaw && !payRaw.startsWith('data:') ? payRaw : null;
    if (!invoiceId || (!qrImage && !payUrl)) {
        throw new SyahPayError('bad_response', 'Respons SyahPay tidak berisi invoice_id / QR / link bayar.');
    }
    const total = num(r.total) ?? amount;
    return {
        invoiceId,
        qrImage,
        payUrl,
        amount,
        total,
        fee: num(r.fee) ?? Math.max(0, total - amount),
        expiresAt: parseExpiry(str(r.expired_at) || str(r.expires_at)),
    };
}

async function getInvoiceStatus(invoiceId) {
    const r = unwrap(await call('GET', '/api/invoice/status', { invoice_id: invoiceId }));
    const s = (str(r.status) || '').toLowerCase();
    const map = { paid: 'paid', pending: 'pending', expired: 'expired', cancelled: 'canceled', canceled: 'canceled' };
    return {
        status: map[s] || 'unknown',
        invoiceId: str(r.invoice_id),
        amount: num(r.amount),
        total: num(r.total),
    };
}

async function cancelInvoice(invoiceId) {
    if (!ready()) return false;
    try {
        const r = await call('POST', '/api/invoice/cancel', { invoice_id: invoiceId }, 5000);
        return r.success !== false;
    } catch {
        return false;
    }
}

module.exports = { ready, createInvoice, getInvoiceStatus, cancelInvoice, SyahPayError, parseExpiry };
