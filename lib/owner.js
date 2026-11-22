/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { current, getVar } = require('./botContext.js');

function getOwnerNumbers() {
    const ctx = current();
    const base = [...(ctx.isMain ? global.ownerNumbers || [] : [ctx.number]), ...getVar('owner', ctx).split(',')];
    return base
        .map((n) => String(n).replace(/[^0-9]/g, ''))
        .filter(Boolean);
}

async function resolveNumber(zack, jid) {
    if (!jid) return '';
    let numberJid = jid;
    if (jid.endsWith('@lid')) {
        try {
            const pn = await zack.signalRepository.lidMapping.getPNForLID(jid);
            if (pn) numberJid = pn;
        } catch (e) {
            numberJid = jid;
        }
    }
    if (numberJid.endsWith('@lid')) return '';
    return numberJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

async function isOwner(zack, jid) {
    const number = await resolveNumber(zack, jid);
    return !!number && getOwnerNumbers().includes(number);
}

module.exports = { isOwner, getOwnerNumbers, resolveNumber };