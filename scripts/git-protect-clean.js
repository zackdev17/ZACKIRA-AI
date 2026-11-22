#!/usr/bin/env node
const { readStdin, loadKey, encryptBuffer, hardEncode, MARKER } = require('./git-protect-common');

(async () => {
  const input = await readStdin();

  // Already encrypted (e.g. re-run on a merge) -> leave as-is.
  if (input.toString('utf8').startsWith(MARKER)) {
    process.stdout.write(input);
    return;
  }

  const key = loadKey();
  if (!key) {
    // No key configured yet: pass through untouched instead of breaking the commit.
    process.stderr.write('[protect] WARNING: no key found, committing file UNENCRYPTED.\n');
    process.stdout.write(input);
    return;
  }

  const blob = encryptBuffer(input, key);
  process.stdout.write(MARKER + '\n' + hardEncode(blob) + '\n');
})();
