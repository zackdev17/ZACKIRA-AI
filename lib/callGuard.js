/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { getFlag } = require('./settings.js');
const { isOwner } = require('./owner.js');

const handled = new Set();

async function handleCalls(zack, calls) {
    if (!getFlag('antiCall')) return;
    for (const call of calls || []) {
        if (!call || call.status !== 'offer' || handled.has(call.id)) continue;
        handled.add(call.id);
        if (handled.size > 200) handled.delete(handled.values().next().value);

        const caller = call.callerPn || call.from;
        try {
            await zack.rejectCall(call.id, call.from);
        } catch (e) {
            console.log('[CALL] gagal menolak telepon:', e.message);
        }
        if (call.isGroup) {
            console.log('[CALL] telepon grup ditolak');
            continue;
        }
        if ((await isOwner(zack, call.from)) || (await isOwner(zack, caller))) {
            console.log('[CALL] telepon owner ditolak, tidak diblokir');
            continue;
        }
        try {
            await zack.sendMessage(caller, { text: '📵 Maaf, bot tidak menerima telepon. Nomor kamu diblokir otomatis.' });
        } catch (e) {
            console.log('[CALL] gagal kirim pesan peringatan:', e.message);
        }
        try {
            await zack.updateBlockStatus(caller, 'block');
            console.log(`[CALL] ${caller} menelepon -> ditolak & diblokir`);
        } catch (e) {
            console.log('[CALL] gagal memblokir:', e.message);
        }
    }
}

module.exports = { handleCalls };
