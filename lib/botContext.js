/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { AsyncLocalStorage } = require('async_hooks');
const fs = require('fs');
const path = require('path');

const als = new AsyncLocalStorage();

const KEYS = ['botname', 'prefix', 'author', 'owner', 'groqkey', 'persona'];

const LIMITS = {
    botname: 30,
    author: 30,
    persona: 500,
    prefix: 3,
};

const mainCtx = {
    id: 'main',
    number: '',
    isMain: true,
    dbDir: path.join(process.cwd(), 'database'),
    vars: null,
    get startTime() {
        return global.startTime || Date.now();
    },
};

function varsFile(dbDir) {
    return path.join(dbDir, 'vars.json');
}

function loadVars(dbDir) {
    try {
        const raw = JSON.parse(fs.readFileSync(varsFile(dbDir), 'utf8'));
        const out = {};
        for (const k of KEYS) if (typeof raw[k] === 'string' && raw[k].trim()) out[k] = raw[k];
        return out;
    } catch {
        return {};
    }
}

function saveVars(ctx) {
    fs.mkdirSync(ctx.dbDir, { recursive: true });
    const file = varsFile(ctx.dbDir);
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(ctx.vars, null, 2));
    fs.renameSync(tmp, file);
}

function createCtx({ id, number, dbDir }) {
    return { id, number, isMain: false, dbDir, vars: loadVars(dbDir), startTime: Date.now() };
}

function current() {
    const ctx = als.getStore() || mainCtx;
    if (ctx.vars === null) ctx.vars = loadVars(ctx.dbDir);
    return ctx;
}

function runWithBot(ctx, fn) {
    return als.run(ctx, fn);
}

function shareMainKey() {
    return String(process.env.JADIBOT_SHARE_KEY || 'true').toLowerCase() !== 'false';
}

function getVar(name, ctx = current()) {
    const own = ctx.vars && ctx.vars[name];
    if (own) return own;
    switch (name) {
        case 'botname':
            return global.botname || 'Bot';
        case 'prefix':
            return global.prefix || '.';
        case 'author':
            return global.botAuthor || '';
        case 'persona':
            return '';
        case 'groqkey':
            return ctx.isMain || shareMainKey() ? global.groqApiKey || '' : '';
        case 'owner':
            return '';
        default:
            return '';
    }
}

function cleanText(v, max) {
    return String(v)
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .replace(/[ \t]+/g, ' ')
        .trim()
        .slice(0, max);
}

function validate(key, raw) {
    const v = String(raw == null ? '' : raw).trim();
    if (!KEYS.includes(key)) return { ok: false, error: `variabel "${key}" tidak dikenal` };
    if (!v) return { ok: false, error: `isi "${key}" kosong` };
    if (key === 'botname' || key === 'author') {
        const c = cleanText(v.replace(/\s+/g, ' '), LIMITS[key]);
        if (c.length < 1) return { ok: false, error: `isi "${key}" tidak valid` };
        return { ok: true, value: c };
    }
    if (key === 'prefix') {
        if (/\s/.test(v) || v.length > LIMITS.prefix) return { ok: false, error: 'prefix maksimal 3 karakter tanpa spasi' };
        return { ok: true, value: v };
    }
    if (key === 'owner') {
        const nums = v
            .split(/[,\s]+/)
            .map((n) => n.replace(/[^0-9]/g, ''))
            .filter(Boolean);
        if (!nums.length || nums.some((n) => n.length < 8 || n.length > 15)) {
            return { ok: false, error: 'owner harus nomor (8-15 digit) dengan kode negara, pisah dengan koma' };
        }
        return { ok: true, value: [...new Set(nums)].join(',') };
    }
    if (key === 'groqkey') {
        if (!/^gsk_[A-Za-z0-9]{20,}$/.test(v)) return { ok: false, error: 'format API key Groq tidak valid (harus diawali gsk_)' };
        return { ok: true, value: v };
    }
    if (key === 'persona') {
        const c = String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
        if (c.length > LIMITS.persona) return { ok: false, error: `persona maksimal ${LIMITS.persona} karakter` };
        return { ok: true, value: c };
    }
    return { ok: false, error: 'tidak valid' };
}

function setVar(key, raw, ctx = current()) {
    const r = validate(key, raw);
    if (!r.ok) return r;
    ctx.vars = ctx.vars || {};
    ctx.vars[key] = r.value;
    saveVars(ctx);
    return r;
}

function resetVar(key, ctx = current()) {
    ctx.vars = ctx.vars || {};
    if (key) {
        if (!KEYS.includes(key)) return false;
        delete ctx.vars[key];
    } else {
        ctx.vars = {};
    }
    saveVars(ctx);
    return true;
}

function maskKey(v) {
    const s = String(v || '');
    return s.length > 8 ? `${s.slice(0, 4)}…${s.slice(-4)}` : '••••';
}

module.exports = { KEYS, LIMITS, runWithBot, current, createCtx, getVar, setVar, resetVar, validate, maskKey, loadVars, mainCtx };
