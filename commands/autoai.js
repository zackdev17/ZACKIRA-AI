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
    name: 'autoai',
    category: 'owner',
    usage: 'autoai on|off',
    description: 'Nyalakan / matikan respon otomatis AI (on/off)',
    ownerOnly: true,
    async execute({ zack, jid, args, prefix }) {
        const arg = (args[0] || '').toLowerCase();
        const say = (text) => zack.sendMessage(jid, { text }, { quoted: null });

        if (arg === 'on' || arg === 'off') {
            setFlag('autoAiOff', arg === 'off');
            return say(`✅ Respon otomatis AI sekarang *${arg === 'on' ? 'AKTIF' : 'MATI'}*.`);
        }

        const status = getFlag('autoAiOff') ? 'MATI ❌' : 'AKTIF ✅';
        const text = `Auto AI: *${status}*\n\nKalau mati, AI tidak membalas chat biasa. Command bot (seperti ${prefix}menu) tetap berjalan.`;
        try {
            await ui.sendButtons(zack, jid, {
                title: 'AUTO AI',
                text,
                footer: getVar('botname'),
                buttons: [
                    { type: 'reply', label: 'Aktifkan', value: `${prefix}autoai on` },
                    { type: 'reply', label: 'Matikan', value: `${prefix}autoai off` },
                ],
            });
        } catch (e) {
            await say(`${text}\n\nKetik ${prefix}autoai on atau ${prefix}autoai off.`);
        }
    },
};
