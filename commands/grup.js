/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const settings = require('../lib/groupSettings.js');
const tools = require('../lib/groupTools.js');

const say = (zack, jid, text, mentions) => zack.sendMessage(jid, mentions ? { text, mentions } : { text }, { quoted: null });
const STAMP = (ms) => new Date(ms * 1000).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric' });

const base = { category: 'grup', groupOnly: true, premiumOnly: true };
const admin = { ...base, adminOnly: true, botAdmin: true };

function participantAction(name, action, usage, description, verb) {
    return {
        ...admin,
        name,
        usage,
        description,
        async execute({ zack, z, jid, meta, args, prefix }) {
            const found = tools.targetJids(z, args);
            if (!found.length) return say(zack, jid, `Tandai atau balas pesan orangnya.\nContoh: *${prefix}${name} @orang*`);
            const ids = tools.resolveForGroup(meta, found);
            const skip = [];
            const ok = [];
            for (let i = 0; i < ids.length; i++) {
                const p = tools.findParticipant(meta, found[i]);
                const isAdm = tools.isAdmin(meta, found[i]);
                if (action === 'remove' && (isAdm || (p && tools.botParticipant(zack, meta) === p))) skip.push(found[i]);
                else if (action === 'promote' && isAdm) skip.push(found[i]);
                else if (action === 'demote' && !isAdm) skip.push(found[i]);
                else ok.push(ids[i]);
            }
            if (!ok.length) return say(zack, jid, 'Tidak ada yang bisa diproses (admin tidak bisa dikeluarkan, atau statusnya sudah sesuai).', skip);
            try {
                await zack.groupParticipantsUpdate(jid, ok, action);
                tools.dropMeta(zack, jid);
                await say(zack, jid, `✅ Berhasil ${verb}: ${ok.map(tools.mentionTag).join(', ')}`, ok);
            } catch (e) {
                await say(zack, jid, `Gagal ${verb}: ${e.message}`);
            }
        },
    };
}

function toggle(name, key, modes, description, usage, hint) {
    return {
        ...base,
        adminOnly: true,
        needMeta: true,
        name,
        usage,
        description,
        async execute({ zack, jid, meta, args, prefix }) {
            const arg = (args[0] || '').toLowerCase();
            const cur = settings.get(jid)[key];
            if (!arg) {
                return say(zack, jid, `*${name.toUpperCase()}* di grup ini: *${cur}*\n\n${hint}\nPilihan: ${modes.join(' / ')}\nContoh: *${prefix}${name} on*`);
            }
            if (!modes.includes(arg)) return say(zack, jid, `Pilihan tidak valid. Pakai: ${modes.join(' / ')}`);
            settings.set(jid, { [key]: arg });
            const warn = arg !== 'off' && !tools.isBotAdmin(zack, meta) ? '\n\n⚠️ Bot belum jadi admin grup, jadi belum bisa menghapus pesan. Jadikan bot admin dulu.' : '';
            await say(zack, jid, `✅ ${name} diubah menjadi *${arg}*.${warn}`);
        },
    };
}

function flag(name, key, description, usage) {
    return {
        ...base,
        adminOnly: true,
        name,
        usage,
        description,
        async execute({ zack, jid, args, prefix }) {
            const arg = (args[0] || '').toLowerCase();
            if (!['on', 'off'].includes(arg)) return say(zack, jid, `*${name.toUpperCase()}* di grup ini: *${settings.get(jid)[key] ? 'on' : 'off'}*\nContoh: *${prefix}${name} on*`);
            settings.set(jid, { [key]: arg === 'on' });
            await say(zack, jid, `✅ ${name} ${arg === 'on' ? 'diaktifkan' : 'dimatikan'}.`);
        },
    };
}

