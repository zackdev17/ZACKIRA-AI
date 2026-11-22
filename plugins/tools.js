/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { assertIntact } = require('../lib/guard.js');
const fs = require('fs');
const yt = require('../lib/ytdlp.js');
const { findLinks, fetchImage } = require('../lib/linkSearch.js');
const { searchImages } = require('../lib/imageSearch.js');
const ui = require('../lib/interactive.js');
const { drawWithCode } = require('../lib/sandboxDraw.js');
const cf = require('../lib/cfImage.js');
const { renderListCard, renderTableCard } = require('../lib/imageCard.js');

const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'search_links',
            description:
                'Cari link VALID (sudah dicek hidup) dari internet, misalnya Pinterest, Spotify, TikTok, Instagram, atau web umum. ' +
                'Gunakan ini kapan pun user minta link/referensi. Jangan pernah mengarang link sendiri. ' +
                'Untuk YouTube pakai search_youtube.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Kata kunci pencarian' },
                    site: {
                        type: 'string',
                        enum: ['pinterest', 'spotify', 'tiktok', 'instagram', 'any'],
                        description: 'Situs tujuan. "any" untuk web umum.',
                    },
                    limit: { type: 'integer', description: 'Jumlah hasil (1-8), default 5' },
                },
                required: ['query', 'site'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'search_youtube',
            description: 'Cari video/lagu di YouTube dan kembalikan daftar judul, channel, durasi, dan link valid.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string' },
                    limit: { type: 'integer', description: 'Jumlah hasil (1-8), default 5' },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'send_youtube_audio',
            description:
                'Unduh audio dari YouTube lalu KIRIM sebagai file lagu ke chat user. Gunakan saat user minta file lagu / mp3 / audio. ' +
                'Isi dengan link YouTube, atau judul lagu (akan dicari otomatis).',
            parameters: {
                type: 'object',
                properties: { query_or_url: { type: 'string' } },
                required: ['query_or_url'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'send_youtube_video',
            description:
                'Unduh video dari YouTube (kualitas sedang) lalu KIRIM sebagai file video ke chat user. ' +
                'Isi dengan link YouTube, atau judul video (akan dicari otomatis).',
            parameters: {
                type: 'object',
                properties: { query_or_url: { type: 'string' } },
                required: ['query_or_url'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'send_image',
            description:
                'KIRIM gambar ke chat user dari URL gambar langsung atau dari halaman (misalnya link pin Pinterest). ' +
                'Untuk gambar Pinterest: panggil search_pinterest dulu, lalu kirim salah satu "image" hasilnya ke sini.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string' },
                    caption: { type: 'string', description: 'Keterangan singkat (opsional)' },
                },
                required: ['url'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'draw_image',
            description:
                'GAMBAR sendiri dengan KODE canvas lalu kirim sebagai PNG ke user (ilustrasi vektor: pemandangan, karakter/kartun, hewan, logo, ikon, poster, kartu ucapan, pola, diagram, grafik, dll). ' +
                'Tulis HANYA badan kode JavaScript. Kanvas sudah dibuat berukuran W x H (default 1024x1024). Tersedia: ctx (CanvasRenderingContext2D lengkap), W, H, ' +
                'rect(x,y,w,h,fill,radius,stroke,lw), circle(x,y,r,fill,stroke,lw), ellipse(x,y,rx,ry,fill,rotation), line(x1,y1,x2,y2,color,lw), poly([[x,y],...],fill,stroke,lw), ' +
                'grad(x0,y0,x1,y1,[[0,c1],[1,c2]]) dan rgrad(x0,y0,r0,x1,y1,r1,stops) untuk gradien (dipakai sebagai nilai fill), ' +
                'text(str,x,y,{size,bold,color,align}), wrap(str,x,y,maxW,lineH,{size,bold,color}), rand(), Math. ' +
                'Dilarang: require/import/fetch/process/eval/Function, gambar eksternal, emoji. Urutan: latar dulu (rect(0,0,W,H,...)), lalu objek dari belakang ke depan; pakai gradien, bayangan (ctx.shadowBlur), dan komposisi yang jelas. ' +
                'Bukan untuk daftar/tabel (pakai send_list_image / send_table_image). Kalau hasil error, perbaiki kodenya lalu panggil lagi.',
            parameters: {
                type: 'object',
                properties: {
                    code: { type: 'string', description: 'Kode JavaScript untuk menggambar di ctx (tanpa tanda ``` )' },
                    width: { type: 'integer', description: 'Lebar px (256-2048, default 1024)' },
                    height: { type: 'integer', description: 'Tinggi px (256-2048, default 1024)' },
                    caption: { type: 'string', description: 'Keterangan singkat (opsional)' },
                },
                required: ['code'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'send_list_image',
            description:
                'KIRIM daftar / langkah-langkah / checklist / ringkasan sebagai GAMBAR (infografis rapi). Pakai kalau user minta daftar/list/langkah "dalam bentuk gambar" ' +
                'atau info yang enak disimpan/dibagikan. Teks tepat 100% seperti yang kamu isi (tidak diacak AI).',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Judul gambar' },
                    subtitle: { type: 'string', description: 'Subjudul (opsional)' },
                    items: {
                        type: 'array',
                        description: 'Item daftar (maks 24)',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string', description: 'Judul item (singkat)' },
                                description: { type: 'string', description: 'Penjelasan item (opsional)' },
                            },
                            required: ['title'],
                        },
                    },
                    numbered: { type: 'boolean', description: 'true = bernomor (default), false = titik' },
                    theme: { type: 'string', enum: ['dark', 'light', 'green', 'sunset'], description: 'Tema warna (default dark)' },
                    caption: { type: 'string' },
                },
                required: ['title', 'items'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'send_table_image',
            description:
                'KIRIM tabel (perbandingan, jadwal, harga, data) sebagai GAMBAR. Pakai kalau user minta tabel "dalam bentuk gambar". Maks 6 kolom dan 40 baris.',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    subtitle: { type: 'string' },
                    columns: { type: 'array', description: 'Nama kolom', items: { type: 'string' } },
                    rows: {
                        type: 'array',
                        description: 'Baris tabel; tiap baris adalah array teks sesuai urutan kolom',
                        items: { type: 'array', items: { type: 'string' } },
                    },
                    theme: { type: 'string', enum: ['dark', 'light', 'green', 'sunset'] },
                    caption: { type: 'string' },
                },
                required: ['title', 'columns', 'rows'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'search_pinterest',
            description:
                'Cari gambar di Pinterest, kembalikan daftar gambar (title, image, source). Pakai kalau kamu perlu memilih / mengirim SATU gambar (lalu panggil send_image). ' +
                'Kalau user cuma mau melihat-lihat banyak gambar, pakai send_pinterest.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Kata kunci, mis. "kucing lucu"' },
                    limit: { type: 'integer', description: 'Jumlah hasil (1-10), default 5' },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'send_pinterest',
            description:
                'Cari gambar di Pinterest lalu KIRIM hasilnya sebagai carousel kartu geser (tiap kartu ada gambar + tombol "Buka Pinterest" dan "Kirim gambar"). ' +
                'Pakai saat user minta gambar / foto / wallpaper / referensi visual.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string' },
                    count: { type: 'integer', description: 'Jumlah kartu (2-10), default 8' },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'send_youtube_carousel',
            description:
                'Cari di YouTube lalu KIRIM hasilnya sebagai carousel kartu geser (thumbnail + judul + tombol "Kirim audio" dan "Tonton"). ' +
                'Pakai saat user minta DICARIKAN lagu/video untuk dipilih. Kalau user langsung minta file, pakai send_youtube_audio / send_youtube_video.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string' },
                    count: { type: 'integer', description: 'Jumlah kartu (2-8), default 5' },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'send_buttons',
            description:
                'KIRIM pesan dengan tombol interaktif (maks 5). Pakai untuk menawarkan 2-4 pilihan/aksi cepat (mis. Ya/Tidak, pilih format), ' +
                'tombol link, tombol salin teks (kode/nomor), atau tombol telepon. Bisa disertai gambar di atasnya.',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'Isi pesan' },
                    buttons: {
                        type: 'array',
                        description: 'Daftar tombol (maks 5).',
                        items: {
                            type: 'object',
                            properties: {
                                type: {
                                    type: 'string',
                                    enum: ['reply', 'url', 'copy', 'call'],
                                    description:
                                        'reply = user menekan lalu teks "value" dikirim sebagai pesan user (untuk pilihan/aksi lanjutan); ' +
                                        'url = buka link; copy = salin teks; call = telepon.',
                                },
                                label: { type: 'string', description: 'Teks di tombol, maks 25 karakter' },
                                value: {
                                    type: 'string',
                                    description: 'reply: teks pesan yang dikirim saat ditekan (default = label); url: link https; copy: teks yang disalin; call: nomor telepon',
                                },
                            },
                            required: ['type', 'label'],
                        },
                    },
                    title: { type: 'string', description: 'Judul kecil di atas pesan (opsional)' },
                    footer: { type: 'string', description: 'Teks kecil di bawah (opsional)' },
                    image_url: { type: 'string', description: 'Link gambar untuk header (opsional)' },
                },
                required: ['text', 'buttons'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'send_list',
            description:
                'KIRIM menu pilihan (daftar yang terbuka saat tombol ditekan, maks 10 baris). Pakai kalau pilihan lebih dari 4 atau butuh deskripsi per pilihan. ' +
                'Saat user memilih, "id" baris itu (default = title) dikirim sebagai pesan user.',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'Isi pesan' },
                    button_label: { type: 'string', description: 'Teks tombol pembuka daftar, mis. "Pilih menu" (maks 25 karakter)' },
                    rows: {
                        type: 'array',
                        description: 'Baris pilihan (maks 10)',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string', description: 'Maks 24 karakter' },
                                description: { type: 'string', description: 'Maks 72 karakter (opsional)' },
                                id: { type: 'string', description: 'Teks yang dikirim saat dipilih (default = title)' },
                            },
                            required: ['title'],
                        },
                    },
                    section_title: { type: 'string', description: 'Judul grup pilihan (opsional)' },
                    title: { type: 'string' },
                    footer: { type: 'string' },
                    image_url: { type: 'string' },
                },
                required: ['text', 'button_label', 'rows'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'send_carousel',
            description:
                'KIRIM carousel kartu geser (2-10 kartu). Tiap kartu punya gambar, teks, dan 1-2 tombol. Pakai untuk menampilkan beberapa item sejenis ' +
                '(produk, tempat, rekomendasi). Untuk gambar Pinterest pakai send_pinterest, untuk YouTube pakai send_youtube_carousel.',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'Teks pembuka di atas carousel' },
                    footer: { type: 'string' },
                    cards: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string', description: 'Judul kartu' },
                                body: { type: 'string', description: 'Teks kartu' },
                                image_url: { type: 'string', description: 'Link gambar kartu (wajib)' },
                                footer: { type: 'string' },
                                buttons: { type: 'array', description: '1-2 tombol, format sama seperti send_buttons', items: { type: 'object' } },
                            },
                            required: ['body', 'image_url', 'buttons'],
                        },
                    },
                },
                required: ['cards'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'send_location',
            description: 'KIRIM lokasi (pin peta) ke chat user. Pakai kalau user minta lokasi suatu tempat dan kamu tahu koordinatnya.',
            parameters: {
                type: 'object',
                properties: {
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    name: { type: 'string', description: 'Nama tempat' },
                    address: { type: 'string', description: 'Alamat (opsional)' },
                },
                required: ['latitude', 'longitude'],
            },
        },
    },
];

