/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { assertIntact } = require('./guard.js');
const fs = require('fs');
const path = require('path');
const { isOwner } = require('./owner.js');
const { getBotMode } = require('./settings.js');
const { current, getVar } = require('./botContext.js');
const tools = require('./groupTools.js');
const premium = require('./premium.js');

const PREFIX = global.prefix || '.';
const commandsDir = path.join(__dirname, '..', 'commands');

function loadCommands() {
    const commands = new Map();
    if (!fs.existsSync(commandsDir)) return commands;
    const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));
    for (const file of files) {
        const mod = require(path.join(commandsDir, file));
        for (const cmd of Array.isArray(mod) ? mod : [mod]) {
            if (cmd && cmd.name) commands.set(cmd.name.toLowerCase(), cmd);
        }
    }
    return commands;
}

const commands = loadCommands();

function parseCommand(body) {
    const trimmed = (body || '').trim();
    const prefix = getVar('prefix');
    if (!trimmed.startsWith(prefix)) return null;
    const withoutPrefix = trimmed.slice(prefix.length);
    const [name, ...args] = withoutPrefix.split(/\s+/);
    const raw = withoutPrefix.replace(/^\S*[ \t]*/, '');
    return { name: (name || '').toLowerCase(), args, raw };
}

async function handleCommand(zack, z, body) {
    assertIntact();
    const parsed = parseCommand(body);
    if (!parsed || !parsed.name) return false;

    const cmd = commands.get(parsed.name);
    if (!cmd) return false;
    if (cmd.mainOnly && !current().isMain) return false;

    const jid = z.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');

    if (cmd.name !== 'modebot') {
        const botMode = getBotMode();
        if (botMode === 'private' && isGroup) return true;
        if (botMode === 'group' && !isGroup) return true;
    }

    if (cmd.ownerOnly) {
        const ownerOk = await isOwner(zack, z.sender);
        if (!ownerOk) {
            await zack.sendMessage(jid, { text: 'Perintah ini cuma bisa dipakai owner bot.' }, { quoted: null });
            return true;
        }
    }

    const say = (text) => zack.sendMessage(jid, { text }, { quoted: null });
    const ownerNow = cmd.adminOnly ? await isOwner(zack, z.sender) : false;

    if ((cmd.groupOnly || cmd.adminOnly || cmd.botAdmin) && !isGroup) {
        await say('Perintah ini hanya bisa dipakai di dalam grup.');
        return true;
    }

    if (cmd.premiumOnly && !(await premium.hasAccess(zack, z.sender))) {
        await say('Perintah ini khusus pengguna *premium*. Hubungi owner untuk upgrade.');
        return true;
    }

    let meta = null;
    if (isGroup && (cmd.adminOnly || cmd.botAdmin || cmd.needMeta)) {
        try {
            meta = await tools.getMeta(zack, jid);
        } catch {
            await say('Gagal membaca data grup, coba lagi sebentar.');
            return true;
        }
        if (cmd.adminOnly && !ownerNow && !tools.isAdmin(meta, z.sender)) {
            await say('Perintah ini khusus admin grup.');
            return true;
        }
        if (cmd.botAdmin && !tools.isBotAdmin(zack, meta)) {
            await say('Jadikan bot sebagai *admin grup* dulu supaya bisa menjalankan perintah ini.');
            return true;
        }
    }

    try {
        await cmd.execute({ zack, z, jid, isGroup, meta, args: parsed.args, raw: parsed.raw, prefix: getVar('prefix'), commands });
    } catch (e) {
        console.log('Command error:', e.message);
        await zack.sendMessage(jid, { text: 'Terjadi error saat menjalankan command.' }, { quoted: null });
    }
    return true;
}

module.exports = { handleCommand, PREFIX, commands };