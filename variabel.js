/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

require('./lib/guard.js');

try {
    const fs = require('fs');
    const envPath = require('path').join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
            if (!m || line.trim().startsWith('#')) continue;
            const val = m[2].replace(/^(['"])(.*)\1$/, '$2');
            if (process.env[m[1]] === undefined) process.env[m[1]] = val;
        }
    }
} catch (e) {
    console.log('Gagal membaca .env:', e.message);
}

const env = process.env;

global.botname = 'ZACKIRA AI';
global.des = 'AI Assistant';
global.botVersion = 'v1.1.0';
global.botAuthor = 'ZACK';

global.namaSaluran = global.botname;
global.linkSaluran = '0@newsletter';
global.linkweb = 'https://whatsapp.com';

global.ownerNumbers = (env.OWNER_NUMBERS || '6289606860329')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

global.pairingNumber = env.PAIRING_NUMBER || '';

global.prefix = env.BOT_PREFIX || '.';

global.groqApiKey = env.GROQ_API_KEY || '';

global.groqModels = [
    'openai/gpt-oss-120b',
    'qwen/qwen3.8-27b',
    'llama-3.3-70b-versatile',
    'minimaxai/minimax-m2.7',
    'openai/gpt-oss-20b',
    'llama-3.1-8b-instant',
    'openai/gpt-oss-safeguard-20b',
];

global.groqChatModels = [
    'openai/gpt-oss-20b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
];

global.groqCodeModels = [
    'llama-3.3-70b-versatile',
    'openai/gpt-oss-120b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b',
    'minimaxai/minimax-m2.7',
];

global.groqVisionModels = ['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b'];

global.maxMediaMinutes = Number(env.MAX_MEDIA_MINUTES) || 15;
global.maxMediaMB = Number(env.MAX_MEDIA_MB) || 45;
global.ytCookiesPath = env.YTDLP_COOKIES || '';

module.exports = {};
