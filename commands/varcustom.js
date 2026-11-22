/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { current, getVar, setVar, resetVar, maskKey, KEYS, LIMITS } = require('../lib/botContext.js');

const reply = (zack, jid, text) => zack.sendMessage(jid, { text }, { quoted: null });

const KEY_RE = new RegExp(`^\\s*(${KEYS.join('|')})\\s*(?:=|:|\\s)\\s*(.*)$`, 'i');

function parsePairs(raw) {
    const pairs = [];
    const bad = [];
    for (const line of String(raw || '').split(/\r?\n/)) {
        if (!line.trim()) continue;
        const m = line.match(KEY_RE);
        if (m) pairs.push([m[1].toLowerCase(), m[2]]);
        else if (pairs.length) pairs[pairs.length - 1][1] += `\n${line}`;
        else bad.push(line.trim().slice(0, 30));
    }
    return { pairs, bad };
}

function show(value, key) {
    if (!value) return '_(kosong)_';
    if (key === 'groqkey') return `\`${maskKey(value)}\``;
    return key === 'persona' ? `\n${value}` : `*${value}*`;
}

function usage(prefix) {
    return (
        `*Variabel yang bisa diubah*\n` +
        `• botname — nama bot (maks ${LIMITS.botname} huruf)\n` +
        `• prefix — awalan command (maks ${LIMITS.prefix} karakter)\n` +
        `• author — nama yang tampil di menu\n` +
        `• owner — nomor owner tambahan, pisah koma\n` +
        `• groqkey — API key Groq milikmu (gsk_...)\n` +
        `• persona — gaya bicara AI (maks ${LIMITS.persona} huruf)\n\n` +
        `*Cara pakai*\n` +
        `${prefix}varcustom botname=Nama Botku\n` +
        `${prefix}varcustom persona=Bicara santai dan lucu\n` +
        `Beberapa sekaligus: satu variabel per baris.\n` +
        `${prefix}varcustom reset — kembalikan semua\n` +
        `${prefix}varcustom reset botname — kembalikan satu`
    );
}

module.exports = {
    name: 'varcustom',
    category: 'owner',
    usage: 'varcustom key=isi',
    description: 'Atur variabel bot sendiri (nama, prefix, persona, dll)',
    ownerOnly: true,
    async execute({ zack, jid, isGroup, args, raw, prefix }) {
        if (isGroup) {
            await reply(zack, jid, 'Atur variabel lewat chat pribadi saja ya, supaya data rahasia (seperti API key) tidak terlihat orang lain.');
            return;
        }
        const ctx = current();
        const text = String(raw || '').trim();

        if (!text) {
            const lines = KEYS.map((k) => {
                const custom = ctx.vars && ctx.vars[k];
                return `• ${k}: ${show(getVar(k, ctx), k)}${custom ? ' ✏️' : ''}`;
            });
            await reply(zack, jid, `*Variabel bot ${ctx.isMain ? '(utama)' : ctx.number}*\n\n${lines.join('\n')}\n\n✏️ = sudah kamu ubah\n\n${usage(prefix)}`);
            return;
        }

        if ((args[0] || '').toLowerCase() === 'reset') {
            const key = (args[1] || '').toLowerCase();
            if (key && !KEYS.includes(key)) {
                await reply(zack, jid, `Variabel "${key}" tidak dikenal. Pilihan: ${KEYS.join(', ')}.`);
                return;
            }
            resetVar(key || null, ctx);
            await reply(zack, jid, key ? `✅ ${key} dikembalikan ke bawaan.` : '✅ Semua variabel dikembalikan ke bawaan.');
            return;
        }

        const { pairs, bad } = parsePairs(text);
        if (!pairs.length) {
            await reply(zack, jid, `Format tidak dikenali.\n\n${usage(prefix)}`);
            return;
        }

        const done = [];
        const failed = bad.map((b) => `"${b}": bukan variabel`);
        let keyChanged = false;
        for (const [key, value] of pairs) {
            const r = setVar(key, value, ctx);
            if (r.ok) {
                done.push(`✅ ${key} → ${show(r.value, key)}`);
                if (key === 'groqkey') keyChanged = true;
            } else {
                failed.push(`❌ ${key}: ${r.error}`);
            }
        }

        const out = [...done, ...failed];
        if (keyChanged) out.push('\n⚠️ Hapus pesan yang berisi API key tadi dari chat ini supaya tidak terbaca orang lain.');
        if (done.some((d) => d.startsWith('✅ prefix'))) out.push(`\nPrefix baru: *${getVar('prefix', ctx)}* (contoh: ${getVar('prefix', ctx)}menu)`);
        await reply(zack, jid, out.join('\n'));
    },
};
