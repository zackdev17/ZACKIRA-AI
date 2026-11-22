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
const { current } = require('./botContext.js');

const DEFAULTS = { antilink: 'off', antiswgroup: 'off', antipromosi: 'off', welcome: false, goodbye: false };
const MODES = { antilink: ['off', 'on', 'all', 'kick'], antiswgroup: ['off', 'on', 'kick'], antipromosi: ['off', 'on', 'kick'] };

const caches = new Map();
const fileOf = () => path.join(current().dbDir, 'groups.json');

function load() {
    const file = fileOf();
    if (caches.has(file)) return caches.get(file);
    let data;
    try {
        data = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    } catch {
        data = {};
    }
    caches.set(file, data);
    return data;
}

function save() {
    const file = fileOf();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(load(), null, 2));
    fs.renameSync(tmp, file);
}

const get = (jid) => ({ ...DEFAULTS, ...(load()[jid] || {}) });

function set(jid, patch) {
    const all = load();
    all[jid] = { ...(all[jid] || {}), ...patch };
    save();
    return get(jid);
}

const anyGuard = (s) => s.antilink !== 'off' || s.antiswgroup !== 'off' || s.antipromosi !== 'off';

module.exports = { DEFAULTS, MODES, get, set, anyGuard };