let activeDownloads = 0;
const MAX_ACTIVE = 2;

const fmtDur = (s) => {
    if (!s) return '?';
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
const safeName = (s) => String(s || 'file').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80) || 'file';

async function resolveYoutubeUrl(input) {
    if (yt.isUrl(input)) return input.trim();
    const res = await yt.search(input, 1);
    if (!res.length) throw new Error('Video tidak ditemukan di YouTube');
    return res[0].url;
}

async function sendYoutube(kind, input, ctx) {
    if (activeDownloads >= MAX_ACTIVE) {
        return { ok: false, error: 'Bot lagi sibuk mengunduh file lain, coba lagi sebentar lagi.' };
    }
    activeDownloads++;
    let filePath = null;
    try {
        const url = await resolveYoutubeUrl(input);
        const meta = await yt.info(url);
        const maxMin = global.maxMediaMinutes || 15;
        if (meta.isLive) return { ok: false, error: 'Itu siaran langsung, tidak bisa diunduh.' };
        if (meta.duration > maxMin * 60) {
            return { ok: false, error: `Durasi ${fmtDur(meta.duration)} melebihi batas ${maxMin} menit.`, title: meta.title, url };
        }

        await ctx.zack.sendMessage(
            ctx.jid,
            { text: `⏳ Lagi menyiapkan ${kind === 'audio' ? 'lagu' : 'video'} *${meta.title}* (${fmtDur(meta.duration)})...` },
            { quoted: ctx.z }
        );

        const file = await yt.download(url, kind);
        filePath = file.path;
        const name = safeName(meta.title);

        if (kind === 'audio') {
            if (file.ext === 'mp3' || file.ext === 'm4a') {
                await ctx.zack.sendMessage(
                    ctx.jid,
                    {
                        audio: { url: file.path },
                        mimetype: file.ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4',
                        fileName: `${name}.${file.ext}`,
                    },
                    { quoted: ctx.z }
                );
            } else {
                await ctx.zack.sendMessage(
                    ctx.jid,
                    { document: { url: file.path }, mimetype: 'audio/' + file.ext, fileName: `${name}.${file.ext}` },
                    { quoted: ctx.z }
                );
            }
        } else {
            await ctx.zack.sendMessage(
                ctx.jid,
                { video: { url: file.path }, mimetype: 'video/mp4', caption: meta.title },
                { quoted: ctx.z }
            );
        }
        return { ok: true, sent: kind, title: meta.title, channel: meta.channel, url };
    } finally {
        activeDownloads--;
        if (filePath) yt.cleanup(filePath);
    }
}


