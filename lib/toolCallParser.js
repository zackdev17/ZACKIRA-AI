/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const crypto = require('crypto');

const BLOCK_RE = /<tool_call>[\s\S]*?(?:<\/tool_call>|$)/gi;
const FUNC_RE = /<function=([\w.\-]+)>([\s\S]*?)(?:<\/function>|(?=<function=)|$)/gi;
const PARAM_RE = /<parameter=([\w.\-]+)>([\s\S]*?)(?:<\/parameter>|(?=<parameter=)|$)/gi;
const PYTAG_RE = /<\|python_tag\|>([\s\S]*)$/i;
const STRAY_RE = /<\/?tool_call>|<\/?function(?:=[\w.\-]*)?>|<\/?parameter(?:=[\w.\-]*)?>|<\|python_tag\|>/gi;

function hasToolMarkup(text) {
    return /<tool_call>|<function=|<parameter=|<\|python_tag\|>/i.test(String(text || ''));
}

function tryJson(s) {
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
}

function unwrapValue(v) {
    v = String(v).trim();
    const m = v.match(/^"([^"]*)"$/) || v.match(/^'([^']*)'$/);
    return m ? m[1] : v;
}

function mkCall(name, args) {
    return {
        id: 'call_' + crypto.randomBytes(5).toString('hex'),
        type: 'function',
        function: { name, arguments: JSON.stringify(args || {}) },
    };
}

function fromJsonObject(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const name = obj.name || obj.function?.name || obj.tool;
    if (!name) return null;
    let args = obj.arguments ?? obj.parameters ?? obj.function?.arguments ?? obj.args ?? {};
    if (typeof args === 'string') args = tryJson(args) || {};
    return mkCall(String(name), args);
}

function extractTextToolCalls(content) {
    const original = String(content || '');
    const out = { calls: [], text: original, hadMarkup: hasToolMarkup(original) };
    if (!out.hadMarkup) return out;

    let work = original;

    const funcMatches = [...work.matchAll(FUNC_RE)];
    for (const fm of funcMatches) {
        const name = fm[1];
        const body = fm[2] || '';
        const args = {};
        for (const pm of body.matchAll(PARAM_RE)) args[pm[1]] = unwrapValue(pm[2]);
        if (!Object.keys(args).length) {
            const j = tryJson(body.replace(/<\/?tool_call>/gi, '').trim());
            if (j && typeof j === 'object') Object.assign(args, j);
        }
        out.calls.push(mkCall(name, args));
    }

    if (!out.calls.length) {
        for (const bm of work.matchAll(BLOCK_RE)) {
            const inner = bm[0].replace(/<\/?tool_call>/gi, '').trim();
            const j = tryJson(inner);
            const items = Array.isArray(j) ? j : j ? [j] : [];
            for (const it of items) {
                const c = fromJsonObject(it);
                if (c) out.calls.push(c);
            }
        }
    }

    if (!out.calls.length) {
        const pm = work.match(PYTAG_RE);
        if (pm) {
            const j = tryJson(pm[1].trim());
            const items = Array.isArray(j) ? j : j ? [j] : [];
            for (const it of items) {
                const c = fromJsonObject(it);
                if (c) out.calls.push(c);
            }
        }
    }

    work = work.replace(BLOCK_RE, '').replace(PYTAG_RE, '');
    work = work.replace(FUNC_RE, '').replace(PARAM_RE, '').replace(STRAY_RE, '');
    out.text = work.trim();
    return out;
}

function coerceArgs(name, args, tools) {
    const tool = (tools || []).find((t) => t.function.name === name);
    const src = args && typeof args === 'object' ? args : {};
    if (!tool) return src;
    const props = tool.function.parameters?.properties || {};
    const out = {};
    for (const [key, spec] of Object.entries(props)) {
        if (src[key] === undefined || src[key] === null || src[key] === '') continue;
        let v = src[key];
        if (spec.type === 'integer' || spec.type === 'number') {
            v = Number(v);
            if (!Number.isFinite(v)) continue;
            if (spec.type === 'integer') v = Math.round(v);
        } else if (spec.type === 'boolean') {
            if (typeof v === 'string') v = /^(true|1|ya|yes)$/i.test(v.trim());
            else v = !!v;
        } else if (spec.type === 'array' || spec.type === 'object') {
            if (typeof v === 'string') {
                try {
                    v = JSON.parse(v);
                } catch {
                    continue;
                }
            }
            if (spec.type === 'array' && !Array.isArray(v)) continue;
        } else if (spec.type === 'string') {
            v = String(v).trim();
            if (spec.enum && !spec.enum.includes(v)) {
                const lower = v.toLowerCase();
                v = spec.enum.includes(lower) ? lower : spec.enum.includes('any') ? 'any' : spec.enum[0];
            }
        }
        out[key] = v;
    }
    return out;
}

module.exports = { extractTextToolCalls, coerceArgs, hasToolMarkup };
