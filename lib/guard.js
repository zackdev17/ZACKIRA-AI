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
const crypto = require('crypto');

const GUARD_FILE = 'DONT_DELETE.ts';
const GUARD_SHA256 = '8410f334b1c524846b14e1d11c2d8487d04e4cae650eb095711ddf2ffb2c2844';
const CHECK_EVERY_MS = 15000;

const guardPath = path.join(__dirname, '..', GUARD_FILE);

function problem() {
    let raw;
    try {
        raw = fs.readFileSync(guardPath, 'utf8');
    } catch {
        return `File "${GUARD_FILE}" tidak ditemukan.`;
    }
    const digest = crypto.createHash('sha256').update(raw.replace(/\r\n/g, '\n').trimEnd()).digest('hex');
    if (digest !== GUARD_SHA256) return `Isi file "${GUARD_FILE}" telah diubah.`;
    return null;
}

function fatal(reason) {
    const line = '='.repeat(60);
    console.error(`\n${line}\nBOT DIHENTIKAN: ${reason}\nFile "${GUARD_FILE}" wajib ada dan tidak boleh diubah.\nKembalikan file aslinya, lalu jalankan ulang bot.\n${line}\n`);
    process.exit(1);
}

function assertIntact() {
    const reason = problem();
    if (reason) fatal(reason);
}

assertIntact();
setInterval(assertIntact, CHECK_EVERY_MS).unref();

module.exports = { assertIntact, GUARD_FILE };