const okSent = (kind, extra = {}) => JSON.stringify({ ok: true, sent: kind, quiet: true, ...extra });

const btn = (b) => ({ type: b?.type, label: b?.label, value: b?.value });

async function sendPinterestCarousel(query, count, ctx) {
    const n = Math.min(Math.max(parseInt(count) || 8, 2), 10);
    const { provider, results: pins } = await searchImages(query, n);
    if (!pins.length) return JSON.stringify({ ok: false, error: `Tidak ada gambar untuk "${query}"` });
    const label = provider === 'pinterest' ? 'Pinterest' : 'Bing Images';
    const cards = pins.map((p, i) => ({
        title: `Gambar ${i + 1}`,
        body: p.author ? `${p.title}\n👤 ${p.author}` : p.title,
        footer: label,
        imageUrl: p.thumb,
        buttons: [
            { type: 'url', label: provider === 'pinterest' ? '📌 Buka Pinterest' : '🔗 Buka sumber', value: p.source },
            { type: 'reply', label: '🖼️ Kirim gambar', value: `kirim gambar pinterest ini: ${p.image}` },
        ],
    }));
    try {
        const r = await ui.sendCarousel(ctx.zack, ctx.jid, {
            text: `🔎 Hasil pencarian gambar untuk *${query}* (${label})`,
            footer: 'Geser untuk melihat lainnya ➡️',
            cards,
        });
        return okSent('carousel', { cards: r.cards, query });
    } catch (e) {
        console.log('[TOOL send_pinterest] carousel gagal, kirim gambar biasa:', e.message);
        let sent = 0;
        for (const p of pins) {
            if (sent >= 3) break;
            try {
                const img = await fetchImage(p.image);
                await ctx.zack.sendMessage(ctx.jid, { image: img.buffer, caption: p.title }, { quoted: ctx.z });
                sent++;
            } catch {}
        }
        if (!sent) throw new Error(`Gambar ditemukan tapi tidak bisa dikirim: ${e.message}`);
        return JSON.stringify({ ok: true, sent: 'image', note: `${sent} gambar sudah terkirim (carousel tidak tersedia). Balas singkat saja.` });
    }
}

