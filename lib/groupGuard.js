/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const settings = require('./groupSettings.js');
const tools = require('./groupTools.js');
const { isOwner } = require('./owner.js');

const WA_LINK = /(chat\.whatsapp\.com\/[A-Za-z0-9]{8,}|whatsapp\.com\/channel\/[A-Za-z0-9]+)/i;
const ANY_LINK = /(https?:\/\/|www\.)\S+/i;
const SOCIAL = /(t\.me\/|discord\.gg\/|bit\.ly\/|wa\.me\/|instagram\.com\/|tiktok\.com\/|youtube\.com\/|youtu\.be\/|linktr\.ee\/)/i;
const STRONG = [
    /\bopen\s*(order|po|slot|jasa|reseller)\b/i,
    /\bslot\s*gacor\b/i,
    /\b(togel|judi|casino|pinjol|sbobet|gacor)\b/i,
    /\bsewa\s*bot\b/i,
    /\bjual\s+(beli\s+)?(akun|followers|pulsa|script|sc|panel|apk)\b/i,
    /\bjasa\s+(joki|followers|topup|top\s*up|desain|bot)\b/i,
    /\bready\s*(stock|stok)\b/i,
    /\border\s+(sekarang|disini|di\s*sini|via)\b/i,
    /\b(pm|chat|dm)\s+(aja|saja|admin|owner)\s+(yuk|ya|kak|untuk)\b/i,
];
const WEAK = /\b(promo|diskon|murah|testi(moni)?|join|follow|subscribe|gratis|bonus|untung|harga|cuan|bergabung|channel)\b/gi;

function isPromo(text) {
    const t = String(text || '');
    if (!t.trim()) return false;
    if (STRONG.some((re) => re.test(t))) return true;
    const weak = (t.match(WEAK) || []).length;
    if (SOCIAL.test(t) && weak >= 1) return true;
    return weak >= 3;
}

function hasLink(text, mode) {
    const t = String(text || '');
    if (WA_LINK.test(t)) return true;
    return mode === 'all' && ANY_LINK.test(t);
}

const hasStatusMention = (raw) => !!(raw && (raw.groupStatusMentionMessage || raw.groupStatusMessage));

function detect(s, raw, body) {
    if (s.antiswgroup !== 'off' && hasStatusMention(raw)) return { rule: 'antiswgroup', mode: s.antiswgroup, reason: 'menandai grup di status (swgroup)' };
    if (s.antilink !== 'off' && hasLink(body, s.antilink)) return { rule: 'antilink', mode: s.antilink, reason: 'mengirim link' };
    if (s.antipromosi !== 'off' && isPromo(body)) return { rule: 'antipromosi', mode: s.antipromosi, reason: 'mengirim promosi' };
    return null;
}

async function guard(zack, z, raw, body) {
    const jid = z.key.remoteJid;
    if (!jid || !jid.endsWith('@g.us') || z.key.fromMe) return false;
    const s = settings.get(jid);
    if (!settings.anyGuard(s)) return false;
    const hit = detect(s, raw, body);
    if (!hit) return false;

    const sender = z.key.participant || z.sender;
    let meta;
    try {
        meta = await tools.getMeta(zack, jid);
    } catch {
        return false;
    }
    if (!tools.isBotAdmin(zack, meta)) return false;
    if (tools.isAdmin(meta, sender)) return false;
    if (await isOwner(zack, sender)) return false;

    try {
        await zack.sendMessage(jid, { delete: z.key });
    } catch (e) {
        console.log('[GUARD] gagal hapus pesan:', e.message);
    }
    const kick = hit.mode === 'kick';
    const text = kick
        ? `🚫 ${tools.mentionTag(sender)} dikeluarkan karena ${hit.reason}.`
        : `⚠️ ${tools.mentionTag(sender)} pesanmu dihapus karena ${hit.reason}. Fitur ${hit.rule} aktif di grup ini.`;
    await zack.sendMessage(jid, { text, mentions: [sender] }, { quoted: null }).catch(() => {});
    if (kick) {
        try {
            await zack.groupParticipantsUpdate(jid, tools.resolveForGroup(meta, [sender]), 'remove');
            tools.dropMeta(zack, jid);
        } catch (e) {
            console.log('[GUARD] gagal kick:', e.message);
        }
    }
    return true;
}

module.exports = { guard, detect, isPromo, hasLink, hasStatusMention };
