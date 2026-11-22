/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const {
    downloadMediaMessage,
    normalizeMessageContent,
    getContentType,
    generateMessageIDV2,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const chalk = require('chalk');

const { ZackAi } = require('../plugins/zackAi.js');
const { handleCommand } = require('./commandHandler.js');
const { parseInteractiveReply } = require('./interactive.js');
const { getChatMode, getFlag } = require('./settings.js');
const { handleCalls } = require('./callGuard.js');
const { humanRead } = require('./autoRead.js');
const { runWithBot, getVar } = require('./botContext.js');
const { guard } = require('./groupGuard.js');
const groupSettings = require('./groupSettings.js');
const groupTools = require('./groupTools.js');
const { getList } = require('./settings.js');
const { resolveNumber, isOwner } = require('./owner.js');

const silent = pino({ level: 'silent' });
const SENT_MAX = 500;
const JADIBOT_RE = /jadibot/i;

function skipAi(body) {
    return JADIBOT_RE.test(String(body || ''));
}

const botSent = new Set();

function isBotMessage(id) {
    return !!id && botSent.has(id);
}

function trackSent(zack) {
    const sent = new Set();
    const remember = (id) => {
        if (!id) return;
        sent.add(id);
        botSent.add(id);
        if (sent.size > SENT_MAX) sent.delete(sent.values().next().value);
        if (botSent.size > SENT_MAX * 4) botSent.delete(botSent.values().next().value);
    };
    const send = zack.sendMessage.bind(zack);
    const relay = zack.relayMessage.bind(zack);
    zack.sendMessage = (jid, content, options = {}) => {
        const messageId = options.messageId || generateMessageIDV2(zack.user?.id);
        remember(messageId);
        return send(jid, content, { ...options, messageId });
    };
    zack.relayMessage = async (jid, message, opts = {}) => {
        remember(opts.messageId);
        const id = await relay(jid, message, opts);
        remember(typeof id === 'string' ? id : opts.messageId);
        return id;
    };
    zack.sentIds = sent;
    return sent;
}

function digits(jid) {
    return String(jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function extractBody(z) {
    const msgType = getContentType(z.message);
    const m = z.message;
    return msgType === 'conversation'
        ? m.conversation
        : msgType === 'extendedTextMessage'
          ? m.extendedTextMessage.text
          : msgType === 'imageMessage'
            ? m.imageMessage.caption || ''
            : msgType === 'videoMessage'
              ? m.videoMessage.caption || ''
              : ['interactiveResponseMessage', 'buttonsResponseMessage', 'listResponseMessage', 'templateButtonReplyMessage'].includes(msgType)
                ? parseInteractiveReply(m)
                : '';
}

function fromMeAllowed(zack, ctx, z, body) {
    if (ctx.isMain) return false;
    if (zack.sentIds && zack.sentIds.has(z.key.id)) return false;
    const chat = digits(z.key.remoteJid);
    const selfChat = chat === ctx.number || (zack.user?.lid && chat === digits(zack.user.lid));
    if (selfChat) return true;
    return typeof body === 'string' && body.trim().startsWith(getVar('prefix'));
}

async function processMessage(zack, ctx, z) {
    if (!z.message) return;
    if (z.key.remoteJid === 'status@broadcast') return;

    const raw = z.message;
    z.message = normalizeMessageContent(z.message) || z.message;
    const msgType = getContentType(z.message);
    const quotedCtx = z.message.extendedTextMessage?.contextInfo;
    const quotedImage = quotedCtx?.quotedMessage ? normalizeMessageContent(quotedCtx.quotedMessage)?.imageMessage : null;
    const ownImage = msgType === 'imageMessage' ? z.message.imageMessage : null;

    let body = extractBody(z);
    if (ownImage && !(body || '').trim()) body = 'Jelaskan gambar ini.';

    const fromMe = !!z.key.fromMe;
    if (fromMe && !fromMeAllowed(zack, ctx, z, body)) return;

    if (!ctx.isMain) {
        if (isBotMessage(z.key.id)) return;
        if (fromMe && (await require('./jadibot.js').isBotPeer(zack, z.key.remoteJid))) return;
    }

    if (!fromMe) {
        const sender = z.key.participant || z.key.remoteJid;
        const banned = getList('banned');
        if (banned.length) {
            const num = await resolveNumber(zack, sender);
            if (num && banned.includes(num) && !(await isOwner(zack, sender))) return;
        }
        if (z.key.remoteJid.endsWith('@g.us') && (await guard(zack, z, raw, body))) return;
        await humanRead(zack, z, body);
    }

    if (!body || !body.trim()) return;

    const jid = z.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');
    z.sender = fromMe ? `${ctx.number}@s.whatsapp.net` : z.key.participant || z.key.remoteJid;
    const pushname = z.pushName || 'Kak';
    const tag = ctx.isMain ? '' : `[${ctx.id}] `;

    console.log(chalk.blue(`[MSG] ${tag}${pushname} (${z.sender}): ${body}`));

    try {
        const handled = await handleCommand(zack, z, body);
        if (handled) return;
    } catch (e) {
        console.log(chalk.red('Error saat memproses command:'), e.message);
        return;
    }

    if (skipAi(body)) return;
    if (getFlag('autoAiOff')) return;

    const chatMode = getChatMode();
    if (chatMode === 'private' && isGroup) return;
    if (chatMode === 'group' && !isGroup) return;

    let getImage = null;
    if (ownImage) {
        getImage = () => downloadMediaMessage(z, 'buffer', {}, { logger: silent, reuploadRequest: zack.updateMediaMessage });
    } else if (quotedImage) {
        const quotedMsg = {
            key: { remoteJid: jid, id: quotedCtx.stanzaId, participant: quotedCtx.participant, fromMe: false },
            message: { imageMessage: quotedImage },
        };
        getImage = () => downloadMediaMessage(quotedMsg, 'buffer', {}, { logger: silent, reuploadRequest: zack.updateMediaMessage });
    }
    const safeGetImage = getImage
        ? async () => {
              try {
                  return await getImage();
              } catch (e) {
                  console.log(chalk.red('Gagal mengunduh gambar:'), e.message);
                  return null;
              }
          }
        : null;

    try {
        await zack.sendPresenceUpdate('composing', jid);
        await ZackAi(z.pushName || '', body, z, zack, {
            getImage: safeGetImage,
            imageMime: (ownImage || quotedImage)?.mimetype || 'image/jpeg',
        });
    } catch (e) {
        console.log(chalk.red('Error saat memproses pesan:'), e.message);
    }
}

async function handleParticipants(zack, update) {
    const s = groupSettings.get(update.id);
    const action = update.action;
    if (!((action === 'add' && s.welcome) || (action === 'remove' && s.goodbye))) return;
    let subject = 'grup ini';
    try {
        subject = (await groupTools.getMeta(zack, update.id, true)).subject || subject;
    } catch (e) {
        subject = 'grup ini';
    }
    const ids = (update.participants || []).map((p) => (typeof p === 'string' ? p : p.id || p.phoneNumber)).filter(Boolean);
    if (!ids.length) return;
    const tags = ids.map(groupTools.mentionTag).join(', ');
    const text = action === 'add' ? `👋 Selamat datang ${tags} di *${subject}*!\nSemoga betah ya.` : `👋 ${tags} telah keluar dari *${subject}*. Sampai jumpa!`;
    await zack.sendMessage(update.id, { text, mentions: ids }, { quoted: null });
}

function attachHandlers(zack, ctx) {
    trackSent(zack);

    zack.ev.on('group-participants.update', (update) => {
        runWithBot(ctx, () => handleParticipants(zack, update)).catch((e) => console.log('[GROUP] welcome error:', e.message));
    });

    zack.ev.on('call', (calls) => {
        runWithBot(ctx, () => handleCalls(zack, calls)).catch((e) => console.log('[CALL] error:', e.message));
    });

    zack.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify') return;
        runWithBot(ctx, async () => {
            for (const z of messages) {
                try {
                    await processMessage(zack, ctx, z);
                } catch (e) {
                    console.log(chalk.red('Error handler pesan:'), e.message);
                }
            }
        });
    });
}

module.exports = { isBotMessage, skipAi, attachHandlers, processMessage, trackSent, fromMeAllowed };
