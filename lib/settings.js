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

const settingsPath = () => path.join(current().dbDir, 'settings.json');

function ensureDir() {
    const dir = path.dirname(settingsPath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadSettings() {
    ensureDir();
    if (!fs.existsSync(settingsPath())) {
        return { chatMode: 'private', botMode: 'all', antiCall: false, autoRead: false };
    }
    try {
        const raw = fs.readFileSync(settingsPath(), 'utf8');
        const parsed = JSON.parse(raw);
        return { chatMode: 'private', botMode: 'all', ...parsed };
    } catch (e) {
        return { chatMode: 'private', botMode: 'all', antiCall: false, autoRead: false };
    }
}

function saveSettings(settings) {
    ensureDir();
    fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

function getChatMode() {
    return loadSettings().chatMode || 'all';
}

function setChatMode(mode) {
    const settings = loadSettings();
    settings.chatMode = mode;
    saveSettings(settings);
    return settings.chatMode;
}

function getBotMode() {
    return loadSettings().botMode || 'all';
}

function setBotMode(mode) {
    const settings = loadSettings();
    settings.botMode = mode;
    saveSettings(settings);
    return settings.botMode;
}

function getFlag(name) {
    return loadSettings()[name] === true;
}

function setFlag(name, value) {
    const settings = loadSettings();
    settings[name] = !!value;
    saveSettings(settings);
    return settings[name];
}

function getList(name) {
    const v = loadSettings()[name];
    return Array.isArray(v) ? v : [];
}

function setList(name, list) {
    const settings = loadSettings();
    settings[name] = [...new Set(list)];
    saveSettings(settings);
    return settings[name];
}

module.exports = { getList, setList, getFlag, setFlag, getChatMode, setChatMode, getBotMode, setBotMode };