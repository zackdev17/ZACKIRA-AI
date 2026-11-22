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
const { getChatMode, getBotMode, getFlag } = require('../lib/settings.js');
const { CATEGORIES, byId, categoryOf } = require('../lib/categories.js');
const { isOwner, getOwnerNumbers } = require('../lib/owner.js');
const { current, getVar } = require('../lib/botContext.js');
const ui = require('../lib/interactive.js');
const premium = require('../lib/premium.js');

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function formatRuntime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
}

function modeLabel(mode) {
    if (mode === 'private') return '🔒 Private';
    if (mode === 'group') return '👥 Group';
    return '🌐 Public';
}

function boldFont(str) {
    return [...String(str)].map((ch) => {
        const c = ch.codePointAt(0);
        if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d400 + c - 65);
        if (c >= 97 && c <= 122) return String.fromCodePoint(0x1d41a + c - 97);
        if (c >= 48 && c <= 57) return String.fromCodePoint(0x1d7ce + c - 48);
        return ch;
    }).join('');
}

function buildBox(icon, label, lines) {
    return `┌───「 ${icon} *${label}* 」\n${lines.map((l) => `│  ${l}`).join('\n')}\n└───`;
}

function buildCaption({ pushName, statusLabel, runtime, jam, menit, detik, tanggal }) {
    const profileBox = buildBox('👤', 'USER PROFILE', [
        `• *Nama* : ${pushName}`,
        `• *Status* : ${statusLabel}`,
    ]);

    const statusBox = buildBox('🤖', 'BOT STATUS', [
        `• *Bot Name* : ${getVar('botname')}`,
        `• *Runtime* : ${runtime}`,
        `• *Version* : ${global.botVersion}`,
        `• *Mode AI* : ${getFlag('autoAiOff') ? '⛔ Mati' : modeLabel(getChatMode())}`,
        `• *Mode Bot* : ${modeLabel(getBotMode())}`,
        `• *Author* : ${getVar('author')}`,
    ]);

    const timeBox = buildBox('🕰️', 'TIME & DATE', [
        `• *Time* : ${jam}:${menit}:${detik}`,
        `• *Date* : ${tanggal}`,
    ]);

    return `${profileBox}\n\n${statusBox}\n\n${timeBox}`;
}

const visibleCommands = (commands) => [...new Set(commands.values())].filter((c) => !c.mainOnly || current().isMain);

function inCategory(commands, id) {
    return visibleCommands(commands)
        .filter((c) => categoryOf(c) === id)
        .sort((a, b) => a.name.localeCompare(b.name));
}

function tagsOf(c) {
    return [c.ownerOnly && 'owner', c.adminOnly && 'admin grup', c.premiumOnly && 'premium'].filter(Boolean);
}

function commandLines(prefix, cmds) {
    return cmds.map((c) => `│ ⌬ ${prefix}${c.usage || c.name}`);
}

function categoryBox(prefix, cat, cmds, suffix = '') {
    return `╭─◢◤ ${cat.icon} ${boldFont(cat.title.toUpperCase() + suffix)}\n${commandLines(prefix, cmds).join('\n')}\n╰───────────────────⧉`;
}

function paginate(prefix, cat, cmds) {
    const max = ui.LIMITS.body - 40;
    const pages = [];
    let cur = [];
    for (const c of cmds) {
        const next = [...cur, c];
        if (cur.length && categoryBox(prefix, cat, next, ' (99/99)').length > max) {
            pages.push(cur);
            cur = [c];
        } else cur = next;
    }
    if (cur.length) pages.push(cur);
    return pages;
}

function loadImage() {
    const imagePath = path.join(process.cwd(), 'image', 'menu.jpg');
    return fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : undefined;
}

async function sendPlain(zack, jid, text, image) {
    await zack.sendMessage(jid, image ? { image, caption: text } : { text }, { quoted: null });
}

function buildPages(prefix, commands, key) {
    const cats = key === 'all' ? CATEGORIES : [byId(key === 'group' ? 'grup' : key)].filter(Boolean);
    const out = [];
    for (const cat of cats) {
        const list = inCategory(commands, cat.id);
        if (!list.length) continue;
        const pages = paginate(prefix, cat, list);
        pages.forEach((cmds, i) => out.push({ cat, cmds, i, n: pages.length }));
    }
    return out;
}

