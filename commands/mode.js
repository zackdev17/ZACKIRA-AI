/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { getChatMode, setChatMode } = require('../lib/settings.js');

module.exports = {
    name: 'mode',
    category: 'owner',
    usage: 'mode private|group|all',
    description: 'Atur AI balas di private chat / group / keduanya',
    ownerOnly: true,
    async execute({ zack, jid, args, prefix }) {
        const arg = (args[0] || '').toLowerCase();

        if (!arg) {
            await zack.sendMessage(
                jid,
                {
                    text:
                        `Mode chat AI saat ini: *${getChatMode()}*\n\n` +
                        `Cara ganti:\n` +
                        `${prefix}mode all → balas di private chat & group\n` +
                        `${prefix}mode private → cuma balas di private chat\n` +
                        `${prefix}mode group → cuma balas di group`,
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

        setChatMode(arg);
        await zack.sendMessage(jid, { text: `✅ Mode chat AI diubah jadi *${arg}*.` }, { quoted: null });
    },
};