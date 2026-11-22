/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const axios = require('axios');
const { searchPinterest } = require('./pinterest.js');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

const decode = (s) =>
    String(s)
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');

const clip = (s, n) => {
    s = String(s || '').replace(/[]/g, '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
};

function parseBingImages(html, query, limit) {
    const out = [];
    const seen = new Set();
    const re = /class="iusc"[^>]*?\sm="([^"]+)"/g;
    let m;
    while ((m = re.exec(String(html || '')))) {
        let j;
        try {
            j = JSON.parse(decode(m[1]));
        } catch {
            continue;
        }
        const image = j.murl;
        if (!image || !/^https?:\/\//i.test(image) || seen.has(image)) continue;
        seen.add(image);
        out.push({
            title: clip(j.t || j.desc || query, 80),
            author: '',
            image,
            thumb: /^https?:\/\//i.test(j.turl || '') ? j.turl : image,
            source: /^https?:\/\//i.test(j.purl || '') ? j.purl : image,
        });
        if (out.length >= limit) break;
    }
    return out;
}

async function searchBing(query, limit) {
    let res;
    try {
        res = await axios.get('https://www.bing.com/images/async', {
            params: { q: query, first: 0, count: Math.min(limit * 3, 35), mmasync: 1, adlt: 'strict' },
            headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8', Cookie: 'SRCHHPGUSR=ADLT=STRICT' },
            timeout: 20000,
            validateStatus: () => true,
        });
    } catch (e) {
        throw new Error(`Bing tidak bisa diakses: ${e.message}`);
    }
    if (res.status >= 400) throw new Error(`Bing HTTP ${res.status}`);
    return parseBingImages(res.data, query, limit);
}

async function searchImages(query, limit = 10) {
    let pinErr = '';
    try {
        const r = await searchPinterest(query, limit);
        if (r.length) return { provider: 'pinterest', results: r };
        pinErr = 'Pinterest tidak mengembalikan hasil';
    } catch (e) {
        pinErr = e.message;
    }
    console.log(`[IMG] Pinterest gagal (${pinErr}), mencoba Bing`);
    try {
        const r = await searchBing(query, limit);
        if (r.length) return { provider: 'bing', results: r };
        throw new Error('Bing tidak mengembalikan hasil');
    } catch (e) {
        throw new Error(`Pencarian gambar gagal. Pinterest: ${pinErr}. Bing: ${e.message}`);
    }
}

module.exports = { searchImages, parseBingImages };
