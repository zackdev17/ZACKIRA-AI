/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { getList, setList } = require('../lib/settings.js');
const { listHistories } = require('../lib/chatHistory.js');
const { getOwnerNumbers } = require('../lib/owner.js');

const say = (zack, jid, text) => zack.sendMessage(jid, { text }, { quoted: null });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const own = { category: 'owner', ownerOnly: true };

const numberOf = (z, args) => {
    const m = z.message?.extendedTextMessage?.contextInfo;
    const fromTag = (m?.mentionedJid || [])[0] || (m?.quotedMessage ? m.participant : '');
    const raw = fromTag || args.find((a) => String(a).replace(/[^0-9]/g, '').length >= 8) || '';
    return String(raw).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
};

module.exports = [
    {
        ...own,
        name: 'broadcast',
        usage: 'broadcast gc|pv|all <pesan>',
        description: 'Kirim pesan ke semua grup / chat pribadi',
        async execute({ zack, jid, args, raw, prefix }) {
            const target = (args[0] || '').toLowerCase();
            const text = raw.replace(/^\S+\s*/, '').trim();
            if (!['gc', 'pv', 'all'].includes(target) || !text) {
                return say(zack, jid, `Format: *${prefix}broadcast gc|pv|all <pesan>*\ngc = semua grup, pv = chat pribadi yang pernah chat, all = keduanya.`);
            }
            const dest = new Set();
            if (target !== 'pv') {
                try {
                    Object.keys(await zack.groupFetchAllParticipating()).forEach((g) => dest.add(g));
                } catch (e) {
                    await say(zack, jid, `Gagal membaca daftar grup: ${e.message}`);
                }
            }
            if (target !== 'gc') {
                listHistories()
                    .filter((h) => h.kind === 'private')
                    .forEach((h) => dest.add(h.id.endsWith('_lid') ? `${h.id.slice(0, -4)}@lid` : `${h.id}@s.whatsapp.net`));
            }
            const list = [...dest].slice(0, 200);
            await say(zack, jid, `📢 Mengirim ke ${list.length} chat...`);
            let ok = 0;
            for (const to of list) {
                try {
                    await zack.sendMessage(to, { text: `📢 *Broadcast*\n\n${text}` }, { quoted: null });
                    ok++;
                } catch {
                    continue;
                }
                await wait(1500);
            }
            await say(zack, jid, `✅ Broadcast selesai: ${ok}/${list.length} terkirim.`);
        },
    },
    {
        ...own,
        name: 'listgc',
        usage: 'listgc',
        description: 'Daftar grup tempat bot berada',
        async execute({ zack, jid }) {
            const all = Object.values(await zack.groupFetchAllParticipating());
            if (!all.length) return say(zack, jid, 'Bot belum ada di grup mana pun.');
            const lines = all.slice(0, 40).map((g, i) => `${i + 1}. ${g.subject} (${g.participants.length})\n   ${g.id}`);
            await say(zack, jid, `👥 *Grup bot (${all.length})*\n\n${lines.join('\n')}${all.length > 40 ? '\n\n(40 pertama)' : ''}`);
        },
    },
    {
        ...own,
        name: 'leave',
        usage: 'leave [id grup]',
        description: 'Suruh bot keluar dari grup',
        async execute({ zack, jid, isGroup, args }) {
            const target = args[0] && args[0].endsWith('@g.us') ? args[0] : isGroup ? jid : '';
            if (!target) return say(zack, jid, 'Pakai di dalam grup, atau sertakan id grup (lihat listgc).');
            await say(zack, target, 'Sampai jumpa 👋');
            await zack.groupLeave(target);
        },
    },
    {
        ...own,
        name: 'join',
        usage: 'join <link grup>',
        description: 'Suruh bot masuk ke grup lewat link',
        async execute({ zack, jid, args, prefix }) {
            const m = String(args[0] || '').match(/chat\.whatsapp\.com\/([A-Za-z0-9]{8,})/);
            if (!m) return say(zack, jid, `Contoh: *${prefix}join https://chat.whatsapp.com/xxxx*`);
            try {
                await zack.groupAcceptInvite(m[1]);
                await say(zack, jid, '✅ Bot berhasil masuk grup.');
            } catch (e) {
                await say(zack, jid, `Gagal masuk grup: ${e.message}`);
            }
        },
    },
    {
        ...own,
        name: 'ban',
        usage: 'ban 628xxx',
        description: 'Blokir pengguna dari bot (bot mengabaikannya)',
        async execute({ zack, z, jid, args, prefix }) {
            const num = numberOf(z, args);
            if (!/^\d{8,15}$/.test(num)) return say(zack, jid, `Format: *${prefix}ban 628xxxxxxxxxx*`);
            if (getOwnerNumbers().includes(num)) return say(zack, jid, 'Owner tidak bisa di-ban.');
            setList('banned', [...getList('banned'), num]);
            await say(zack, jid, `🚫 ${num} di-ban. Bot akan mengabaikan semua pesannya.`);
        },
    },
    {
        ...own,
        name: 'unban',
        usage: 'unban 628xxx',
        description: 'Cabut ban pengguna',
        async execute({ zack, z, jid, args, prefix }) {
            const num = numberOf(z, args);
            if (!/^\d{8,15}$/.test(num)) return say(zack, jid, `Format: *${prefix}unban 628xxxxxxxxxx*`);
            const before = getList('banned');
            if (!before.includes(num)) return say(zack, jid, `${num} tidak sedang di-ban.`);
            setList('banned', before.filter((n) => n !== num));
            await say(zack, jid, `✅ Ban ${num} dicabut.`);
        },
    },
    {
        ...own,
        name: 'listban',
        usage: 'listban',
        description: 'Daftar pengguna yang di-ban',
        async execute({ zack, jid }) {
            const list = getList('banned');
            await say(zack, jid, list.length ? `🚫 *Daftar ban (${list.length})*\n\n${list.map((n, i) => `${i + 1}. ${n}`).join('\n')}` : 'Belum ada yang di-ban.');
        },
    },
    {
        ...own,
        name: 'block',
        usage: 'block 628xxx',
        description: 'Blokir nomor di WhatsApp',
        async execute({ zack, z, jid, args, prefix }) {
            const num = numberOf(z, args);
            if (!/^\d{8,15}$/.test(num)) return say(zack, jid, `Format: *${prefix}block 628xxxxxxxxxx*`);
            if (getOwnerNumbers().includes(num)) return say(zack, jid, 'Nomor owner tidak bisa diblokir.');
            await zack.updateBlockStatus(`${num}@s.whatsapp.net`, 'block');
            await say(zack, jid, `✅ ${num} diblokir di WhatsApp.`);
        },
    },
    {
        ...own,
        name: 'unblock',
        usage: 'unblock 628xxx',
        description: 'Buka blokir nomor di WhatsApp',
        async execute({ zack, z, jid, args, prefix }) {
            const num = numberOf(z, args);
            if (!/^\d{8,15}$/.test(num)) return say(zack, jid, `Format: *${prefix}unblock 628xxxxxxxxxx*`);
            await zack.updateBlockStatus(`${num}@s.whatsapp.net`, 'unblock');
            await say(zack, jid, `✅ Blokir ${num} dibuka.`);
        },
    },
];
