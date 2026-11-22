/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { getFlag, setFlag } = require('../lib/settings.js');
const { getVar } = require('../lib/botContext.js');
const ui = require('../lib/interactive.js');

module.exports = {
    name: 'anticall',
    category: 'owner',
    usage: 'anticall on|off',
    description: 'Blokir otomatis nomor yang menelepon bot (on/off)',
    ownerOnly: true,
    async execute({ zack, jid, args, prefix }) {
        const arg = (args[0] || '').toLowerCase();
        const say = (text) => zack.sendMessage(jid, { text }, { quoted: null });

        if (arg === 'on' || arg === 'off') {
            setFlag('antiCall', arg === 'on');
            return say(`✅ Anti-call sekarang *${arg === 'on' ? 'AKTIF' : 'MATI'}*.`);
        }

        const status = getFlag('antiCall') ? 'AKTIF ✅' : 'MATI ❌';
        const text = `Anti-call: *${status}*\n\nKalau aktif, telepon yang masuk ke bot otomatis ditolak dan nomor penelepon diblokir (owner tidak diblokir).`;
        try {
            await ui.sendButtons(zack, jid, {
                title: 'ANTI CALL',
                text,
                footer: getVar('botname'),
                buttons: [
                    { type: 'reply', label: 'Aktifkan', value: `${prefix}anticall on` },
                    { type: 'reply', label: 'Matikan', value: `${prefix}anticall off` },
                ],
            });
        } catch (e) {
            await say(`${text}\n\nKetik ${prefix}anticall on atau ${prefix}anticall off.`);
        }
    },
};