async function sendYoutubeCarousel(query, count, ctx) {
    const n = Math.min(Math.max(parseInt(count) || 5, 2), 8);
    const vids = await yt.search(query, n);
    if (!vids.length) return JSON.stringify({ ok: false, error: `Tidak ada hasil YouTube untuk "${query}"` });
    const cards = vids.map((v, i) => ({
        title: `Hasil ${i + 1}`,
        body: `*${v.title}*\n📺 ${v.channel || '-'}\n⏱️ ${fmtDur(v.duration)}`,
        footer: 'YouTube',
        imageUrl: v.thumbnail,
        buttons: [
            { type: 'reply', label: '🎵 Kirim audio', value: `kirim file audio dari link ini: ${v.url}` },
            { type: 'url', label: '▶️ Tonton', value: v.url },
        ],
    }));
    const r = await ui.sendCarousel(ctx.zack, ctx.jid, {
        text: `🎧 Hasil pencarian YouTube untuk *${query}*`,
        footer: 'Geser untuk melihat lainnya ➡️',
        cards,
    });
    return okSent('carousel', { cards: r.cards, query });
}

async function executeTool(name, args, ctx) {
    assertIntact();
    try {
        switch (name) {
            case 'search_links': {
                const results = await findLinks(String(args.query || ''), args.site || 'any', args.limit);
                if (!results.length) return JSON.stringify({ ok: true, results: [], note: 'Tidak ada link valid yang ditemukan.' });
                return JSON.stringify({ ok: true, results });
            }
            case 'search_youtube': {
                const results = await yt.search(String(args.query || ''), args.limit);
                return JSON.stringify({
                    ok: true,
                    results: results.map((r) => ({ ...r, duration: fmtDur(r.duration) })),
                });
            }
            case 'send_youtube_audio':
                return JSON.stringify(await sendYoutube('audio', String(args.query_or_url || ''), ctx));
            case 'send_youtube_video':
                return JSON.stringify(await sendYoutube('video', String(args.query_or_url || ''), ctx));
            case 'send_image': {
                const { buffer } = await fetchImage(String(args.url || ''));
                await ctx.zack.sendMessage(
                    ctx.jid,
                    { image: buffer, caption: args.caption ? String(args.caption) : undefined },
                    { quoted: ctx.z }
                );
                return JSON.stringify({ ok: true, sent: 'image' });
            }
            case 'generate_image': {
                let img;
                try {
                    img = await cf.generateImage(args.prompt, { orientation: args.orientation });
                } catch (e) {
                    throw new Error(`${e.message}. Jangan ulangi tool ini; sebagai gantinya gunakan draw_image (gambar vektor via kode) atau jelaskan singkat ke user.`);
                }
                await ctx.zack.sendMessage(
                    ctx.jid,
                    { image: img.buffer, caption: args.caption ? String(args.caption).slice(0, 900) : undefined },
                    { quoted: ctx.z }
                );
                return JSON.stringify({ ok: true, sent: 'image', note: 'Gambar AI sudah terkirim. Balas singkat saja.' });
            }
            case 'draw_image': {
                let img;
                try {
                    img = await drawWithCode({ code: args.code, width: args.width, height: args.height });
                } catch (e) {
                    throw new Error(`${e.message}. Perbaiki kodenya lalu panggil draw_image lagi (maks 1-2 kali), atau jelaskan singkat ke user.`);
                }
                await ctx.zack.sendMessage(
                    ctx.jid,
                    { image: img.buffer, caption: args.caption ? String(args.caption).slice(0, 900) : undefined },
                    { quoted: ctx.z }
                );
                return JSON.stringify({ ok: true, sent: 'image', note: 'Gambar sudah terkirim. Balas singkat saja, jangan menulis ulang kodenya.' });
            }
            case 'send_list_image': {
                const { buffer } = renderListCard({ title: args.title, subtitle: args.subtitle, items: args.items, numbered: args.numbered, theme: args.theme });
                await ctx.zack.sendMessage(ctx.jid, { image: buffer, caption: args.caption ? String(args.caption).slice(0, 900) : undefined }, { quoted: ctx.z });
                return JSON.stringify({ ok: true, sent: 'image', note: 'Gambar daftar sudah terkirim. Jangan tulis ulang isinya.' });
            }
            case 'send_table_image': {
                const { buffer } = renderTableCard({ title: args.title, subtitle: args.subtitle, columns: args.columns, rows: args.rows, theme: args.theme });
                await ctx.zack.sendMessage(ctx.jid, { image: buffer, caption: args.caption ? String(args.caption).slice(0, 900) : undefined }, { quoted: ctx.z });
                return JSON.stringify({ ok: true, sent: 'image', note: 'Gambar tabel sudah terkirim. Jangan tulis ulang isinya.' });
            }
            case 'search_pinterest': {
                const { results } = await searchImages(String(args.query || ''), args.limit || 5);
                return JSON.stringify({
                    ok: true,
                    results: results.map((r) => ({ title: r.title, image: r.image, source: r.source })),
                    note: results.length ? undefined : 'Tidak ada hasil.',
                });
            }
            case 'send_pinterest':
                return await sendPinterestCarousel(String(args.query || ''), args.count, ctx);
            case 'send_youtube_carousel':
                return await sendYoutubeCarousel(String(args.query || ''), args.count, ctx);
            case 'send_buttons': {
                const r = await ui.sendButtons(ctx.zack, ctx.jid, {
                    text: args.text,
                    title: args.title,
                    footer: args.footer,
                    imageUrl: args.image_url,
                    buttons: (Array.isArray(args.buttons) ? args.buttons : []).map(btn),
                });
                return okSent('buttons', r);
            }
            case 'send_list': {
                const r = await ui.sendList(ctx.zack, ctx.jid, {
                    text: args.text,
                    title: args.title,
                    footer: args.footer,
                    imageUrl: args.image_url,
                    buttonLabel: args.button_label,
                    sections: [{ title: args.section_title || 'Pilihan', rows: Array.isArray(args.rows) ? args.rows : [] }],
                });
                return okSent('list', r);
            }
            case 'send_carousel': {
                const cards = (Array.isArray(args.cards) ? args.cards : []).map((c) => ({
                    title: c.title,
                    body: c.body,
                    footer: c.footer,
                    imageUrl: c.image_url,
                    buttons: (Array.isArray(c.buttons) ? c.buttons : []).map(btn),
                }));
                const r = await ui.sendCarousel(ctx.zack, ctx.jid, { text: args.text, footer: args.footer, cards });
                return okSent('carousel', r);
            }
            case 'send_location': {
                await ui.sendLocation(ctx.zack, ctx.jid, args);
                return okSent('location');
            }
            default:
                return JSON.stringify({ ok: false, error: `Tool ${name} tidak dikenal` });
        }
    } catch (e) {
        console.log(`[TOOL ${name}] error:`, e.message);
        const out = { ok: false, error: e.message };
        if (/^send_youtube/.test(name)) {
            out.hint = 'Pengunduhan gagal karena masalah di sisi server, BUKAN karena videonya. JANGAN coba video lain / ulangi tool ini. Sampaikan singkat ke user bahwa unduhan gagal, dan beri link YouTube-nya saja.';
        }
        return JSON.stringify(out);
    }
}

