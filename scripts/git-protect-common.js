const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const MARKER = '##PROTECTED-AES256GCM##';

function repoRoot() {
  return execSync('git rev-parse --show-toplevel').toString().trim();
}

function keyFilePath() {
  return path.join(repoRoot(), '.protect-key.local');
}

// Key priority: env var PROTECT_KEY (64 hex chars) > local key file (never committed)
function loadKey() {
  const envKey = process.env.PROTECT_KEY;
  if (envKey && /^[0-9a-f]{64}$/i.test(envKey.trim())) {
    return Buffer.from(envKey.trim(), 'hex');
  }
  try {
    const hex = fs.readFileSync(keyFilePath(), 'utf8').trim();
    if (/^[0-9a-f]{64}$/i.test(hex)) return Buffer.from(hex, 'hex');
  } catch {
    // no key file yet
  }
  return null;
}

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks)));
    if (process.stdin.isTTY) resolve(Buffer.alloc(0));
  });
}

// Deterministic IV (derived from key+content) so the same plaintext always
// produces the same ciphertext -> clean diffs instead of noise every commit.
function encryptBuffer(buf, key) {
  const iv = crypto.createHmac('sha256', key).update(buf).digest().subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

function decryptBuffer(blob, key) {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const data = blob.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

// "Hard" looking hex encoding, e.g. 0x1a2b3//c9f01d2//8e7a//...
function hardEncode(buf) {
  const hex = buf.toString('hex');
  const sizes = [5, 4, 8, 6, 7];
  let out = '0x';
  let i = 0, idx = 0;
  while (i < hex.length) {
    const size = sizes[idx % sizes.length];
    out += hex.slice(i, i + size);
    i += size;
    idx++;
    if (i < hex.length) out += '//';
  }
  return out;
}

function hardDecode(str) {
  const hex = str.trim().replace(/^0x/, '').split('//').join('');
  return Buffer.from(hex, 'hex');
}

module.exports = {
  MARKER, repoRoot, keyFilePath, loadKey, readStdin,
  encryptBuffer, decryptBuffer, hardEncode, hardDecode,
};
