/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const axios = require('axios');
const { assertPublicUrl, guardRedirect } = require('./netSafety.js');

const UA_BROWSER =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const UA_PREVIEW = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

const decodeEntities = (s) =>
    s
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;|&#x27;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
const stripTags = (s) => decodeEntities(s.replace(/<[^>]+>/g, '')).trim();

function parseDdg(html) {
    const out = [];
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html))) {
        let href = decodeEntities(m[1]);
        if (href.startsWith('//')) href = 'https:' + href;
        const u = href.match(/[?&]uddg=([^&]+)/);
        if (u) href = decodeURIComponent(u[1]);
        if (/^https?:\/\//i.test(href)) out.push({ title: stripTags(m[2]), url: href });
    }
    return out;
}

function parseBing(html) {
    const out = [];
    const re = /<li class="b_algo"[\s\S]*?<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html))) {
        let href = decodeEntities(m[1]);
        const enc = href.match(/[?&]u=a1([A-Za-z0-9_\-+/=]+)/);
        if (enc) {
            try {
                href = Buffer.from(enc[1], 'base64url').toString('utf8');
            } catch {}
        }
        if (/^https?:\/\//i.test(href)) out.push({ title: stripTags(m[2]), url: href });
    }
    return out;
}

async function ddgSearch(q) {
    const res = await axios.post('https://html.duckduckgo.com/html/', new URLSearchParams({ q }).toString(), {
        headers: { 'User-Agent': UA_BROWSER, 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
        validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(`duckduckgo ${res.status}`);
    const r = parseDdg(String(res.data));
    if (!r.length) throw new Error('duckduckgo kosong');
    return r;
}

async function bingSearch(q) {
    const res = await axios.get('https://www.bing.com/search', {
        params: { q },
        headers: { 'User-Agent': UA_BROWSER, 'Accept-Language': 'id,en;q=0.8' },
        timeout: 10000,
        validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(`bing ${res.status}`);
    return parseBing(String(res.data));
}

async function webSearch(q) {
    try {
        return await ddgSearch(q);
    } catch (e1) {
        try {
            return await bingSearch(q);
        } catch (e2) {
            throw new Error(`Pencarian web gagal (${e1.message}; ${e2.message})`);
        }
    }
}

const SITES = {
    pinterest: {
        domain: 'site:pinterest.com',
        re: /^https?:\/\/(?:[a-z]+\.)?pinterest\.[a-z.]+\/pin\/\d+/i,
        clean: (u) => u.split('?')[0].replace(/\/$/, '') + '/',
    },
    spotify: {
        domain: 'site:open.spotify.com',
        re: /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?(?:track|album|playlist|artist|episode|show)\/[A-Za-z0-9]+/i,
        clean: (u) => u.split('?')[0].replace('/intl-id/', '/').replace(/\/intl-[a-z]+\//, '/'),
    },
    tiktok: {
        domain: 'site:tiktok.com',
        re: /^https?:\/\/(?:www\.)?tiktok\.com\/@[^/]+\/video\/\d+/i,
        clean: (u) => u.split('?')[0],
    },
    instagram: {
        domain: 'site:instagram.com',
        re: /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/[\w-]+/i,
        clean: (u) => u.split('?')[0],
    },
    any: { domain: '', re: /^https?:\/\//i, clean: (u) => u },
};

const SOFT_OK_HOST = /(pinterest|instagram|tiktok|facebook|twitter|x)\./i;

async function checkUrl(url) {
    try {
        const res = await axios.get(url, {
            headers: { 'User-Agent': UA_PREVIEW },
            timeout: 8000,
            maxRedirects: 5,
            validateStatus: () => true,
            responseType: 'stream',
        });
        res.data.destroy();
        const host = new URL(url).hostname;
        const ok = (res.status >= 200 && res.status < 400) || ([403, 429].includes(res.status) && SOFT_OK_HOST.test(host));
        return { ok, status: res.status };
    } catch (e) {
        return { ok: false, status: 0 };
    }
}

async function spotifyMeta(url) {
    try {
        const res = await axios.get('https://open.spotify.com/oembed', {
            params: { url },
            timeout: 8000,
            validateStatus: () => true,
        });
        if (res.status === 200 && res.data?.title) return { ok: true, title: res.data.title, type: res.data.type };
    } catch {}
    return { ok: false };
}

async function findLinks(query, site = 'any', limit = 5) {
    const cfg = SITES[site] || SITES.any;
    limit = Math.min(Math.max(parseInt(limit) || 5, 1), 8);
    const raw = await webSearch(`${cfg.domain} ${query}`.trim());

    const seen = new Set();
    const candidates = [];
    for (const r of raw) {
        if (!cfg.re.test(r.url)) continue;
        const url = cfg.clean(r.url);
        if (seen.has(url)) continue;
        seen.add(url);
        candidates.push({ title: r.title, url });
        if (candidates.length >= limit * 2) break;
    }

    const checked = await Promise.all(
        candidates.map(async (c) => {
            if (site === 'spotify') {
                const meta = await spotifyMeta(c.url);
                return meta.ok ? { title: meta.title, url: c.url, type: meta.type } : null;
            }
            const v = await checkUrl(c.url);
            return v.ok ? c : null;
        })
    );
    return checked.filter(Boolean).slice(0, limit);
}

async function getOgImage(pageUrl) {
    const res = await axios.get(pageUrl, {
        headers: { 'User-Agent': UA_PREVIEW },
        timeout: 10000,
        maxRedirects: 5,
        maxContentLength: 2 * 1024 * 1024,
        validateStatus: () => true,
        responseType: 'text',
    });
    if (res.status >= 400) throw new Error(`halaman membalas ${res.status}`);
    const html = String(res.data);
    const a = html.match(/<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i);
    const b = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
    const found = (a || b || [])[1];
    if (!found) throw new Error('gambar (og:image) tidak ditemukan di halaman');
    return new URL(decodeEntities(found), pageUrl).href;
}

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

async function fetchImage(url) {
    await assertPublicUrl(url);
    const get = (u) =>
        axios.get(u, {
            beforeRedirect: guardRedirect,
            headers: { 'User-Agent': UA_BROWSER, Referer: new URL(u).origin + '/' },
            timeout: 20000,
            maxRedirects: 5,
            maxContentLength: MAX_IMAGE_BYTES,
            responseType: 'arraybuffer',
            validateStatus: () => true,
        });

    let res = await get(url);
    let ctype = String(res.headers['content-type'] || '');
    if (res.status < 400 && /text\/html/i.test(ctype)) {
        const img = await getOgImage(url);
        if (!img) throw new Error('Halaman itu tidak punya gambar');
        await assertPublicUrl(img);
        res = await get(img);
        ctype = String(res.headers['content-type'] || '');
    }
    if (res.status >= 400) throw new Error(`gagal mengunduh gambar (${res.status})`);
    if (!/^image\//i.test(ctype)) throw new Error('URL itu bukan gambar');
    return { buffer: Buffer.from(res.data), mime: ctype.split(';')[0] };
}

module.exports = { findLinks, checkUrl, getOgImage, fetchImage, parseDdg, parseBing, webSearch };
