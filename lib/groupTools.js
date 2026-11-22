/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const META_TTL = 15000;
const caches = new WeakMap();

const digits = (jid) => String(jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

function cacheOf(zack) {
    let c = caches.get(zack);
    if (!c) {
        c = new Map();
        caches.set(zack, c);
    }
    return c;
}

async function getMeta(zack, jid, force = false) {
    const cache = cacheOf(zack);
    const hit = cache.get(jid);
    if (!force && hit && Date.now() - hit.at < META_TTL) return hit.meta;
    const meta = await zack.groupMetadata(jid);
    cache.set(jid, { at: Date.now(), meta });
    return meta;
}

function dropMeta(zack, jid) {
    cacheOf(zack).delete(jid);
}

function keysOf(p) {
    return new Set([p.id, p.lid, p.phoneNumber, p.jid].map(digits).filter(Boolean));
}

function findParticipant(meta, jid) {
    const d = digits(jid);
    if (!d) return null;
    return (meta.participants || []).find((p) => keysOf(p).has(d)) || null;
}

const isAdminP = (p) => !!p && (p.admin === 'admin' || p.admin === 'superadmin');
const isAdmin = (meta, jid) => isAdminP(findParticipant(meta, jid));

function botKeys(zack) {
    return new Set([zack.user?.id, zack.user?.lid].map(digits).filter(Boolean));
}

function botParticipant(zack, meta) {
    const mine = botKeys(zack);
    return (meta.participants || []).find((p) => [...keysOf(p)].some((k) => mine.has(k))) || null;
}

const isBotAdmin = (zack, meta) => isAdminP(botParticipant(zack, meta));

function contextOf(z) {
    const m = z.message || {};
    const inner = m.extendedTextMessage || m.imageMessage || m.videoMessage || m.documentMessage || null;
    return inner?.contextInfo || null;
}

function targetJids(z, args = []) {
    const ctx = contextOf(z);
    const out = new Set();
    (ctx?.mentionedJid || []).forEach((j) => out.add(j));
    if (ctx?.participant && ctx?.quotedMessage) out.add(ctx.participant);
    for (const a of args) {
        const d = String(a).replace(/[^0-9]/g, '');
        if (!String(a).startsWith('@') && d.length >= 8 && d.length <= 15) out.add(`${d}@s.whatsapp.net`);
    }
    return [...out];
}

function resolveForGroup(meta, jids) {
    return jids.map((j) => findParticipant(meta, j)?.id || j);
}

const mentionTag = (jid) => `@${digits(jid)}`;

module.exports = {
    digits,
    getMeta,
    dropMeta,
    findParticipant,
    isAdmin,
    isBotAdmin,
    botParticipant,
    targetJids,
    resolveForGroup,
    contextOf,
    mentionTag,
};
