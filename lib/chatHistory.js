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

const root = () => path.join(current().dbDir, 'chat_history');

function parseJid(jid) {
    const full = String(jid || '');
    const isGroup = full.endsWith('@g.us');
    const id = full.split('@')[0].split(':')[0].replace(/[^\w.\-]/g, '_') || 'unknown';
    const server = full.split('@')[1] || '';
    const safeId = server === 'lid' ? `${id}_lid` : id;
    return { isGroup, id: safeId, kind: isGroup ? 'group' : 'private' };
}

function historyFile(jid) {
    const { kind, id } = parseJid(jid);
    const dir = path.join(root(), kind);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${id}.json`);
}

function loadHistory(file, filter) {
    try {
        if (fs.existsSync(file)) {
            const list = JSON.parse(fs.readFileSync(file, 'utf-8')) || [];
            return filter ? list.filter(filter) : list;
        }
    } catch (e) {
        console.log('Load History Error:', e.message);
    }
    return [];
}

function saveHistory(file, history) {
    try {
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(history, null, 2));
        fs.renameSync(tmp, file);
    } catch (e) {
        console.log('Save History Error:', e.message);
    }
}

const KINDS = ['private', 'group'];
const SAFE_ID = /^[\w.\-]+$/;

function listHistories(kind) {
    const out = [];
    for (const k of KINDS) {
        if (kind && kind !== k) continue;
        const dir = path.join(root(), k);
        let files = [];
        try {
            files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
        } catch {
            continue;
        }
        for (const f of files) {
            const file = path.join(dir, f);
            try {
                const list = JSON.parse(fs.readFileSync(file, 'utf-8')) || [];
                out.push({ kind: k, id: f.slice(0, -5), count: Array.isArray(list) ? list.length : 0, mtime: fs.statSync(file).mtimeMs });
            } catch {
                out.push({ kind: k, id: f.slice(0, -5), count: 0, mtime: 0 });
            }
        }
    }
    return out.sort((a, b) => b.mtime - a.mtime);
}

function clearHistory(kind, id) {
    if (!KINDS.includes(kind) || !SAFE_ID.test(String(id || ''))) return false;
    const file = path.join(root(), kind, `${id}.json`);
    if (!fs.existsSync(file)) return false;
    fs.unlinkSync(file);
    return true;
}

function clearAllHistories(kind) {
    let n = 0;
    for (const h of listHistories(kind)) if (clearHistory(h.kind, h.id)) n++;
    return n;
}

module.exports = { historyFile, loadHistory, saveHistory, parseJid, listHistories, clearHistory, clearAllHistories };
