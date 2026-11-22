/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const fs = require('fs');
const path = require('path');

const { current } = require('./botContext.js');

const caches = new Map();
const fileOf = () => path.join(current().dbDir, 'user_profiles.json');

function load() {
    const file = fileOf();
    if (caches.has(file)) return caches.get(file);
    let data;
    try {
        data = JSON.parse(fs.readFileSync(file, 'utf-8')) || {};
    } catch {
        data = {};
    }
    caches.set(file, data);
    return data;
}

function save() {
    try {
        const file = fileOf();
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(load(), null, 2));
    } catch (e) {
        console.log('Save profile error:', e.message);
    }
}

function sanitizeName(name) {
    return String(name || '')
        .replace(/[\u0000-\u001f\u007f`<>{}\[\]\\|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 30);
}

const NAME = String.raw`([\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,2})`;
const LEAD = String.raw`(?:^|[\s,.!?;:])`;
const PATTERNS = [
    new RegExp(`${LEAD}(?:panggil|sebut|manggil)\\s+(?:aku|saya|gue|gw|gua|ku)\\s+(?:dengan\\s+|jadi\\s+|pakai\\s+|pake\\s+)?${NAME}`, 'iu'),
    new RegExp(`${LEAD}(?:nama\\s*(?:ku|q)|nama\\s+(?:saya|aku|gue|gw|gua))\\s*(?:itu|adalah|yaitu|:|=)?\\s*${NAME}`, 'iu'),
    new RegExp(`${LEAD}(?:aku|saya|gue|gw|gua)\\s+(?:bernama|namanya)\\s+${NAME}`, 'iu'),
    new RegExp(`${LEAD}(?:my name is|call me|i am called)\\s+${NAME}`, 'iu'),
];
const STOP_FIRST = new Set(
    'siapa apa ya yaa iya itu adalah bukan kenapa gimana gmn nggak ngga gak tidak apakah masih udah sudah lupa tau tahu inget ingat benar betul yang dong deh sih kok nanti ntar besok tadi dulu sekarang kalau jangan jam pagi siang sore malam kapan nih'.split(' ')
);
const STOP_AFTER = new Set(
    'ya yaa dong deh sih kok nih loh lho yah aja saja mulai sekarang dan tapi terus lalu karena kalau yang aku saya gue gw suka lagi mau bisa tolong'.split(' ')
);

function extractNickname(text) {
    const t = String(text || '');
    for (const re of PATTERNS) {
        const m = t.match(re);
        if (!m) continue;
        const words = m[1].trim().split(/\s+/);
        if (STOP_FIRST.has(words[0].toLowerCase())) continue;
        const kept = [];
        for (const w of words) {
            if (kept.length && STOP_AFTER.has(w.toLowerCase())) break;
            kept.push(w);
        }
        let name = sanitizeName(kept.join(' '));
        if (name.length < 2) continue;
        if (name === name.toLowerCase()) name = name.replace(/(^|\s)(\p{L})/gu, (_, s, c) => s + c.toUpperCase());
        return name;
    }
    return null;
}

function touchProfile(userId, pushName, text) {
    const db = load();
    const now = Date.now();
    const isNew = !db[userId];
    const p = (db[userId] ||= { firstSeen: now, count: 0 });

    const clean = sanitizeName(pushName);
    if (clean) p.pushName = clean;

    let nicknameChanged = false;
    const nick = extractNickname(text);
    if (nick && nick !== p.nickname) {
        p.nickname = nick;
        nicknameChanged = true;
    }

    p.lastSeen = now;
    p.count = (p.count || 0) + 1;
    save();

    const name = p.nickname || p.pushName || '';
    return { name, known: !!name, nicknameChanged, isNew, count: p.count };
}

module.exports = { touchProfile, extractNickname, sanitizeName };
