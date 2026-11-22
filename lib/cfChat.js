/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const axios = require('axios');

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

function cfChatConfigured() {
    return !!(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) && process.env.CF_CHAT_FALLBACK !== 'false';
}

function extractText(j) {
    const r = j?.result ?? j;
    if (typeof r?.response === 'string') return r.response;
    const c = r?.choices?.[0]?.message?.content;
    if (typeof c === 'string') return c;
    if (typeof r?.output_text === 'string') return r.output_text;
    return '';
}

async function cfChat({ messages, maxTokens = 700, temperature = 0.4 }) {
    if (!cfChatConfigured()) throw new Error('Cloudflare chat belum diaktifkan');
    const model = process.env.CF_CHAT_MODEL || DEFAULT_MODEL;
    const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CF_ACCOUNT_ID)}/ai/run/${model}`;
    const msgs = messages
        .filter((m) => (m.role === 'system' || m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }));
    const res = await axios.post(
        url,
        { messages: msgs, max_tokens: maxTokens, temperature },
        { headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, 'Content-Type': 'application/json' }, timeout: 45000, validateStatus: () => true }
    );
    if (res.status >= 400) throw new Error(`Cloudflare HTTP ${res.status}: ${String(res.data?.errors?.[0]?.message || '').slice(0, 120)}`);
    const text = extractText(res.data).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (!text) throw new Error('Cloudflare tidak mengembalikan teks');
    return { text, model };
}

module.exports = { cfChat, cfChatConfigured };
