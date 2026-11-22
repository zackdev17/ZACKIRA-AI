/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { getFlag } = require('./settings.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readDelay(text) {
    const len = String(text || '').length;
    return Math.min(4000, 800 + Math.min(len, 120) * 25 + Math.floor(Math.random() * 1200));
}

async function humanRead(zack, z, text) {
    if (!getFlag('autoRead')) return;
    try {
        const jid = z.key.remoteJid;
        await zack.sendPresenceUpdate('available', jid).catch(() => {});
        await sleep(readDelay(text));
        await zack.readMessages([z.key]);
    } catch (e) {
        console.log('[READ] gagal menandai dibaca:', e.message);
    }
}

module.exports = { humanRead, readDelay };