const GENERATE_IMAGE_TOOL = {
    type: 'function',
    function: {
        name: 'generate_image',
        description:
            'BUAT gambar realistis/artistik dengan model AI (foto realistis, lukisan, anime, 3D, konsep seni, karakter detail). ' +
            'Pakai untuk permintaan gambar yang butuh kesan foto/detail tinggi. Untuk logo, ikon, kartun sederhana, diagram, atau gambar yang ada tulisan tepat, pakai draw_image. ' +
            'Bukan untuk daftar/tabel (send_list_image / send_table_image).',
        parameters: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: 'Deskripsi gambar dalam BAHASA INGGRIS: subjek, gaya, suasana, pencahayaan, warna, komposisi. Terjemahkan dan perkaya permintaan user.',
                },
                orientation: { type: 'string', enum: ['square', 'portrait', 'landscape'], description: 'Hanya berlaku untuk sebagian model' },
                caption: { type: 'string', description: 'Keterangan singkat (opsional)' },
            },
            required: ['prompt'],
        },
    },
};

function getTools() {
    if (!cf.cloudflareConfigured()) return TOOLS;
    const narrowed = TOOLS.map((t) =>
        t.function.name === 'draw_image'
            ? {
                  ...t,
                  function: {
                      ...t.function,
                      description:
                          'Gambar vektor SEDERHANA lewat kode canvas: logo, ikon, diagram, bentuk geometris, atau gambar dengan tulisan yang harus tepat; juga CADANGAN kalau generate_image gagal. ' +
                          'JANGAN dipakai untuk pemandangan, orang, hewan, foto, lukisan, anime (itu generate_image). ' +
                          t.function.description.slice(t.function.description.indexOf('Tulis HANYA')),
                  },
              }
            : t
    );
    return [...narrowed, GENERATE_IMAGE_TOOL];
}

module.exports = { TOOLS, getTools, executeTool };
