/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const store = require('./rentalStore.js');
const { current } = require('./botContext.js');
const { isOwner, resolveNumber } = require('./owner.js');

const DAY = 86400000;

function isPremium(number) {
    const r = store.premium()[number];
    return !!r && r.expiresAt > Date.now();
}

function add(number, days) {
    const cur = store.premium()[number];
    const now = Date.now();
    const base = cur && cur.expiresAt > now ? cur.expiresAt : now;
    const rec = { expiresAt: base + days * DAY, addedAt: cur?.addedAt || now, totalDays: (cur?.totalDays || 0) + days };
    store.putPremium(number, rec);
    return rec;
}

function remove(number) {
    const had = !!store.premium()[number];
    if (had) store.delPremium(number);
    return had;
}

async function hasAccess(zack, sender) {
    if (!current().isMain) return true;
    if (await isOwner(zack, sender)) return true;
    const num = await resolveNumber(zack, sender);
    return !!num && isPremium(num);
}

function premiumTools() {
    return String(process.env.PREMIUM_TOOLS || '')
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
}

const isPremiumTool = (name) => premiumTools().includes(name);

function list() {
    const now = Date.now();
    return Object.entries(store.premium())
        .map(([number, r]) => ({ number, ...r }))
        .filter((r) => r.expiresAt > now)
        .sort((a, b) => a.expiresAt - b.expiresAt);
}

function prune() {
    const now = Date.now();
    for (const [number, r] of Object.entries(store.premium())) if (r.expiresAt <= now) store.delPremium(number);
}

module.exports = { isPremium, add, remove, list, prune, hasAccess, isPremiumTool, premiumTools };
