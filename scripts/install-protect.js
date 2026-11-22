#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = execSync('git rev-parse --show-toplevel').toString().trim();
const keyPath = path.join(root, '.protect-key.local');
const rcPath = path.join(__dirname, '..', '.protectedrc.json');

if (!fs.existsSync(rcPath)) {
  console.error('.protectedrc.json tidak ditemukan di sebelah folder scripts/.');
  process.exit(1);
}
const { files } = JSON.parse(fs.readFileSync(rcPath, 'utf8'));

// 1) Key: generate once, never commit it.
if (!fs.existsSync(keyPath)) {
  fs.writeFileSync(keyPath, crypto.randomBytes(32).toString('hex'));
  console.log('Key baru dibuat: ' + keyPath);
  console.log('SIMPAN file ini di tempat aman (password manager / secret store).');
  console.log('Tanpa file ini, file yang sudah dienkripsi TIDAK BISA dibalikin lagi.');
} else {
  console.log('Key sudah ada, dipakai ulang: ' + keyPath);
}

// 2) .gitignore the key.
const giPath = path.join(root, '.gitignore');
let gi = fs.existsSync(giPath) ? fs.readFileSync(giPath, 'utf8') : '';
if (!gi.includes('.protect-key.local')) {
  fs.appendFileSync(giPath, '\n.protect-key.local\n');
  console.log('.protect-key.local ditambahkan ke .gitignore.');
}

// 3) .gitattributes: route protected files through the "protect" filter.
const gaPath = path.join(root, '.gitattributes');
let ga = fs.existsSync(gaPath) ? fs.readFileSync(gaPath, 'utf8') : '';
for (const f of files) {
  const line = `${f} filter=protect -diff -text`;
  if (!ga.includes(line)) ga += line + '\n';
}
fs.writeFileSync(gaPath, ga);
console.log('.gitattributes diperbarui untuk ' + files.length + ' file.');

// 4) Register the filter in local git config (this is per-clone, see README caveat).
const cleanCmd = 'node scripts/git-protect-clean.js';
const smudgeCmd = 'node scripts/git-protect-smudge.js';
execSync(`git config filter.protect.clean "${cleanCmd}"`, { cwd: root });
execSync(`git config filter.protect.smudge "${smudgeCmd}"`, { cwd: root });
execSync(`git config filter.protect.required true`, { cwd: root });
console.log('Git filter "protect" terpasang.');

console.log('\nTerakhir, jalankan:');
console.log('  git add --renormalize .');
console.log('  git commit -m "enable file protection"');
console.log('Setelah itu setiap commit/push, file di .protectedrc.json otomatis terenkripsi di GitHub,');
console.log('tapi tetap normal terbaca di working directory kamu selama .protect-key.local ada.');
