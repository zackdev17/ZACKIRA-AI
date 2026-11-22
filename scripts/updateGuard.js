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

const root = path.join(__dirname, '..');
const guardFile = path.join(root, 'lib', 'guard.js');
const source = fs.readFileSync(guardFile, 'utf8');
const name = (source.match(/const GUARD_FILE = '([^']+)'/) || [])[1];
if (!name) throw new Error('GUARD_FILE tidak ditemukan di lib/guard.js');

const raw = fs.readFileSync(path.join(root, name), 'utf8');
const hash = crypto.createHash('sha256').update(raw.replace(/\r\n/g, '\n').trimEnd()).digest('hex');

const updated = source.replace(/const GUARD_SHA256 = '[0-9a-f]*';/, `const GUARD_SHA256 = '${hash}';`);
if (updated === source && !source.includes(hash)) throw new Error('GUARD_SHA256 tidak ditemukan di lib/guard.js');
fs.writeFileSync(guardFile, updated);
console.log(`Hash ${name} diperbarui:\n${hash}`);
