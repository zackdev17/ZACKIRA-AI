/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const http = require('http');
const axios = require('axios');

function startKeepAlive() {
    const port = process.env.PORT;
    if (!port) return;

    http
        .createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`${global.botname || 'Bot'} aktif. Uptime: ${Math.floor(process.uptime() / 60)} menit\n`);
        })
        .listen(Number(port), '0.0.0.0', () => console.log(`[keepalive] server HTTP di port ${port}`));

    const url = process.env.KEEPALIVE_URL || process.env.RENDER_EXTERNAL_URL;
    if (url) {
        setInterval(() => {
            axios.get(url, { timeout: 15000 }).catch((e) => console.log('[keepalive] ping gagal:', e.message));
        }, 10 * 60 * 1000).unref();
        console.log(`[keepalive] ping tiap 10 menit ke ${url}`);
    }
}

module.exports = { startKeepAlive };
