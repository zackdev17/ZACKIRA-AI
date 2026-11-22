/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const { fetchImage } = require('./linkSearch.js');

const LIMITS = {
    body: 1024,
    title: 60,
    footer: 60,
    label: 25,
    rowTitle: 24,
    rowDesc: 72,
    idLen: 200,
    maxButtons: 5,
    maxCardButtons: 2,
    maxRows: 10,
    minCards: 2,
    maxCards: 10,
    copyLen: 1000,
};

const clip = (s, n) => {
    s = String(s ?? '').trim();
    return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
};

const HTTP_RE = /^https?:\/\/\S+$/i;

function buildButton(b, index = 0) {
    if (!b || typeof b !== 'object') throw new Error(`Tombol #${index + 1} tidak valid`);
    const type = String(b.type || 'reply').toLowerCase();
    const label = clip(b.label ?? b.text ?? b.title, LIMITS.label);
    if (!label) throw new Error(`Tombol #${index + 1}: "label" wajib diisi`);
    const value = b.value ?? b.url ?? b.id ?? b.code ?? b.phone;

    switch (type) {
        case 'reply':
        case 'quick_reply':
            return {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({ display_text: label, id: clip(value || label, LIMITS.idLen) }),
            };
        case 'url':
        case 'link':
        case 'cta_url': {
            const url = String(value || '').trim();
            if (!HTTP_RE.test(url)) throw new Error(`Tombol "${label}": value harus link http/https, bukan "${url.slice(0, 40)}"`);
            return { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: label, url, merchant_url: url }) };
        }
        case 'copy':
        case 'cta_copy': {
            const code = String(value ?? '').trim();
            if (!code) throw new Error(`Tombol "${label}": value (teks yang disalin) wajib diisi`);
            return {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({ display_text: label, copy_code: code.slice(0, LIMITS.copyLen) }),
            };
        }
        case 'call':
        case 'cta_call': {
            const phone = String(value || '').replace(/[^\d+]/g, '');
            if (phone.replace(/\D/g, '').length < 5) throw new Error(`Tombol "${label}": nomor telepon tidak valid`);
            return { name: 'cta_call', buttonParamsJson: JSON.stringify({ display_text: label, phone_number: phone }) };
        }
        default:
            throw new Error(`Tombol "${label}": type "${type}" tidak dikenal (pakai reply, url, copy, atau call)`);
    }
}

function buildButtons(list, max) {
    if (!Array.isArray(list) || !list.length) throw new Error('Minimal 1 tombol');
    return list.slice(0, max).map(buildButton);
}

async function prepareImage(zack, source) {
    const buffer = Buffer.isBuffer(source) ? source : (await fetchImage(String(source))).buffer;
    return prepareWAMessageMedia({ image: buffer }, { upload: zack.waUploadToServer });
}

const bizNode = () => ({
    tag: 'biz',
    attrs: {},
    content: [
        {
            tag: 'interactive',
            attrs: { type: 'native_flow', v: '1' },
            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
        },
    ],
});

async function relayInteractive(zack, jid, interactive) {
    const content = {
        viewOnceMessage: {
            message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: proto.Message.InteractiveMessage.fromObject(interactive),
            },
        },
    };
    const msg = generateWAMessageFromContent(jid, content, { userJid: zack.user.id });
    await zack.relayMessage(jid, msg.message, { messageId: msg.key.id, additionalNodes: [bizNode()] });
    return msg.key.id;
}

async function headerOf(zack, { title, imageUrl }) {
    const header = { title: clip(title, LIMITS.title), hasMediaAttachment: false };
    if (imageUrl) {
        const media = await prepareImage(zack, imageUrl);
        Object.assign(header, media, { hasMediaAttachment: true });
    }
    return header;
}

async function sendButtons(zack, jid, { text, title, footer, imageUrl, buttons }) {
    if (!String(text || '').trim()) throw new Error('"text" wajib diisi');
    const built = buildButtons(buttons, LIMITS.maxButtons);
    const interactive = {
        header: await headerOf(zack, { title, imageUrl }),
        body: { text: clip(text, LIMITS.body) },
        nativeFlowMessage: { buttons: built },
    };
    if (footer) interactive.footer = { text: clip(footer, LIMITS.footer) };
    await relayInteractive(zack, jid, interactive);
    return { buttons: built.length };
}

