/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { createCanvas } = require('@napi-rs/canvas');
const { ensureFonts } = require('./statusCard.js');

const TZ = 'Asia/Jakarta';
const SCALE = 2;
const MONO = 'ZkMono';
const mono = (size, weight = 500) => `${weight} ${size}px ${MONO}, ZkFallback, "Courier New", monospace`;

function wibParts(input) {
    const d = input === undefined ? new Date() : new Date(input);
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(Number.isNaN(d.getTime()) ? new Date() : d);
    const get = (t) => parts.find((p) => p.type === t)?.value ?? '00';
    return [`${get('year')}-${get('month')}-${get('day')}`, `${get('hour')}:${get('minute')}`];
}

function renderReceipt(data) {
    ensureFonts();
    const W = 560;
    const PADDING = 28;
    const LINE_H = 30;
    const SMALL_H = 24;
    const FONT_BODY = mono(18, 500);
    const FONT_BOLD = mono(18, 700);
    const FONT_SMALL = mono(15, 500);
    const FONT_TITLE = mono(28, 700);
    const FONT_GRAND = mono(24, 700);

    const storeName = data.storeName || 'ZACK STORE';
    const storeAddress = data.storeAddress || 'There is no physical shop';
    const storeCity = data.storeCity || 'Aethelgard';
    const storePhone = data.storePhone || '089606860329';
    const cashier = data.cashier || 'Zackira Bot';
    const paymentMethod = data.paymentMethod || 'Transfer';
    const discount = data.discount || 0;
    const amountPaid = data.amountPaid || data.grandTotal;
    const [dateStr, timeStr] = wibParts(data.date);

    const headerLines = 7 + (storeAddress ? 1 : 0) + (storePhone ? 1 : 0);
    const itemsLines = data.items.length * 3;
    const footerLines = 10;
    const estimatedH = 60 + headerLines * LINE_H + 20 + itemsLines * LINE_H + 20 + footerLines * LINE_H + 60;

    const canvas = createCanvas(W * SCALE, estimatedH * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, estimatedH);

    const dashedLine = (y) => {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PADDING, y);
        ctx.lineTo(W - PADDING, y);
        ctx.stroke();
        ctx.restore();
    };
    const solidLine = (y) => {
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(PADDING, y);
        ctx.lineTo(W - PADDING, y);
        ctx.stroke();
        ctx.restore();
    };
    const text = (value, x, y, font, align) => {
        ctx.font = font;
        ctx.fillStyle = '#000000';
        ctx.textAlign = align;
        ctx.textBaseline = 'top';
        ctx.fillText(value, x, y);
    };
    const left = (v, x, y, f) => text(v, x, y, f, 'left');
    const right = (v, x, y, f) => text(v, x, y, f, 'right');
    const center = (v, y, f) => text(v, W / 2, y, f, 'center');
    const rupiah = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;
    const truncate = (s, max) => (s.length > max ? `${s.substring(0, max - 1)}…` : s);

    let y = 30;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    const iconSize = 44;
    const iconX = W / 2 - iconSize / 2;
    ctx.strokeRect(iconX, y, iconSize, iconSize);
    ctx.beginPath();
    ctx.moveTo(iconX - 4, y + 16);
    ctx.lineTo(W / 2, y - 2);
    ctx.lineTo(iconX + iconSize + 4, y + 16);
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.fillRect(W / 2 - 7, y + 22, 14, 22);
    y += iconSize + 14;

    center(storeName, y, FONT_TITLE);
    y += 36;
    if (storeAddress) {
        center(storeAddress, y, FONT_SMALL);
        y += SMALL_H;
    }
    center(storeCity, y, FONT_SMALL);
    y += SMALL_H;
    if (storePhone) {
        center(`No. Telp ${storePhone}`, y, FONT_SMALL);
        y += SMALL_H;
    }

    y += 8;
    dashedLine(y);
    y += 14;

    left(dateStr, PADDING, y, FONT_BODY);
    right(cashier, W - PADDING, y, FONT_BODY);
    y += LINE_H;
    left(timeStr, PADDING, y, FONT_BODY);
    right(truncate(data.buyerName, 26), W - PADDING, y, FONT_BODY);
    y += LINE_H;
    left(`No.${data.orderId}`, PADDING, y, FONT_BODY);
    y += LINE_H;

    y += 4;
    dashedLine(y);
    y += 14;

    data.items.forEach((item, i) => {
        left(`${i + 1}. ${truncate(item.name, 32)}`, PADDING, y, FONT_BOLD);
        y += LINE_H;
        const qty = item.qty || 1;
        const price = item.price || item.total;
        left(`   ${qty} ${item.unit || 'pcs'} x ${Number(price).toLocaleString('id-ID')}`, PADDING, y, FONT_BODY);
        right(rupiah(item.total), W - PADDING, y, FONT_BODY);
        y += LINE_H;
    });

    y += 4;
    dashedLine(y);
    y += 14;

    left(`Total QTY : ${data.totalItems}`, PADDING, y, FONT_BODY);
    y += LINE_H + 4;
    left('Sub Total', PADDING, y, FONT_BODY);
    right(rupiah(data.subtotal), W - PADDING, y, FONT_BODY);
    y += LINE_H;

    if (discount > 0) {
        left('Diskon', PADDING, y, FONT_BODY);
        right(`- ${rupiah(discount)}`, W - PADDING, y, FONT_BODY);
        y += LINE_H;
    }

    solidLine(y);
    y += 10;
    left('Total', PADDING, y, FONT_GRAND);
    right(rupiah(data.grandTotal), W - PADDING, y, FONT_GRAND);
    y += LINE_H + 8;

    left(`Bayar (${paymentMethod})`, PADDING, y, FONT_BODY);
    right(rupiah(amountPaid), W - PADDING, y, FONT_BODY);
    y += LINE_H;
    const change = amountPaid - data.grandTotal;
    left('Kembali', PADDING, y, FONT_BODY);
    right(rupiah(change >= 0 ? change : 0), W - PADDING, y, FONT_BODY);
    y += LINE_H + 8;

    dashedLine(y);
    y += 14;
    center('Terimakasih Telah Berbelanja', y, FONT_BODY);
    y += LINE_H;
    center('Simpan struk ini sebagai bukti pembayaran', y, FONT_SMALL);
    y += SMALL_H + 30;

    const final = createCanvas(W * SCALE, Math.ceil(y * SCALE));
    final.getContext('2d').drawImage(canvas, 0, 0);
    return final.toBuffer('image/png');
}

function renderJadibotReceipt(order, { buyerName, storeName, phone } = {}) {
    const items = [{ name: `Sewa Jadibot ${order.days} hari`, qty: 1, unit: 'paket', price: order.amount, total: order.amount }];
    if (order.fee > 0) items.push({ name: 'Biaya layanan', qty: 1, unit: 'pcs', price: order.fee, total: order.fee });
    return renderReceipt({
        buyerName: buyerName || order.buyerName || order.number,
        orderId: order.id,
        items,
        totalItems: items.length,
        subtotal: order.amount + (order.fee || 0),
        grandTotal: order.total,
        amountPaid: order.total,
        storeName: storeName || 'ZACKIRA AI',
        storeAddress: 'Layanan sewa jadibot WhatsApp',
        storeCity: `Nomor ${order.number}`,
        storePhone: phone || undefined,
        cashier: 'Zackira Bot',
        paymentMethod: 'QRIS',
        date: order.paidAt || Date.now(),
    });
}

module.exports = { renderReceipt, renderJadibotReceipt };
