/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const axios = require('axios');
const crypto = require('crypto');

const DEFAULT_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const SIZES = { square: [1024, 1024], portrait: [768, 1024], landscape: [1024, 768] };

function cloudflareConfigured() {
    return !!(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN);
}

function sniff(buf) {
    if (buf.length > 8 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
    if (buf.length > 8 && buf.slice(1, 4).toString() === 'PNG') return 'image/png';
    if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
    return null;
}

const needsMultipart = new Set();
const isMultipartModel = (model) => /flux-2/i.test(model) || needsMultipart.has(model);

function buildMultipart(fields) {
    const boundary = '----zackbot' + crypto.randomBytes(12).toString('hex');
    const parts = Object.entries(fields).map(
        ([k, v]) => `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${String(v)}\r\n`
    );
    parts.push(`--${boundary}--\r\n`);
    return { body: Buffer.from(parts.join(''), 'utf8'), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function generateImage(prompt, { orientation = 'square' } = {}) {
    if (!cloudflareConfigured()) throw new Error('Pembuat gambar AI belum diaktifkan (CF_ACCOUNT_ID / CF_API_TOKEN belum diisi)');
    prompt = String(prompt || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
    if (prompt.length < 3) throw new Error('Deskripsi gambar kosong');

    const model = process.env.CF_IMAGE_MODEL || DEFAULT_MODEL;
    const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CF_ACCOUNT_ID)}/ai/run/${model}`;
    const [w, h] = SIZES[orientation] || SIZES.square;

    const makeRequest = () => {
        if (isMultipartModel(model)) {
            const f = { prompt, width: w, height: h };
            const mp = buildMultipart(f);
            return { data: mp.body, contentType: mp.contentType };
        }
        const body = { prompt };
        if (/flux/i.test(model)) body.steps = Math.min(Math.max(parseInt(process.env.CF_IMAGE_STEPS) || 6, 1), 8);
        if (!/schnell/i.test(model)) [body.width, body.height] = [w, h];
        return { data: body, contentType: 'application/json' };
    };

    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const req = makeRequest();
            const res = await axios.post(url, req.data, {
                headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, 'Content-Type': req.contentType },
                responseType: 'arraybuffer',
                timeout: 90000,
                maxContentLength: 15 * 1024 * 1024,
                validateStatus: () => true,
            });
            const raw = Buffer.from(res.data);
            const type = String(res.headers['content-type'] || '');
            if (res.status >= 400) {
                let msg = '';
                try {
                    const j = JSON.parse(raw.toString('utf8'));
                    msg = j.errors?.[0]?.message || j.error || '';
                } catch {}
                const err = new Error(`Cloudflare HTTP ${res.status}${msg ? `: ${String(msg).slice(0, 160)}` : ''}`);
                err.status = res.status;
                err.cfMessage = String(msg);
                throw err;
            }
            let buffer = raw;
            if (/json/i.test(type) || raw[0] === 0x7b) {
                const j = JSON.parse(raw.toString('utf8'));
                const b64 = j?.result?.image ?? j?.image;
                if (!b64) throw new Error(j?.errors?.[0]?.message || 'respons Cloudflare tidak berisi gambar');
                buffer = Buffer.from(b64, 'base64');
            }
            const mimetype = sniff(buffer);
            if (!mimetype) throw new Error('hasil dari Cloudflare bukan gambar');
            return { buffer, mimetype, model };
        } catch (e) {
            lastErr = e;
            if (e.status === 400 && /multipart/i.test(e.cfMessage || '') && !isMultipartModel(model)) {
                needsMultipart.add(model);
                console.log(`[IMG] ${model} butuh multipart/form-data, mengulang`);
                continue;
            }
            if (e.status && e.status < 500 && e.status !== 429) break;
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
    const hint = lastErr?.status === 401 || lastErr?.status === 403 ? ' (cek CF_API_TOKEN: harus punya izin Workers AI)' : lastErr?.status === 429 ? ' (jatah harian habis?)' : '';
    throw new Error(`Gagal membuat gambar AI [${model}]: ${lastErr?.message || 'tidak diketahui'}${hint}`);
}

module.exports = { generateImage, cloudflareConfigured };