async function sendPage(zack, jid, prefix, key, pages, index, withImage) {
    const { cat, cmds, i, n } = pages[index];
    const suffix = n > 1 ? ` (${i + 1}/${n})` : '';
    const text = categoryBox(prefix, cat, cmds, suffix);
    const image = withImage ? loadImage() : undefined;
    const buttons = [];
    if (index + 1 < pages.length) buttons.push({ type: 'reply', label: '➡️ Halaman berikutnya', id: `${prefix}menu ${key} ${index + 2}` });
    buttons.push({ type: 'reply', label: '↩️ Kembali ke Menu', id: `${prefix}menu` });
    try {
        await ui.sendButtons(zack, jid, { title: `${cat.title}${suffix}`, text, footer: `© ${getVar('author')}`, imageUrl: image, buttons });
    } catch (e) {
        console.log('Menu kategori (tombol) gagal, fallback teks:', e.message);
        const nav = index + 1 < pages.length ? `Ketik *${prefix}menu ${key} ${index + 2}* untuk halaman berikutnya.` : `Ketik *${prefix}menu* untuk kembali.`;
        await sendPlain(zack, jid, `${text}\n\n© ${getVar('author')}\n${nav}`, image);
    }
}

function linkButtons() {
    const out = [];
    const site = String(process.env.BOT_WEBSITE || (current().isMain ? 'https://zackuplay.web.id' : '')).trim();
    if (/^https?:\/\//i.test(site)) out.push({ type: 'url', label: 'Website', url: site });
    const owner = getOwnerNumbers()[0];
    if (owner) out.push({ type: 'url', label: 'Kontak Owner', url: `https://wa.me/${owner}` });
    return out;
}

async function sendMainMenu(zack, jid, z, prefix, commands) {
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const jam = String(jakartaTime.getHours()).padStart(2, '0');
    const menit = String(jakartaTime.getMinutes()).padStart(2, '0');
    const detik = String(jakartaTime.getSeconds()).padStart(2, '0');
    const tanggal = `${HARI[jakartaTime.getDay()]}, ${jakartaTime.getDate()} - ${BULAN[jakartaTime.getMonth()]} - ${jakartaTime.getFullYear()}`;

    const ownerOk = await isOwner(zack, z.sender);
    const premOk = !ownerOk && (await premium.hasAccess(zack, z.sender));
    const caption = buildCaption({
        pushName: z.pushName || 'Kak',
        statusLabel: ownerOk ? '👑 Owner' : premOk ? '💎 Premium' : '🌟 Free User',
        runtime: formatRuntime(Date.now() - current().startTime),
        jam,
        menit,
        detik,
        tanggal,
    });

    const cats = CATEGORIES.map((c) => ({ cat: c, cmds: inCategory(commands, c.id) })).filter((x) => x.cmds.length);
    const infoRows = [
        { id: `${prefix}owner`, title: '📜 Owner', description: 'Kontak pemilik atau pengembang bot' },
        { id: `${prefix}menu all`, title: '🌍 ALL MENU', description: 'Menampilkan seluruh menu perintah.' },
    ];
    const catRows = cats.map(({ cat, cmds }, i) => ({
        id: `${prefix}menu ${cat.id}`,
        title: `${cat.icon} ${cat.title.toUpperCase()}`,
        description: `${cat.desc} (${cmds.length} perintah)`,
        ...(i === 0 ? { highlight: 'Recommended' } : {}),
    }));
    const rows = [...infoRows, ...catRows];

    const text = `${caption}\n\n*Note :* Untuk menampilkan menu bot silahkan klik tombol di bawah untuk memilih menu yang ingin di tampilkan.`;
    const image = loadImage();
    try {
        await ui.sendList(zack, jid, {
            title: `${getVar('botname')} MENU`,
            text,
            footer: `© ${getVar('author')}`,
            buttonLabel: '📋 DAFTAR MENU',
            imageUrl: image,
            extraButtons: linkButtons(),
            sections: [
                { title: 'INFORMATION', rows: infoRows },
                { title: 'PILIH KATEGORI MENU', rows: catRows.slice(0, ui.LIMITS.maxRows - infoRows.length) },
            ],
        });
        console.log('Menu (list) sent successfully to', jid);
    } catch (error) {
        console.log('Menu list gagal, fallback ke menu teks:', error.message);
        const lines = rows.map((r) => `• *${r.id}* — ${r.title}`);
        await sendPlain(zack, jid, `${text}\n\n${lines.join('\n')}`, image);
    }
}

module.exports = {
    name: 'menu',
    category: 'umum',
    usage: 'menu [grup|owner|umum|jadibot|all]',
    description: 'Tampilkan menu utama bot (pilih kategori lewat tombol)',
    ownerOnly: false,
    async execute({ zack, jid, z, args, prefix, commands }) {
        const arg = (args[0] || '').toLowerCase();
        if (!arg) return sendMainMenu(zack, jid, z, prefix, commands);

        const pages = buildPages(prefix, commands, arg);
        if (!pages.length) {
            const ids = CATEGORIES.filter((c) => inCategory(commands, c.id).length).map((c) => c.id);
            return zack.sendMessage(jid, { text: `Kategori tidak ditemukan. Pilihan: ${ids.join(', ')}, all` }, { quoted: null });
        }
        const page = Math.min(Math.max(parseInt(args[1], 10) || 1, 1), pages.length);
        return sendPage(zack, jid, prefix, arg, pages, page - 1, page === 1);
    },
};
