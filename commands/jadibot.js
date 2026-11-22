/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const axios = require('axios');
const ui = require('../lib/interactive.js');
const rental = require('../lib/rental.js');
const { isOwner, resolveNumber } = require('../lib/owner.js');

const manager = () => require('../lib/jadibot.js');
const reply = (zack, jid, text) => zack.sendMessage(jid, { text }, { quoted: null });
const SUBS = new Set(['list', 'stop', 'status', 'sewa', 'cek', 'batal', 'give']);

function uptime(since) {
    if (!since) return '-';
    const m = Math.floor((Date.now() - since) / 60000);
    return m >= 60 ? `${Math.floor(m / 60)}j ${m % 60}m` : `${m}m`;
}

async function loadQr(source) {
    if (!source) return undefined;
    const m = String(source).match(/^data:image\/[a-z]+;base64,(.+)$/i);
    if (m) return Buffer.from(m[1], 'base64');
    try {
        const res = await axios.get(source, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: 3 * 1024 * 1024 });
        return Buffer.from(res.data);
    } catch {
        return source;
    }
}

async function sendPlans(zack, jid, prefix, number) {
    const plans = rental.plans();
    const rows = plans.map((p) => ({ title: p.label, description: `${rental.rp(p.price)} (${p.days} hari)`, id: `${prefix}jadibot sewa ${p.days}` }));
    const text =
        `Sewa jadibot untuk nomor ${number}.\n\n` +
        `Harga ${rental.rp(rental.pricePerDay())} per hari, bayar lewat QRIS. ` +
        `Begitu pembayaran terkonfirmasi, kode pairing langsung dikirim ke sini.\n\n` +
        `Pilih lama sewa:`;
    try {
        await ui.sendList(zack, jid, {
            title: 'SEWA JADIBOT',
            text,
            footer: 'Bayar QRIS, aktif otomatis',
            buttonLabel: 'Pilih paket',
            sections: [{ title: 'Paket sewa', rows }],
        });
    } catch (e) {
        console.log('sewa list gagal, fallback teks:', e.message);
        const lines = plans.map((p) => `• ${prefix}jadibot sewa ${p.days}  → ${p.label} (${rental.rp(p.price)})`);
        await reply(zack, jid, `*SEWA JADIBOT*\n${text}\n\n${lines.join('\n')}`);
    }
}

async function sendInvoice(zack, jid, prefix, order, reused) {
    const text =
        `🧾 *Tagihan Sewa Jadibot*${reused ? ' (tagihan yang masih aktif)' : ''}\n\n` +
        `• Nomor   : ${order.number}\n` +
        `• Paket   : ${rental.labelOf(order.days)}\n` +
        `• Harga   : ${rental.rp(order.amount)}\n` +
        `• Biaya layanan : ${rental.rp(order.fee)}\n` +
        `• *Total bayar : ${rental.rp(order.total)}*\n` +
        `• Bayar sebelum : ${rental.fmtDate(order.expiresAt)}\n\n` +
        `Scan QRIS dengan e-wallet atau m-banking. Pembayaran dicek otomatis, jadi tunggu sebentar setelah membayar.`;
    const buttons = [
        { type: 'reply', label: 'Cek Pembayaran', id: `${prefix}jadibot cek` },
        { type: 'reply', label: 'Batalkan', id: `${prefix}jadibot batal` },
    ];
    if (order.payUrl) buttons.push({ type: 'url', label: 'Buka Halaman Bayar', url: order.payUrl });
    const qr = await loadQr(order.qrImage);
    try {
        await ui.sendButtons(zack, jid, { title: 'QRIS SEWA JADIBOT', text, footer: `ID ${order.id}`.slice(0, 60), imageUrl: qr, buttons });
    } catch (e) {
        console.log('tagihan (tombol) gagal, fallback:', e.message);
        const caption = `${text}\n\nCek: ${prefix}jadibot cek\nBatal: ${prefix}jadibot batal${order.payUrl ? `\nLink bayar: ${order.payUrl}` : ''}`;
        await zack.sendMessage(jid, qr && typeof qr !== 'string' ? { image: qr, caption } : { text: caption }, { quoted: null });
    }
}

