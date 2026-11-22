/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

require('./lib/guard.js');
require('./variabel.js');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const readline = require('readline');
const chalk = require('chalk');

const { attachHandlers } = require('./lib/botCore.js');
const { mainCtx } = require('./lib/botContext.js');
const jadibot = require('./lib/jadibot.js');
const rental = require('./lib/rental.js');
const { useMongoAuthState, getCollection } = require('./lib/mongoAuth.js');
const { startKeepAlive } = require('./lib/keepAlive.js');
const { cloudflareConfigured } = require('./lib/cfImage.js');
const { cfChatConfigured } = require('./lib/cfChat.js');

global.startTime = Date.now();
startKeepAlive();
if (cfChatConfigured()) console.log(chalk.green('Cadangan chat (Cloudflare): AKTIF, dipakai kalau semua model Groq kena limit'));
console.log(
    cloudflareConfigured()
        ? chalk.green('Gambar AI (Cloudflare): AKTIF, generate_image dipakai untuk gambar realistis')
        : chalk.yellow('Gambar AI (Cloudflare): NONAKTIF (isi CF_ACCOUNT_ID dan CF_API_TOKEN di .env), gambar memakai draw_image/kode')
);

let mongoClear = null;

const question = (text) =>
    new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(text, (ans) => {
            rl.close();
            resolve(ans);
        });
    });

async function startBot() {
    await rental.initStore();
    let auth;
    if (process.env.MONGODB_URI) {
        auth = await useMongoAuthState(await getCollection(process.env.MONGODB_URI));
        mongoClear = auth.clear;
        console.log(chalk.cyan('Sesi disimpan di MongoDB.'));
    } else {
        auth = await useMultiFileAuthState(process.env.SESSION_DIR || 'session');
    }
    const { state, saveCreds } = auth;
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(chalk.cyan(`Menggunakan Baileys v${version.join('.')}, versi terbaru: ${isLatest}`));

    const zack = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['Ubuntu', 'Chrome', '120.0.0'],
        markOnlineOnConnect: true,
    });

    if (!zack.authState.creds.registered) {
        console.log(chalk.yellow('\nBot belum terhubung ke WhatsApp.'));
        let phoneNumber = global.pairingNumber || '';
        if (!phoneNumber) {
            if (!process.stdin.isTTY) {
                console.log(chalk.red('Tidak ada terminal interaktif. Set environment variable PAIRING_NUMBER (contoh: 628xxxxxxxxxx).'));
                process.exit(1);
            }
            phoneNumber = await question(chalk.green('Masukkan nomor WhatsApp aktif (format: 628xxxxxxxxxx, tanpa + atau spasi): '));
        }
        phoneNumber = String(phoneNumber).replace(/[^0-9]/g, '');

        try {
            await new Promise((r) => setTimeout(r, 1500));
            const code = await zack.requestPairingCode(phoneNumber);
            console.log(chalk.green('\n=================================='));
            console.log(chalk.green(` KODE PAIRING KAMU: ${code}`));
            console.log(chalk.green('=================================='));
            console.log('Buka WhatsApp di HP > Perangkat Tertaut > Tautkan dengan nomor telepon, lalu masukkan kode di atas.\n');
        } catch (e) {
            console.log(chalk.red('Gagal meminta kode pairing:'), e.message);
            process.exit(1);
        }
    }

    zack.ev.on('creds.update', saveCreds);

    zack.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const loggedOut = statusCode === DisconnectReason.loggedOut;

            if (loggedOut) {
                if (mongoClear) {
                    mongoClear().catch(() => {}).finally(() => {
                        console.log(chalk.red('Sesi logout. Sesi di MongoDB dihapus, restart service untuk pairing baru.'));
                        process.exit(0);
                    });
                    return;
                }
                console.log(chalk.red('Sesi logout. Hapus folder "session" lalu jalankan ulang bot untuk pairing baru.'));
                process.exit(0);
            } else {
                console.log(chalk.yellow('Koneksi terputus, mencoba menyambung ulang...'));
                startBot();
            }
        } else if (connection === 'open') {
            console.log(chalk.greenBright(`✅ ${global.botname} berhasil terhubung ke WhatsApp!`));
            jadibot.setMain(zack);
            jadibot.restoreAll();
        }
    });

    attachHandlers(zack, mainCtx);

    return zack;
}

startBot().catch((e) => {
    console.log(chalk.red('Gagal menjalankan bot:'), e);
});