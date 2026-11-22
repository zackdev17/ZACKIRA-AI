#!/usr/bin/env node
const { readStdin, loadKey, decryptBuffer, hardDecode, MARKER } = require('./git-protect-common');

(async () => {
  const input = (await readStdin()).toString('utf8');

  if (!input.startsWith(MARKER)) {
    // Not encrypted content -> pass through.
    process.stdout.write(input);
    return;
  }

  const key = loadKey();
  if (!key) {
    process.stderr.write('[protect] WARNING: no key found, cannot decrypt for working directory.\n');
    process.stdout.write(input);
    return;
  }

  try {
    const body = input.slice(MARKER.length).trim();
    const blob = hardDecode(body);
    const plain = decryptBuffer(blob, key);
    process.stdout.write(plain);
  } catch (err) {
    process.stderr.write('[protect] ERROR decrypting, wrong key? ' + err.message + '\n');
    process.stdout.write(input);
  }
})();
