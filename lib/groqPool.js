/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const axios = require('axios');
const { extractTextToolCalls } = require('./toolCallParser.js');

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const cooldowns = new Map();
const dead = new Set();

const keyOf = (apiKey, model) => `${String(apiKey || '').slice(-10)}|${model}`;

class AllModelsBusyError extends Error {
    constructor(waitMs, details) {
        super('Semua model Groq sedang overlimit / tidak tersedia');
        this.name = 'AllModelsBusyError';
        this.waitMs = waitMs;
        this.details = details;
    }
}

function parseDuration(str) {
    let ms = 0;
    const re = /(\d+(?:\.\d+)?)(ms|h|m|s)/g;
    let m;
    while ((m = re.exec(str || ''))) {
        const n = parseFloat(m[1]);
        ms += m[2] === 'ms' ? n : m[2] === 's' ? n * 1000 : m[2] === 'm' ? n * 60000 : n * 3600000;
    }
    return ms;
}

function retryAfterMs(err) {
    const header = err.response?.headers?.['retry-after'];
    let ms = header && !isNaN(header) ? Number(header) * 1000 : 0;
    if (!ms) {
        const msg = err.response?.data?.error?.message || '';
        const m = msg.match(/try again in ([0-9hms.]+)/i);
        if (m) ms = parseDuration(m[1]);
    }
    if (!ms) ms = 60 * 1000;
    return Math.min(Math.max(ms, 2000), 6 * 3600 * 1000);
}

function usable(apiKey, model) {
    const k = keyOf(apiKey, model);
    return !dead.has(k) && (cooldowns.get(k) || 0) <= Date.now();
}

function classify(err) {
    const status = err.response?.status;
    const code = err.response?.data?.error?.code || '';
    const type = err.response?.data?.error?.type || '';

    if (status === 401) return { kind: 'fatal' };
    if (status === 429) return { kind: 'cooldown', ms: retryAfterMs(err), why: 'overlimit' };
    if (status === 413) return { kind: 'cooldown', ms: 30 * 1000, why: 'request terlalu besar' };
    if (/terms_required/.test(code) || /terms/i.test(err.response?.data?.error?.message || '') && status === 400) {
        return { kind: 'dead', why: 'syarat model belum disetujui di console.groq.com' };
    }
    if (status === 404 || /model_(decommissioned|not_found|terminated)/.test(code) || type === 'model_not_found') {
        return { kind: 'dead', why: code || 'model tidak ditemukan' };
    }
    if (status === 403 && /terms|access|permission/i.test(err.response?.data?.error?.message || '')) {
        return { kind: 'dead', why: 'akses model belum diizinkan' };
    }
    if (!status || status >= 500) return { kind: 'cooldown', ms: 30 * 1000, why: 'server error / timeout' };
    return { kind: 'skip', why: code || 'bad request' };
}

async function groqChat({ apiKey, models, body, allowEmpty = false, timeout = 60000 }) {
    if (!apiKey) throw new Error('GROQ_API_KEY belum diset');
    if (!models || !models.length) throw new Error('Daftar model kosong');

    let candidates = models.filter((m) => usable(apiKey, m));
    if (!candidates.length) {
        const alive = models.filter((m) => !dead.has(keyOf(apiKey, m)));
        if (!alive.length) throw new AllModelsBusyError(0, 'semua model sudah tidak tersedia');
        const soonest = alive.slice().sort((a, b) => (cooldowns.get(keyOf(apiKey, a)) || 0) - (cooldowns.get(keyOf(apiKey, b)) || 0))[0];
        candidates = [soonest];
    }

    const failures = [];
    for (let i = 0; i < candidates.length; i++) {
        const model = candidates[i];
        try {
            const res = await axios.post(
                ENDPOINT,
                { ...body, model },
                {
                    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    timeout,
                }
            );
            const msg = res.data?.choices?.[0]?.message;
            const visible = String(msg?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            if (!msg || (!visible && !(msg.tool_calls && msg.tool_calls.length) && !allowEmpty)) {
                failures.push(`${model}: response kosong`);
                console.log(`[GROQ] ${model} response kosong, pindah model`);
                continue;
            }
            return { data: res.data, model };
        } catch (err) {
            const eo = err.response?.data?.error;
            if (eo?.code === 'tool_use_failed' && typeof eo.failed_generation === 'string') {
                const rec = extractTextToolCalls(eo.failed_generation);
                if (rec.calls.length) {
                    console.log(`[GROQ] ${model} tool_use_failed, dipulihkan dari failed_generation`);
                    return {
                        data: { choices: [{ message: { role: 'assistant', content: eo.failed_generation } }] },
                        model,
                    };
                }
            }
            const c = classify(err);
            if (c.kind === 'fatal') throw new Error('Groq API key tidak valid (401)');
            if (c.kind === 'cooldown') cooldowns.set(keyOf(apiKey, model), Date.now() + c.ms);
            if (c.kind === 'dead') dead.add(keyOf(apiKey, model));
            failures.push(`${model}: ${c.why}`);
            const next = candidates[i + 1];
            console.log(
                `[GROQ] ${model} gagal (${c.why})` +
                    (c.kind === 'cooldown' ? `, cooldown ${Math.round(c.ms / 1000)}s` : '') +
                    (next ? ` -> pindah ke ${next}` : '')
            );
        }
    }

    const waits = models
        .filter((m) => !dead.has(keyOf(apiKey, m)))
        .map((m) => Math.max(0, (cooldowns.get(keyOf(apiKey, m)) || 0) - Date.now()));
    throw new AllModelsBusyError(waits.length ? Math.min(...waits) : 0, failures);
}

function modelStatus(models, apiKey = global.groqApiKey) {
    const now = Date.now();
    return models.map((m) => ({
        model: m,
        status: dead.has(keyOf(apiKey, m)) ? 'dead' : (cooldowns.get(keyOf(apiKey, m)) || 0) > now ? 'cooldown' : 'ready',
        waitSec: Math.max(0, Math.ceil(((cooldowns.get(keyOf(apiKey, m)) || 0) - now) / 1000)),
    }));
}

module.exports = { groqChat, modelStatus, AllModelsBusyError, parseDuration };