function statusText(number, prefix) {
    const r = rental.getRental(number);
    const running = manager().bots.get(number);
    if (!r || r.state === 'expired' || r.expiresAt <= Date.now()) {
        return running ? `Nomor ${number} aktif tanpa batas sewa (diberikan owner).` : `Nomor ${number} belum punya sewa aktif. Ketik *${prefix}jadibot* untuk menyewa.`;
    }
    return (
        `*Status sewa jadibot*\n\n• Nomor : ${number}\n• Bot : ${running ? running.status : 'belum terhubung (ketik .jadibot untuk kode pairing)'}\n` +
        `• Aktif sampai : ${rental.fmtDate(r.expiresAt)}\n• Sisa : ${rental.fmtLeft(r.expiresAt - Date.now())}\n\nPerpanjang: *${prefix}jadibot sewa*`
    );
}

async function pairNow(zack, jid, prefix, number, cooldownMs) {
    const jb = manager();
    const res = await jb.startPairing(number, { cooldownMs });
    if (!res.ok) {
        const msg = {
            invalid: 'Nomor tidak valid. Pakai format internasional, contoh: 628123456789.',
            exists: `Nomor ${number} sudah jadi bot (status: ${res.status}). Pakai *${prefix}jadibot stop* untuk menghentikan.`,
            cooldown: `Tunggu sekitar ${Math.max(1, Math.ceil((res.waitSec || 0) / 60))} menit sebelum minta kode lagi.`,
            full: `Kuota jadibot penuh (${res.max} nomor). Coba lagi nanti.`,
            disabled: 'Fitur jadibot sedang dinonaktifkan.',
            error: `Gagal meminta kode pairing: ${res.message}`,
        }[res.reason];
        await reply(zack, jid, msg || 'Gagal memulai jadibot.');
        return;
    }
    await reply(zack, jid, jb.pairingText(number, prefix));
    await reply(zack, jid, jb.fmtCode(res.code));
}

