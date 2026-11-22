/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { getVar } = require('../lib/botContext.js');
const { sampleLive } = require('../lib/sysStats.js');
const { renderStatusCard, fmtBytes, fmtUptime } = require('../lib/statusCard.js');

function nowWib() {
    return new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
}

module.exports = {
    name: 'ping',
    category: 'umum',
    usage: 'ping',
    description: 'Status sistem bot secara realtime (gambar)',
    ownerOnly: false,
    async execute({ zack, z, jid }) {
        const t0 = Date.now();
        try {
            await zack.sendPresenceUpdate('composing', jid);
        } catch {}
        let ping = Date.now() - t0;
        const sent = Number(z?.messageTimestamp);
        if ((!ping || ping < 1) && sent) ping = Math.max(1, Date.now() - sent * 1000);

        try {
            const live = await sampleLive(500);
            const png = renderStatusCard({
                ...live,
                ping: Math.max(1, ping),
                title: getVar('botname'),
                version: global.botVersion,
                timestamp: nowWib(),
            });
            const caption =
                `*STATUS SISTEM*\n` +
                `• Latency : ${Math.max(1, ping)} ms\n` +
                `• CPU     : ${live.cpu.toFixed(0)}% (${live.cpuCores} core)\n` +
                `• RAM     : ${fmtBytes(live.ramUsed)} / ${fmtBytes(live.ramTotal)}\n` +
                `• Uptime  : ${fmtUptime(live.uptimeBot)}`;
            await zack.sendMessage(jid, { image: png, caption }, { quoted: null });
        } catch (e) {
            console.log('[PING] gagal membuat gambar status:', e.message);
            await zack.sendMessage(jid, { text: `Pong! ${Math.max(1, ping)} ms` }, { quoted: null });
        }
    },
};
