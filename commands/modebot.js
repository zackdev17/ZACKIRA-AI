/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { getBotMode, setBotMode } = require('../lib/settings.js');

module.exports = {
    name: 'modebot',
    category: 'owner',
    usage: 'modebot private|group|all',
    description: 'Atur bot (command) aktif di private chat / group / keduanya',
    ownerOnly: true,
    async execute({ zack, jid, args, prefix }) {
        const arg = (args[0] || '').toLowerCase();

        if (!arg) {
            await zack.sendMessage(
                jid,
                {
                    text:
                        `Mode bot saat ini: *${getBotMode()}*\n\n` +
                        `Cara ganti:\n` +
                        `${prefix}modebot all → bot aktif di private chat & group\n` +
                        `${prefix}modebot private → bot cuma aktif di private chat\n` +
                        `${prefix}modebot group → bot cuma aktif di group`,
                },
                { quoted: null }
            );
            return;
        }

        if (!['all', 'private', 'group'].includes(arg)) {
            await zack.sendMessage(
                jid,
                { text: 'Mode tidak dikenali. Pilihan: all, private, group.' },
                { quoted: null }
            );
            return;
        }

        setBotMode(arg);
        await zack.sendMessage(jid, { text: `✅ Mode bot diubah jadi *${arg}*.` }, { quoted: null });
    },
};