module.exports = {
    name: 'jadibot',
    category: 'jadibot',
    usage: 'jadibot | sewa | status | stop',
    description: 'Sewa jadibot: jadikan nomormu bot (bayar QRIS)',
    ownerOnly: false,
    mainOnly: true,
    async execute({ zack, z, jid, isGroup, args, prefix }) {
        const jb = manager();
        if (isGroup) {
            await reply(zack, jid, `Perintah *${prefix}jadibot* cuma bisa dipakai di chat pribadi ke bot ya 🙏`);
            return;
        }
        if (!jb.enabled()) {
            await reply(zack, jid, 'Fitur jadibot sedang dinonaktifkan di server ini.');
            return;
        }

        const first = (args[0] || '').toLowerCase();
        const sub = SUBS.has(first) ? first : '';
        const mainOwner = await isOwner(zack, z.sender);
        const own = await resolveNumber(zack, z.sender);
        const arg = (i) => String(args[i] || '').replace(/[^0-9]/g, '');
        const askNumber = () =>
            reply(zack, jid, `Nomormu tidak bisa dikenali otomatis. Tambahkan nomormu di akhir perintah, contoh:\n*${prefix}jadibot ${sub === 'sewa' ? 'sewa <hari> ' : sub ? sub + ' ' : ''}628xxxxxxxxxx*\n(format internasional, tanpa + atau spasi)`);

        if (sub === 'list') {
            if (!mainOwner) return reply(zack, jid, 'Daftar jadibot cuma bisa dilihat owner bot.');
            const rows = jb.list();
            const rents = rental.listRentals().filter((r) => r.state !== 'expired');
            const lines = rows.map((r, i) => {
                const rent = rents.find((x) => x.number === r.number);
                return `${i + 1}. ${r.number} — ${r.status} (${uptime(r.since)})${rent ? ` · sewa s/d ${rental.fmtDate(rent.expiresAt)}` : ' · tanpa batas'}`;
            });
            return reply(zack, jid, rows.length ? `*Jadibot aktif (${rows.length}/${jb.maxBots()})*\nPenyimpanan sewa: ${rental.storeMode() === 'mongo' ? 'MongoDB' : 'lokal'}\n\n${lines.join('\n')}` : 'Belum ada jadibot yang aktif.');
        }

        if (sub === 'give') {
            if (!mainOwner) return reply(zack, jid, 'Perintah ini khusus owner bot.');
            const num = arg(1);
            const days = parseInt(args[2], 10);
            if (!jb.NUMBER_RE.test(num) || !Number.isInteger(days) || days < 1 || days > 365) {
                return reply(zack, jid, `Format: *${prefix}jadibot give 628xxxxxxxxxx 7* (1-365 hari)`);
            }
            const r = rental.extend(num, days);
            await reply(zack, jid, `✅ Sewa ${num} ditambah ${days} hari, aktif sampai ${rental.fmtDate(r.expiresAt)}.`);
            await jb.notifyNumber(num, `🎁 Owner memberi kamu sewa jadibot ${days} hari (sampai ${rental.fmtDate(r.expiresAt)}). Ketik *${prefix}jadibot* untuk meminta kode pairing.`);
            return;
        }

        if (sub === 'stop') {
            const target = (mainOwner && arg(1)) || own || arg(1);
            if (!target) return askNumber();
            const ok = await jb.stop(target);
            return reply(
                zack,
                jid,
                ok
                    ? `✅ Jadibot untuk ${target} dihentikan dan datanya (sesi, variabel, riwayat) dihapus dari server. Sisa sewa tetap tersimpan, ketik *${prefix}jadibot* untuk memasang lagi.`
                    : `Tidak ada jadibot aktif untuk ${target}.`
            );
        }

        const numArg = arg(sub === 'sewa' ? 2 : sub ? 1 : 0);
        const number = (mainOwner && numArg) || own || numArg;
        if (!number) return askNumber();

        if (sub === 'status') return reply(zack, jid, statusText(number, prefix));

        if (sub === 'cek' || sub === 'batal') {
            if (sub === 'batal') {
                const o = await rental.cancelPending(number);
                return reply(zack, jid, o ? `Tagihan ${o.id} dibatalkan.` : 'Tidak ada tagihan yang menunggu pembayaran.');
            }
            const pending = rental.pendingFor(number);
            if (!pending) return reply(zack, jid, `Tidak ada tagihan yang menunggu pembayaran. ${statusText(number, prefix)}`);
            const result = await rental.checkOrder(pending.id, { force: true });
            if (result.state === 'paid') {
                if (!result.already) await jb.onPaid(pending, result);
                return;
            }
            const msg = {
                pending: 'Pembayaran belum terdeteksi. Kalau sudah membayar, tunggu beberapa detik lalu tekan Cek Pembayaran lagi.',
                expired: 'Tagihan kedaluwarsa. Pesan lagi dengan *' + prefix + 'jadibot sewa*.',
                canceled: 'Tagihan dibatalkan.',
                rejected: 'Pembayaran tidak cocok dengan pesanan, jadi tidak diproses. Hubungi owner.',
                error: 'Belum bisa mengecek ke penyedia pembayaran. Coba lagi sebentar.',
            }[result.state];
            return reply(zack, jid, msg || 'Status tidak diketahui.');
        }

        if (sub === 'sewa') {
            if (!rental.paidMode()) return reply(zack, jid, `Jadibot gratis di server ini, langsung ketik *${prefix}jadibot*.`);
            const days = parseInt(args[sub && SUBS.has(first) ? 1 : 0], 10);
            if (!Number.isInteger(days)) return sendPlans(zack, jid, prefix, number);
            const res = await rental.createOrder({ number, requester: jid, days, buyerName: z.pushName });
            if (!res.ok) {
                const msg = {
                    plan: `Paket ${days} hari tidak tersedia. Ketik *${prefix}jadibot sewa* untuk melihat pilihan.`,
                    not_configured: 'Pembayaran belum dikonfigurasi di server ini. Hubungi owner.',
                    slow: `Tunggu ${res.waitSec} detik sebelum membuat tagihan lagi.`,
                    gateway: `Gagal membuat tagihan: ${res.message}`,
                }[res.reason];
                return reply(zack, jid, msg || 'Gagal membuat tagihan.');
            }
            return sendInvoice(zack, jid, prefix, res.order, res.reused);
        }

        if (!rental.paidMode() || mainOwner) return pairNow(zack, jid, prefix, number, undefined);

        if (rental.isActive(number)) {
            if (jb.bots.has(number)) return reply(zack, jid, statusText(number, prefix));
            return pairNow(zack, jid, prefix, number, 60000);
        }
        if (!rental.pendingFor(number) && !jb.bots.has(number)) return sendPlans(zack, jid, prefix, number);
        const pending = rental.pendingFor(number);
        if (pending) return sendInvoice(zack, jid, prefix, pending, true);
        return reply(zack, jid, statusText(number, prefix));
    },
};
