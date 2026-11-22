/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ui = require('../lib/interactive.js');
const { getOwnerNumbers } = require('../lib/owner.js');
const { current, getVar } = require('../lib/botContext.js');

async function fetchPhoto(zack, number) {
    try {
        const url = await zack.profilePictureUrl(`${number}@s.whatsapp.net`, 'image');
        if (!url) return null;
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: 5 * 1024 * 1024 });
        const buf = Buffer.from(res.data);
        return buf.length ? buf : null;
    } catch {
        return null;
    }
}

async function fetchBio(zack, number) {
    try {
        const res = await zack.fetchStatus(`${number}@s.whatsapp.net`);
        const item = Array.isArray(res) ? res[0] : res;
        const text = item?.status?.status ?? item?.status;
        return typeof text === 'string' && text.trim() ? text.trim().slice(0, 150) : '';
    } catch {
        return '';
    }
}

function fallbackImage() {
    const file = path.join(process.cwd(), 'image', 'menu.jpg');
    return fs.existsSync(file) ? fs.readFileSync(file) : undefined;
}

module.exports = {
    name: 'owner',
    category: 'umum',
    usage: 'owner',
    description: 'Info pemilik bot beserta tombol chat langsung',
    ownerOnly: false,
    async execute({ zack, jid }) {
        const owners = [...new Set(getOwnerNumbers())];
        if (!owners.length) {
            await zack.sendMessage(jid, { text: 'Nomor owner belum diatur.' }, { quoted: null });
            return;
        }

        const isMain = current().isMain;
        const primary = owners[0];
        const [photo, bio] = await Promise.all([fetchPhoto(zack, primary), fetchBio(zack, primary)]);

        const name = getVar('author') || 'Owner';
        const lines = [
            `👑 *${isMain ? 'OWNER BOT' : 'PEMILIK BOT'}*`,
            '',
            `• Nama   : ${name}`,
            `• Nomor  : +${primary}`,
            `• Peran  : ${isMain ? 'Pengembang dan pemilik bot' : 'Pemilik bot ini'}`,
            `• Bot    : ${getVar('botname')}`,
        ];
        if (bio) lines.push(`• Bio    : ${bio}`);
        if (owners.length > 1) lines.push('', '*Owner lainnya:*', ...owners.slice(1).map((n) => `• +${n}`));
        lines.push('', 'Ketuk tombol di bawah untuk langsung chat owner.');
        const text = lines.join('\n');

        const buttons = owners.slice(0, 3).map((n, i) => ({
            type: 'url',
            label: i === 0 ? 'Chat Owner' : `Chat Owner ${i + 1}`,
            url: `https://wa.me/${n}`,
        }));

        try {
            await ui.sendButtons(zack, jid, {
                title: `${getVar('botname')}`,
                text,
                footer: `© ${name}`,
                imageUrl: photo || fallbackImage(),
                buttons,
            });
        } catch (e) {
            console.log('Owner (tombol) gagal, fallback teks:', e.message);
            const caption = `${text.replace('Ketuk tombol di bawah untuk langsung chat owner.', '')}\nChat: ${buttons.map((b) => b.url).join('\n')}`;
            const content = photo ? { image: photo, caption } : { text: caption };
            await zack.sendMessage(jid, content, { quoted: null });
        }

        try {
            const vcard = [
                'BEGIN:VCARD',
                'VERSION:3.0',
                `FN:${name}`,
                `TEL;type=CELL;type=VOICE;waid=${primary}:+${primary}`,
                'END:VCARD',
            ].join('\n');
            await zack.sendMessage(jid, { contacts: { displayName: name, contacts: [{ vcard }] } }, { quoted: null });
        } catch (e) {
            console.log('Owner (kontak) gagal:', e.message);
        }
    },
};
