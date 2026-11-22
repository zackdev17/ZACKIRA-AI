/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const dns = require('dns').promises;
const net = require('net');

function isPrivateIp(ip) {
    if (!ip) return true;
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 100 && b >= 64 && b <= 127) ||
            a >= 224
        );
    }
    if (net.isIPv6(ip)) {
        const v = ip.toLowerCase();
        if (v === '::1' || v === '::') return true;
        if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
        const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) return isPrivateIp(mapped[1]);
        return false;
    }
    return true;
}

function isPrivateHostLiteral(hostname) {
    const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
    return net.isIP(h) ? isPrivateIp(h) : false;
}

async function assertPublicUrl(raw) {
    let u;
    try {
        u = new URL(String(raw).trim());
    } catch {
        throw new Error('URL tidak valid');
    }
    if (!/^https?:$/.test(u.protocol)) throw new Error('Hanya link http/https yang diizinkan');
    if (isPrivateHostLiteral(u.hostname)) throw new Error('Alamat internal tidak diizinkan');
    if (!net.isIP(u.hostname)) {
        let addrs;
        try {
            addrs = await dns.lookup(u.hostname, { all: true });
        } catch {
            throw new Error(`Domain ${u.hostname} tidak ditemukan`);
        }
        if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('Alamat internal tidak diizinkan');
    }
    return u;
}

function guardRedirect(options) {
    if (isPrivateHostLiteral(options.hostname)) throw new Error('Redirect ke alamat internal diblokir');
}

module.exports = { assertPublicUrl, guardRedirect, isPrivateIp, isPrivateHostLiteral };
