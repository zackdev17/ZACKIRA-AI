/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const axios = require('axios');

const BASE = 'https://www.pinterest.com';
const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0';

let cookieCache = { value: null, at: 0 };
const COOKIE_TTL = 10 * 60 * 1000;

async function getCookies() {
    if (cookieCache.value && Date.now() - cookieCache.at < COOKIE_TTL) return cookieCache.value;
    try {
        const res = await axios.get(`${BASE}/csrf_error/`, {
            timeout: 10000,
            headers: { 'User-Agent': UA },
            validateStatus: () => true,
        });
        const set = res.headers['set-cookie'];
        if (set && set.length) {
            const value = set.map((c) => c.split(';')[0].trim()).join('; ');
            cookieCache = { value, at: Date.now() };
            return value;
        }
    } catch (e) {
        console.log('[pinterest] gagal ambil cookie:', e.message);
    }
    return null;
}

const clip = (s, n) => {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
};

async function searchPinterest(query, limit = 10) {
    query = String(query || '').trim();
    if (!query) throw new Error('Kata kunci Pinterest kosong');
    limit = Math.min(Math.max(parseInt(limit) || 10, 1), 10);

    const cookie = await getCookies();
    const headers = {
        accept: 'application/json, text/javascript, */*, q=0.01',
        'accept-language': 'en-US,en;q=0.9',
        dnt: '1',
        referer: `${BASE}/`,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': UA,
        'x-app-version': 'c056fb7',
        'x-pinterest-appstate': 'active',
        'x-pinterest-pws-handler': 'www/[username]/[slug].js',
        'x-pinterest-source-url': '/hargr003/cat-pictures/',
        'x-requested-with': 'XMLHttpRequest',
    };
    if (cookie) headers.cookie = cookie;

    const params = {
        source_url: `/search/pins/?q=${encodeURIComponent(query)}`,
        data: JSON.stringify({
            options: { isPrefetch: false, query, scope: 'pins', no_fetch_context_on_resource: false },
            context: {},
        }),
        _: Date.now(),
    };

    let data;
    try {
        ({ data } = await axios.get(`${BASE}/resource/BaseSearchResource/get/`, { headers, params, timeout: 20000 }));
    } catch (e) {
        const status = e.response?.status;
        throw new Error(`Pinterest tidak bisa diakses${status ? ` (HTTP ${status})` : ''}: ${e.message}`);
    }

    const raw = data?.resource_response?.data?.results;
    if (!Array.isArray(raw)) throw new Error('Format respons Pinterest berubah / tidak dikenali');

    const seen = new Set();
    const out = [];
    for (const r of raw) {
        const orig = r?.images?.orig?.url;
        if (!orig || r.is_promoted || r.promoter || seen.has(orig)) continue;
        seen.add(orig);
        out.push({
            title: clip(r.grid_title || r.title || r.description || query, 80),
            author: r.pinner?.full_name || r.pinner?.username || '',
            image: orig,
            thumb: r.images['736x']?.url || r.images['474x']?.url || orig,
            source: `https://id.pinterest.com/pin/${r.id}`,
        });
        if (out.length >= limit) break;
    }
    return out;
}

module.exports = { searchPinterest };
