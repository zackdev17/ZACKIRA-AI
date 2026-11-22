/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const premium = require('../lib/premium.js');
const rental = require('../lib/rental.js');
const tools = require('../lib/groupTools.js');
const { resolveNumber } = require('../lib/owner.js');

const say = (zack, jid, text) => zack.sendMessage(jid, { text }, { quoted: null });
const manager = () => require('../lib/jadibot.js');

function parseTarget(z, args) {
    const jid = tools.targetJids(z, args)[0];
    return jid ? tools.digits(jid) : '';
}

module.exports = [
    {
        name: 'addprem',
        category: 'owner',
        usage: 'addprem 628xxx <hari>',
        description: 'Tambah pengguna premium (akses fitur premium bot)',
        ownerOnly: true,
        mainOnly: true,
        async execute({ zack, z, jid, args, prefix }) {
            const num = parseTarget(z, args);
            const days = parseInt(args[args.length - 1], 10);
            if (!/^\d{8,15}$/.test(num) || !Number.isInteger(days) || days < 1 || days > 3650) {
                return say(zack, jid, `Format: *${prefix}addprem 628xxxxxxxxxx 30*\n(1 sampai 3650 hari, bisa juga tag atau balas pesan orangnya)`);
            }
            const rec = premium.add(num, days);
            await say(zack, jid, `✅ Premium ${num} +${days} hari.\nAktif sampai: ${rental.fmtDate(rec.expiresAt)}`);
            await manager().notifyNumber(num, `🌟 Kamu sekarang pengguna *premium* sampai ${rental.fmtDate(rec.expiresAt)}. Fitur khusus premium di bot ini sudah bisa kamu pakai.`);
        },
    },
    {
        name: 'delprem',
        category: 'owner',
        usage: 'delprem 628xxx',
        description: 'Hapus pengguna premium',
        ownerOnly: true,
        mainOnly: true,
        async execute({ zack, z, jid, args, prefix }) {
            const num = parseTarget(z, args);
            if (!/^\d{8,15}$/.test(num)) return say(zack, jid, `Format: *${prefix}delprem 628xxxxxxxxxx*`);
            if (!premium.remove(num)) return say(zack, jid, `${num} bukan pengguna premium.`);
            await say(zack, jid, `✅ Premium ${num} dihapus.`);
            await manager().notifyNumber(num, '⏰ Status premium kamu telah dicabut oleh owner.');
        },
    },
    {
        name: 'listprem',
        category: 'owner',
        usage: 'listprem',
        description: 'Daftar pengguna premium',
        ownerOnly: true,
        mainOnly: true,
        async execute({ zack, jid }) {
            premium.prune();
            const list = premium.list();
            if (!list.length) return say(zack, jid, 'Belum ada pengguna premium.');
            const lines = list.map((r, i) => `${i + 1}. ${r.number}\n   sisa ${rental.fmtLeft(r.expiresAt - Date.now())} (s/d ${rental.fmtDate(r.expiresAt)})`);
            await say(zack, jid, `🌟 *Pengguna premium (${list.length})*\n\n${lines.join('\n')}`);
        },
    },
    {
        name: 'cekprem',
        category: 'umum',
        usage: 'cekprem',
        description: 'Cek status premium kamu',
        ownerOnly: false,
        mainOnly: true,
        async execute({ zack, z, jid }) {
            const num = await resolveNumber(zack, z.sender);
            const rec = num ? premium.list().find((r) => r.number === num) : null;
            await say(zack, jid, rec ? `🌟 Premium aktif sampai ${rental.fmtDate(rec.expiresAt)} (sisa ${rental.fmtLeft(rec.expiresAt - Date.now())}).` : 'Kamu belum premium. Hubungi owner untuk upgrade.');
        },
    },
];