async function sendList(zack, jid, { text, title, footer, imageUrl, buttonLabel, sections, rows, extraButtons }) {
    if (!String(text || '').trim()) throw new Error('"text" wajib diisi');
    const src = Array.isArray(sections) && sections.length ? sections : [{ title: 'Pilihan', rows }];

    let remaining = LIMITS.maxRows;
    const outSections = [];
    for (const sec of src) {
        if (remaining <= 0) break;
        const rs = (Array.isArray(sec?.rows) ? sec.rows : [])
            .filter((r) => r && String(r.title ?? '').trim())
            .slice(0, remaining)
            .map((r) => ({
                title: clip(r.title, LIMITS.rowTitle),
                description: clip(r.description, LIMITS.rowDesc),
                id: clip(r.id || r.value || r.title, LIMITS.idLen),
                ...(r.highlight ? { highlight_label: clip(r.highlight, 20) } : {}),
            }));
        if (!rs.length) continue;
        remaining -= rs.length;
        outSections.push({ title: clip(sec.title || 'Pilihan', LIMITS.rowTitle), rows: rs });
    }
    if (!outSections.length) throw new Error('Minimal 1 baris pilihan (rows) dengan "title"');

    const interactive = {
        header: await headerOf(zack, { title, imageUrl }),
        body: { text: clip(text, LIMITS.body) },
        nativeFlowMessage: {
            buttons: [
                {
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({ title: clip(buttonLabel || 'Pilih', LIMITS.label), sections: outSections }),
                },
                ...(Array.isArray(extraButtons) && extraButtons.length ? buildButtons(extraButtons, LIMITS.maxButtons - 1) : []),
            ],
        },
    };
    if (footer) interactive.footer = { text: clip(footer, LIMITS.footer) };
    await relayInteractive(zack, jid, interactive);
    return { rows: outSections.reduce((n, s) => n + s.rows.length, 0) };
}

async function sendCarousel(zack, jid, { text, footer, cards }) {
    if (!Array.isArray(cards) || !cards.length) throw new Error('"cards" wajib diisi');
    const input = cards.slice(0, LIMITS.maxCards);

    const settled = await Promise.all(
        input.map(async (c, i) => {
            try {
                const btns = Array.isArray(c.buttons) && c.buttons.length ? c.buttons : [];
                if (!btns.length) throw new Error('kartu tanpa tombol');
                const header = await headerOf(zack, { title: c.title, imageUrl: c.imageUrl || c.image_url });
                const card = {
                    header,
                    body: { text: clip(c.body || c.title || `Item ${i + 1}`, LIMITS.body) },
                    nativeFlowMessage: { buttons: buildButtons(btns, LIMITS.maxCardButtons) },
                };
                if (c.footer) card.footer = { text: clip(c.footer, LIMITS.footer) };
                return card;
            } catch (e) {
                console.log(`[carousel] kartu #${i + 1} dilewati: ${e.message}`);
                return null;
            }
        })
    );
    const good = settled.filter(Boolean);
    if (!good.length) throw new Error('Semua kartu gagal dibuat (gambar tidak bisa dimuat?)');

    if (good.length < LIMITS.minCards) {
        const only = good[0];
        await relayInteractive(zack, jid, {
            header: only.header,
            body: only.body,
            footer: only.footer,
            nativeFlowMessage: only.nativeFlowMessage,
        });
        return { cards: 1, skipped: input.length - 1 };
    }

    const interactive = {
        body: { text: clip(text || 'Geser untuk melihat pilihan', LIMITS.body) },
        carouselMessage: { cards: good },
    };
    if (footer) interactive.footer = { text: clip(footer, LIMITS.footer) };
    await relayInteractive(zack, jid, interactive);
    return { cards: good.length, skipped: input.length - good.length };
}

async function sendLocation(zack, jid, { latitude, longitude, name, address }) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new Error('Koordinat tidak valid (latitude -90..90, longitude -180..180)');
    }
    await zack.sendMessage(jid, {
        location: {
            degreesLatitude: lat,
            degreesLongitude: lng,
            name: name ? clip(name, 100) : undefined,
            address: address ? clip(address, 200) : undefined,
        },
    });
    return {};
}

function parseInteractiveReply(message) {
    if (!message) return '';
    const irm = message.interactiveResponseMessage;
    if (irm) {
        const nf = irm.nativeFlowResponseMessage;
        if (nf?.paramsJson) {
            try {
                const p = JSON.parse(nf.paramsJson);
                const id = p.id ?? p.selectedId ?? p.rowId ?? p.selectedRowId ?? p.singleSelectReply?.selectedRowId;
                if (id) return String(id);
                if (p.display_text || p.title) return String(p.display_text || p.title);
            } catch {}
        }
        const lr = irm.listResponseMessage?.singleSelectReply?.selectedRowId;
        if (lr) return String(lr);
        const br = irm.buttonReplyMessage?.selectedButtonId;
        if (br) return String(br);
        return irm.body?.text ? String(irm.body.text) : '';
    }
    if (message.buttonsResponseMessage) {
        return String(message.buttonsResponseMessage.selectedButtonId || message.buttonsResponseMessage.selectedDisplayText || '');
    }
    if (message.listResponseMessage) {
        return String(message.listResponseMessage.singleSelectReply?.selectedRowId || message.listResponseMessage.title || '');
    }
    if (message.templateButtonReplyMessage) {
        return String(message.templateButtonReplyMessage.selectedId || message.templateButtonReplyMessage.selectedDisplayText || '');
    }
    return '';
}

module.exports = {
    sendButtons,
    sendList,
    sendCarousel,
    sendLocation,
    parseInteractiveReply,
    buildButton,
    LIMITS,
};
