#!/usr/bin/env node
// Run this as part of your build/start command on the hosting side (Render, VPS, etc.)
// It reads PROTECT_KEY from the environment and decrypts any protected file that
// still has the encrypted marker (a fresh `git clone` has no local filter config,
// so files arrive encrypted — this script turns them back into runnable source).
const fs = require('fs');
const path = require('path');
const { loadKey, decryptBuffer, hardDecode, MARKER } = require('./git-protect-common');

const rc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.protectedrc.json'), 'utf8'));
const key = loadKey();

if (!key) {
  console.error('[protect] PROTECT_KEY env var not set — cannot decrypt protected files for deploy.');
  process.exit(1);
}

for (const rel of rc.files) {
  const full = path.join(process.cwd(), rel);
  if (!fs.existsSync(full)) continue;
  const content = fs.readFileSync(full, 'utf8');
  if (!content.startsWith(MARKER)) continue; // already plaintext
  const blob = hardDecode(content.slice(MARKER.length).trim());
  const plain = decryptBuffer(blob, key);
  fs.writeFileSync(full, plain);
  console.log('[protect] decrypted ' + rel);
}
