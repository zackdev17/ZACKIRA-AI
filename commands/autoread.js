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
    name: 'autoread',
    category: 'owner',
    usage: 'autoread on|off',
    description: 'Bot membaca pesan masuk seperti orang sungguhan (on/off)',
    ownerOnly: true,
    async execute({ zack, jid, args, prefix }) {
        const arg = (args[0] || '').toLowerCase();
        const say = (text) => zack.sendMessage(jid, { text }, { quoted: null });

        if (arg === 'on' || arg === 'off') {
            setFlag('autoRead', arg === 'on');
            return say(`✅ Auto-read sekarang *${arg === 'on' ? 'AKTIF' : 'MATI'}*.`);
        }

        const status = getFlag('autoRead') ? 'AKTIF ✅' : 'MATI ❌';
        const text = `Auto-read: *${status}*\n\nKalau aktif, pesan masuk dibaca (centang biru) dengan jeda acak seperti orang yang membuka WhatsApp.`;
        try {
            await ui.sendButtons(zack, jid, {
                title: 'AUTO READ',
                text,
                footer: getVar('botname'),
                buttons: [
                    { type: 'reply', label: 'Aktifkan', value: `${prefix}autoread on` },
                    { type: 'reply', label: 'Matikan', value: `${prefix}autoread off` },
                ],
            });
        } catch (e) {
            await say(`${text}\n\nKetik ${prefix}autoread on atau ${prefix}autoread off.`);
        }
    },
};