module.exports = [
    {
        ...admin,
        name: 'group',
        usage: 'group open|close',
        description: 'Buka atau tutup grup (hanya admin yang boleh chat)',
        async execute({ zack, jid, args, prefix }) {
            const a = (args[0] || '').toLowerCase();
            const map = { open: 'not_announcement', buka: 'not_announcement', close: 'announcement', tutup: 'announcement' };
            if (!map[a]) return say(zack, jid, `Pakai: *${prefix}group open* atau *${prefix}group close*`);
            await zack.groupSettingUpdate(jid, map[a]);
            tools.dropMeta(zack, jid);
            await say(zack, jid, map[a] === 'announcement' ? '🔒 Grup ditutup, hanya admin yang bisa kirim pesan.' : '🔓 Grup dibuka, semua anggota bisa kirim pesan.');
        },
    },
    participantAction('kick', 'remove', 'kick @tag / balas pesan', 'Keluarkan anggota dari grup', 'mengeluarkan'),
    participantAction('promote', 'promote', 'promote @tag', 'Jadikan anggota sebagai admin', 'menjadikan admin'),
    participantAction('demote', 'demote', 'demote @tag', 'Turunkan admin jadi anggota', 'menurunkan admin'),
    {
        ...admin,
        name: 'add',
        usage: 'add 628xxx',
        description: 'Tambahkan nomor ke grup',
        async execute({ zack, jid, args, z, prefix }) {
            const nums = tools.targetJids(z, args);
            if (!nums.length) return say(zack, jid, `Contoh: *${prefix}add 628123456789*`);
            try {
                const res = await zack.groupParticipantsUpdate(jid, nums, 'add');
                const lines = (res || []).map((r) => `• ${tools.digits(r.jid || r.content?.attrs?.jid)} : ${String(r.status) === '200' ? 'berhasil' : String(r.status) === '403' ? 'privasi, perlu undangan' : String(r.status) === '409' ? 'sudah di grup' : `status ${r.status}`}`);
                tools.dropMeta(zack, jid);
                await say(zack, jid, `Hasil:\n${lines.join('\n') || 'selesai'}`);
            } catch (e) {
                await say(zack, jid, `Gagal menambahkan: ${e.message}`);
            }
        },
    },
    {
        ...admin,
        name: 'tagall',
        usage: 'tagall [pesan]',
        description: 'Tandai semua anggota grup',
        async execute({ zack, jid, meta, raw }) {
            const ids = meta.participants.map((p) => p.id);
            const head = raw.trim() || 'Perhatian semua anggota';
            const text = `📣 *${head}*\n\n${ids.map((i) => `• ${tools.mentionTag(i)}`).join('\n')}`;
            await say(zack, jid, text, ids);
        },
    },
    {
        ...admin,
        name: 'hidetag',
        usage: 'hidetag <pesan>',
        description: 'Kirim pesan yang menandai semua anggota tanpa terlihat',
        async execute({ zack, jid, meta, raw, prefix }) {
            if (!raw.trim()) return say(zack, jid, `Contoh: *${prefix}hidetag pengumuman penting*`);
            await say(zack, jid, raw.trim(), meta.participants.map((p) => p.id));
        },
    },
    {
        ...admin,
        name: 'linkgc',
        usage: 'linkgc',
        description: 'Ambil link undangan grup',
        async execute({ zack, jid }) {
            const code = await zack.groupInviteCode(jid);
            await say(zack, jid, code ? `🔗 https://chat.whatsapp.com/${code}` : 'Gagal mengambil link grup.');
        },
    },
    {
        ...admin,
        name: 'revoke',
        usage: 'revoke',
        description: 'Reset link undangan grup',
        async execute({ zack, jid }) {
            const code = await zack.groupRevokeInvite(jid);
            await say(zack, jid, code ? `✅ Link direset.\n🔗 https://chat.whatsapp.com/${code}` : 'Link direset.');
        },
    },
    {
        ...admin,
        name: 'setnamegc',
        usage: 'setnamegc <nama baru>',
        description: 'Ganti nama grup',
        async execute({ zack, jid, raw, prefix }) {
            const name = raw.trim().slice(0, 100);
            if (!name) return say(zack, jid, `Contoh: *${prefix}setnamegc Nama Baru*`);
            await zack.groupUpdateSubject(jid, name);
            tools.dropMeta(zack, jid);
            await say(zack, jid, `✅ Nama grup diganti menjadi *${name}*`);
        },
    },
    {
        ...admin,
        name: 'setdesc',
        usage: 'setdesc <deskripsi>',
        description: 'Ganti deskripsi grup',
        async execute({ zack, jid, raw, prefix }) {
            const text = raw.trim().slice(0, 2000);
            if (!text) return say(zack, jid, `Contoh: *${prefix}setdesc Aturan grup ...*`);
            await zack.groupUpdateDescription(jid, text);
            tools.dropMeta(zack, jid);
            await say(zack, jid, '✅ Deskripsi grup diperbarui.');
        },
    },
    {
        ...admin,
        name: 'del',
        usage: 'del (balas pesan)',
        description: 'Hapus pesan yang kamu balas',
        async execute({ zack, z, jid }) {
            const ctx = tools.contextOf(z);
            if (!ctx?.stanzaId) return say(zack, jid, 'Balas pesan yang ingin dihapus.');
            await zack.sendMessage(jid, { delete: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant, fromMe: false } });
        },
    },
    {
        ...base,
        needMeta: true,
        name: 'infogc',
        usage: 'infogc',
        description: 'Info grup dan status proteksinya',
        async execute({ zack, jid, meta }) {
            const s = settings.get(jid);
            const admins = meta.participants.filter((p) => p.admin).length;
            const lines = [
                `👥 *${meta.subject}*`,
                '',
                `• Anggota : ${meta.participants.length} (admin ${admins})`,
                meta.creation ? `• Dibuat  : ${STAMP(meta.creation)}` : null,
                `• Chat    : ${meta.announce ? 'hanya admin' : 'semua anggota'}`,
                `• Bot admin : ${tools.isBotAdmin(zack, meta) ? 'ya' : 'bukan'}`,
                '',
                '*Proteksi*',
                `• antilink    : ${s.antilink}`,
                `• antiswgroup : ${s.antiswgroup}`,
                `• antipromosi : ${s.antipromosi}`,
                `• welcome     : ${s.welcome ? 'on' : 'off'}`,
                `• goodbye     : ${s.goodbye ? 'on' : 'off'}`,
                meta.desc ? `\n*Deskripsi*\n${String(meta.desc).slice(0, 400)}` : null,
            ].filter((l) => l !== null);
            await say(zack, jid, lines.join('\n'));
        },
    },
    {
        ...base,
        needMeta: true,
        name: 'listadmin',
        usage: 'listadmin',
        description: 'Daftar admin grup',
        async execute({ zack, jid, meta }) {
            const admins = meta.participants.filter((p) => p.admin);
            await say(zack, jid, `👮 *Admin grup (${admins.length})*\n\n${admins.map((p, i) => `${i + 1}. ${tools.mentionTag(p.id)}`).join('\n')}`, admins.map((p) => p.id));
        },
    },
    toggle('antilink', 'antilink', ['off', 'on', 'all', 'kick'], 'Hapus link grup/channel dari non-admin (on, all, kick)', 'antilink on|all|kick|off', 'on = hapus link grup/channel WhatsApp, all = hapus semua link, kick = hapus lalu keluarkan.'),
    toggle('antiswgroup', 'antiswgroup', ['off', 'on', 'kick'], 'Hapus pesan status yang menandai grup (swgroup)', 'antiswgroup on|kick|off', 'on = hapus pesan tanda grup di status, kick = hapus lalu keluarkan.'),
    toggle('antipromosi', 'antipromosi', ['off', 'on', 'kick'], 'Hapus pesan promosi / iklan dari non-admin', 'antipromosi on|kick|off', 'Deteksi memakai kata kunci promosi, jadi bisa meleset. Admin tidak terkena.'),
    flag('welcome', 'welcome', 'Sambut anggota baru yang masuk', 'welcome on|off'),
    flag('goodbye', 'goodbye', 'Kirim pesan perpisahan saat anggota keluar', 'goodbye on|off'),
];
