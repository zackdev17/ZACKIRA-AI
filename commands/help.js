/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { current } = require('../lib/botContext.js');

module.exports = {
    name: 'help',
    category: 'umum',
    usage: 'help',
    description: 'Lihat daftar command yang tersedia',
    ownerOnly: false,
    async execute({ zack, jid, prefix, commands }) {
        const lines = [...new Set(commands.values())]
            .filter((c) => !c.mainOnly || current().isMain)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => `${prefix}${c.name} - ${c.description}${c.ownerOnly ? ' (khusus owner)' : ''}`);

        await zack.sendMessage(jid, { text: `Daftar command:\n\n${lines.join('\n')}` }, { quoted: null });
    },
};