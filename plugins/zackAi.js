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
const chalk = require('chalk');
const { AIRich } = require('../lib/richBuilder.js');
const { groqChat, AllModelsBusyError } = require('../lib/groqPool.js');
const { TOOLS, getTools, executeTool } = require('./tools.js');
const { cloudflareConfigured } = require('../lib/cfImage.js');
const { selectTools } = require('../lib/toolSelect.js');
const { cfChat, cfChatConfigured } = require('../lib/cfChat.js');
const { extractTextToolCalls, coerceArgs, hasToolMarkup } = require('../lib/toolCallParser.js');
const { historyFile: chatHistoryFile, loadHistory, saveHistory } = require('../lib/chatHistory.js');
const { touchProfile } = require('../lib/userProfile.js');
const { isOwner } = require('../lib/owner.js');
const { toWhatsApp, toRichText } = require('../lib/waFormat.js');
const { assertIntact } = require('../lib/guard.js');
const { current, getVar } = require('../lib/botContext.js');
const premium = require('../lib/premium.js');


const getGroqKey = () => getVar('groqkey');
const getChatModels = () => (global.groqChatModels && global.groqChatModels.length ? global.groqChatModels : getGroqModels());
const getCodeModels = () => (global.groqCodeModels && global.groqCodeModels.length ? global.groqCodeModels : getGroqModels());
const getGroqModels = () => (global.groqModels && global.groqModels.length ? global.groqModels : ['openai/gpt-oss-120b']);
const getVisionModels = () => (global.groqVisionModels && global.groqVisionModels.length ? global.groqVisionModels : ['qwen/qwen3.8-27b']);
const MAX_TOOL_STEPS = 5;

function formatCodeBlocks(text) {
    text = text.replace(
        /```(\w+)?\n([\s\S]*?)```/g,
        (match, lang, code) => {
            lang = lang || '';
            return `\`\`\`${lang}\n${code.trim()}\n\`\`\``;
        }
    );
    const count = (text.match(/```/g) || []).length;
    if (count % 2 !== 0) text += '\n```';
    return text;
}

function buildProfileBlock(profile = {}) {
    const { name, known, isOwnerUser, isGroup, nicknameChanged, isNew } = profile;
    const lines = ['PROFIL USER (data dari WhatsApp, pasti benar):'];
    lines.push(known ? `- Nama panggilan: ${name}` : '- Nama: belum diketahui');
    lines.push(`- Tipe chat: ${isGroup ? 'grup (banyak orang, jawab untuk user yang bertanya ini saja)' : 'pribadi'}`);
    if (isGroup) {
        lines.push(
            '- Riwayat grup berisi pesan banyak orang; tiap pesan user diawali label [Nama]: sebagai penanda pengirim. ' +
            'Jawab HANYA untuk pengirim pesan terakhir, jangan mencampur data/permintaan orang lain, dan JANGAN menulis label [Nama]: di awal balasanmu.'
        );
    } else {
        lines.push('- Riwayat ini hanya percakapan dengan user ini. Jangan mengarang hal yang tidak ada di riwayat.');
    }
    if (isOwnerUser) {
        lines.push(
            current().isMain
                ? '- Status: ini adalah Zack, penciptamu / pemilik bot. Perlakukan akrab dan hormat.'
                : '- Status: ini adalah pemilik bot ini. Perlakukan akrab dan hormat.'
        );
    }
    lines.push('');
    if (known) {
        lines.push(
            `Kamu KENAL user ini. Namanya ${name}. Panggil dengan nama itu secara natural (sesekali, tidak di setiap kalimat). ` +
            `Kalau user bertanya "siapa namaku?" / "kamu kenal aku?", jawab dengan namanya. ` +
            `DILARANG bilang kamu tidak tahu nama user. Kalau user minta dipanggil nama lain, turuti.`
        );
        if (nicknameChanged) lines.push(`User baru saja meminta dipanggil "${name}". Konfirmasi singkat dan mulai pakai nama itu.`);
        else if (isNew) lines.push('Ini pertama kali kamu ngobrol dengannya, sapa dengan ramah.');
    } else {
        lines.push(
            'Nama user belum diketahui. Boleh tanyakan namanya sekali dengan ramah. ' +
            'Kalau user menyebut namanya, pakai nama itu. Jangan mengarang nama.'
        );
    }
    return lines.join('\n');
}

function buildSystemPrompt(profile = {}) {
    return `Kamu adalah ${getVar('botname')}, AI WhatsApp yang natural dan interaktif, bahas apa yabg sering di bahas tiap tiap user berbeda, jangan hanya bahas soal project/coding atau hanya fokus safu hal, karena tiap orang itu beda. Zack adalah penciptamu (tidak ada yang namanya Zack yang menciptakan kamu selain dengan nomor whatsapp 6289606860329).

ATURAN:
1. Selalu gunakan bahasa yang sama dengan user.
2. Gunakan emoji secara natural.
3. Gunakan format WhatsApp: *bold*, _italic_, ~strikethrough~, \`monospace\`
4. Jika mengirim coding/program/script: WAJIB gunakan format triple backticks.
5. Jangan pernah mengirim coding tanpa code block.
6. Untuk bahasa pemrograman gunakan: html, css, javascript, json, python, php, cpp, dan lain sebagainya.
7. Saat mengirim coding: Rapikan indentasi, jangan rusak format, jangan hilangkan enter.
8. JANGAN pakai sintaks Markdown yang tidak dikenal WhatsApp: tanpa ### / ## judul, tanpa **tebal** ganda, tanpa garis --- . Judul/penekanan cukup *tebal* (satu bintang). Daftar langkah pakai angka "1." atau bullet "-".
9. Untuk data tabular (perbandingan, jadwal, angka): gunakan format Markdown tabel standar dengan | dan -. Tapi untuk daftar link / hasil pencarian JANGAN pakai tabel: pakai daftar bernomor, judul dalam *bold*, lalu link di baris sendiri.

Balas user secara natural seperti manusia.

${buildProfileBlock(profile)}

PENTING:
Jika mengirim coding, WAJIB gunakan format EXACT seperti ini:
\`\`\`html
<h1>Hello</h1>
\`\`\`

Jika mengirim tabel, WAJIB gunakan format Markdown:
| Kolom 1 | Kolom 2 |
|---------|---------|
| Data 1  | Data 2  |`;
}

function parseMarkdownTable(tableLines) {
    const tableData = [];
    for (let row of tableLines) {
        if (/^\|[-|: ]+\|$/.test(row.trim())) continue;
        const cols = row.trim().split('|').map(c => c.trim());
        if (cols[0] === '') cols.shift();
        if (cols[cols.length - 1] === '') cols.pop();
        if (cols.length > 0 && cols.some(c => c !== '')) {
            tableData.push(cols);
        }
    }
    return tableData;
}

function parseSegments(text) {
    const segments = [];
    
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
        
        if (match.index > lastIndex) {
            const before = text.slice(lastIndex, match.index).trim();
            if (before) {
                
                const tableSegments = splitTextAndTable(before);
                segments.push(...tableSegments);
            }
        }
        
        segments.push({
            type: 'code',
            lang: match[1] || 'text',
            content: match[2].trim()
        });
        lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
        const after = text.slice(lastIndex).trim();
        if (after) {
            const tableSegments = splitTextAndTable(after);
            segments.push(...tableSegments);
        }
    }

    return segments;
}

function splitTextAndTable(text) {
    const segments = [];
    const lines = text.split('\n');
    let textBuffer = [];
    let tableBuffer = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isTableRow = /^\|.+\|/.test(line.trim());
        const isSeparator = /^\|[-|: ]+\|$/.test(line.trim());

        if (isTableRow || isSeparator) {
            
            if (textBuffer.length > 0) {
                const t = textBuffer.join('\n').trim();
                if (t) segments.push({ type: 'text', content: t });
                textBuffer = [];
            }
            inTable = true;
            tableBuffer.push(line);
        } else {
            
            if (inTable && tableBuffer.length > 0) {
                const tableData = parseMarkdownTable(tableBuffer);
                if (tableData.length > 0) {
                    segments.push({ type: 'table', content: tableData });
                }
                tableBuffer = [];
                inTable = false;
            }
            textBuffer.push(line);
        }
    }
    
    if (tableBuffer.length > 0) {
        const tableData = parseMarkdownTable(tableBuffer);
        if (tableData.length > 0) {
            segments.push({ type: 'table', content: tableData });
        }
    }
    if (textBuffer.length > 0) {
        const t = textBuffer.join('\n').trim();
        if (t) segments.push({ type: 'text', content: t });
    }

    return segments;
}

function renderAsciiTable(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return '';
    const colCount = Math.max(...rows.map((r) => r.length));
    const widths = Array(colCount).fill(0);
    rows.forEach((r) => {
        r.forEach((cell, i) => {
            widths[i] = Math.max(widths[i] || 0, String(cell ?? '').length);
        });
    });
    const pad = (s, w) => {
        const str = String(s ?? '');
        return str + ' '.repeat(Math.max(0, w - str.length));
    };
    const lines = [];
    rows.forEach((r, idx) => {
        const cells = Array.from({ length: colCount }, (_, i) => r[i] ?? '');
        lines.push(cells.map((cell, i) => pad(cell, widths[i])).join('  |  ').trimEnd());
        if (idx === 0) {
            lines.push(widths.map((w) => '-'.repeat(w)).join('--+--'));
        }
    });
    return lines.join('\n');
}

const useNativeTable = () => String(process.env.RICH_TABLE ?? 'true').toLowerCase() !== 'false';

const MD_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
const URL_RE = /https?:\/\/\S+/;

function flattenCell(cell) {
    return String(cell ?? '')
        .replace(MD_LINK_RE, (m, t, u) => (!t || !t.trim() || t.trim() === u ? u : `${t.trim()}: ${u}`))
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .trim();
}

const tableHasUrl = (rows) => rows.some((r) => r.some((c) => URL_RE.test(flattenCell(c))));

function tableNeedsList(rows) {
    if (rows.some((r) => r.some((c) => URL_RE.test(c)))) return true;
    const colCount = Math.max(...rows.map((r) => r.length));
    const widths = Array(colCount).fill(0);
    rows.forEach((r) => r.forEach((c, i) => (widths[i] = Math.max(widths[i], c.length))));
    return widths.reduce((x, y) => x + y, 0) + 5 * (colCount - 1) > 38;
}

function tableToList(rows) {
    let header = rows[0];
    let body = rows.slice(1);
    if (header.length > 1 && /^(no\.?|nomor|#)$/i.test(header[0])) {
        header = header.slice(1);
        body = body.map((r) => r.slice(1));
    }
    return body
        .map((r, i) => {
            const lines = [`*${i + 1}. ${r[0] || '-'}*`];
            for (let j = 1; j < header.length; j++) {
                const v = r[j];
                if (!v) continue;
                const m = v.match(/^(.*?)(?::\s*)?(https?:\/\/\S+)$/);
                if (m) {
                    if (m[1].trim() && !/link|url|tautan/i.test(header[j])) lines.push(`${header[j] ? header[j] + ': ' : ''}${m[1].trim()}`);
                    lines.push(m[2]);
                } else lines.push(`${header[j] ? header[j] + ': ' : ''}${v}`);
            }
            return lines.join('\n');
        })
        .join('\n\n');
}

function tableToText(rows) {
    const flat = rows.map((r) => r.map(flattenCell));
    if (tableNeedsList(flat)) return { kind: 'list', text: tableToList(flat) };
    return { kind: 'ascii', text: renderAsciiTable(flat) };
}

function segmentsToPlain(segments) {
    return segments
        .map((seg) => {
            if (seg.type === 'code') return '```' + (seg.lang || '') + '\n' + seg.content + '\n```';
            if (seg.type === 'table') {
                const t = tableToText(seg.content);
                return t.kind === 'ascii' ? '```\n' + t.text + '\n```' : t.text;
            }
            return seg.content;
        })
        .join('\n\n');
}

async function sendAiMessage(result, z, zack) {
    const jid = z.key.remoteJid;
    const hasCode = /```[\s\S]*?```/.test(result);
    const hasTable = /\|.*\|.*\n\|[-:| ]+\|/.test(result);
    const native = useNativeTable();
    let nativeEligible = false;
    if (hasTable && native) {
        try {
            nativeEligible = parseSegments(result).some((sg) => sg.type === 'table' && !tableHasUrl(sg.content));
        } catch (e) {}
    }

    if (hasCode || nativeEligible) {
        try {
            const segments = parseSegments(result);
            const aiRich = new AIRich(zack);

            for (const seg of segments) {
                if (seg.type === 'text' && seg.content) {
                    aiRich.addText(toRichText(seg.content), { hyperlink: true, citation: false, latex: false });
                } else if (seg.type === 'code' && seg.content) {
                    aiRich.addCode(seg.lang || 'text', seg.content);
                } else if (seg.type === 'table' && seg.content && seg.content.length > 0) {
                    if (native && !tableHasUrl(seg.content)) {
                        aiRich.addTable(seg.content.map((r) => r.map(flattenCell)));
                    } else {
                        const t = tableToText(seg.content);
                        if (t.kind === 'ascii') aiRich.addCode('text', t.text);
                        else aiRich.addText(toRichText(t.text), { hyperlink: false, citation: false, latex: false });
                    }
                }
            }

            await aiRich.send(jid, { quoted: null });
            console.log('AIRich sent successfully to', jid);
            return;
        } catch (error) {
            console.log('AIRich Error, fallback ke teks biasa:', error.message);
        }
    }

    let finalText = result;
    if (hasTable) {
        try {
            finalText = segmentsToPlain(parseSegments(result));
        } catch (e) {}
    }
    finalText = toWhatsApp(finalText);
    try {
        await zack.sendMessage(jid, { text: finalText }, { quoted: null });
        console.log('Reply sent successfully to', jid);
    } catch (error) {
        console.log('Reply Error:', error.message);
    }
}

const RULES = {
    core: `

TOOLS (kamu punya alat nyata, jadi jangan pernah bilang tidak bisa mengirim file/gambar kalau tool-nya tersedia):
- Panggil tool lewat function calling. DILARANG menulis tag/sintaks tool seperti <tool_call>, <function=...>, atau JSON tool di dalam balasan teks.
- Jangan bilang "tunggu ya" / "aku cariin dulu" tanpa memanggil tool. Kalau tool dibutuhkan, panggil SEKARANG di giliran ini.
- Minta LINK (Spotify / TikTok / Instagram / web) atau info terbaru -> search_links. Link Pinterest hanya kalau user eksplisit minta "link". Minta LIRIK -> search_links (query "<judul> <artis> lirik", site=any) lalu beri link halaman liriknya; jangan menulis lirik dari ingatan.
- Tampilkan link HARUS lengkap (URL utuh) dalam daftar bernomor, satu link per item di baris sendiri. Jangan taruh link di dalam tabel. JANGAN PERNAH mengarang link; hanya link dari hasil tool.
- Setelah file/gambar terkirim lewat tool, cukup balas singkat (jangan kirim ulang link yang sama). Kalau tool gagal, jelaskan singkat apa masalahnya dan tawarkan alternatif.
- Kalau user mengirim gambar, jelaskan/baca isinya sesuai pertanyaan (termasuk teks di dalam gambar).
- Kalau satu permintaan berisi beberapa hal (mis. file lagu + lirik), lakukan semuanya: panggil semua tool yang perlu dalam giliran yang sama.`,
    media: `
- Minta FILE lagu / mp3 / audio -> langsung send_youtube_audio (isi judul + artis, tidak perlu search dulu). Minta video -> send_youtube_video. Minta link YouTube -> search_youtube.
- Minta DICARIKAN lagu/video (belum minta file) -> send_youtube_carousel. Hasil tombol "Kirim audio" datang sebagai "kirim file audio dari link ini: <url>" -> langsung send_youtube_audio.
- Spotify tidak bisa diunduh (DRM). Beri link Spotify-nya, tawarkan versi YouTube kalau user mau filenya.`,
    imagefind: `
- Minta gambar / foto / wallpaper / anime / meme ("carikan gambar X", "X di pinterest", "foto X") -> send_pinterest dengan query X (carousel gambar geser). JANGAN pakai search_links untuk ini: hasilnya artikel, bukan gambar. Kalau user mau SATU gambar langsung: search_pinterest lalu send_image.
- Hasil tombol "Kirim gambar" datang sebagai pesan "kirim gambar pinterest ini: <url>" -> langsung send_image dengan url itu.`,
    interactive: `

PESAN INTERAKTIF (tombol / daftar / carousel / lokasi):
- Menawarkan 2-4 pilihan atau aksi cepat -> send_buttons (type reply), BUKAN menulis "ketik 1 / 2 / 3". Teks yang dikirim tombol "reply" (value) harus kalimat yang jelas, karena akan kembali ke kamu sebagai pesan user.
- Pilihan lebih dari 4 atau butuh deskripsi -> send_list. Beberapa item bergambar -> send_carousel.
- Link yang ingin dibuka -> tombol type url. Nomor rekening / kode / teks yang perlu disalin -> tombol type copy. Nomor telepon -> tombol type call.
- Pakai hanya kalau benar-benar membantu. Percakapan biasa, penjelasan, dan jawaban singkat tetap teks biasa.
- Setelah mengirim pesan interaktif, JANGAN mengulang isinya di teks. Balas kosong, atau satu kalimat singkat saja.`,
};

function imageMakeRule() {
    return (
        (cloudflareConfigured()
            ? '\n- Minta DIBUATKAN gambar baru (buatkan / gambarkan / lukis / desain / generate: pemandangan, orang, hewan, foto, lukisan, anime, poster, wallpaper, ilustrasi, karakter, apa saja) -> pakai generate_image SECARA DEFAULT (prompt bahasa Inggris yang detail). draw_image HANYA untuk logo, ikon, diagram, bentuk geometris, atau gambar dengan tulisan yang harus tepat; dan sebagai cadangan kalau generate_image error. Jangan bilang tidak bisa membuat gambar.'
            : '\n- Minta DIBUATKAN gambar baru (buatkan / gambarkan / lukis / desain: pemandangan, karakter, logo, poster, kartu ucapan, apa saja) -> draw_image: tulis kode canvas yang rapi, berwarna, dan komposisinya jelas (gradien, bentuk, bayangan). Jangan bilang tidak bisa menggambar. Hasilnya gambar vektor buatan kode; untuk foto realistis, jelaskan itu singkat lalu tetap buat versi terbaiknya. Kode HARUS ringkas (maks ±70 baris, tanpa komentar panjang) supaya hemat token. Kalau tool error, perbaiki kode dan coba lagi.') +
        '\n- Minta daftar / langkah / checklist / info "dalam bentuk gambar" -> send_list_image. Minta tabel "dalam bentuk gambar" -> send_table_image. Isi teksnya harus lengkap dan benar, karena dirender persis seperti yang kamu tulis.'
    );
}

function composeToolRules(groups) {
    let out = RULES.core;
    if (groups.includes('media')) out += RULES.media;
    if (groups.includes('imagefind')) out += RULES.imagefind;
    if (groups.includes('imagemake')) out += imageMakeRule();
    if (groups.includes('interactive')) out += RULES.interactive;
    return out;
}

const TOOL_INTENT_RE =
    /\b(lagu|mp3|audio|musik|lirik|video|youtube|yt|spotify|tiktok|pinterest|instagram|link|tautan|gambar(?:kan)?|lukis(?:kan)?|foto|poster|logo|ilustrasi|wallpaper|infografis|infografik)\b/i;
const TOOL_VERB_RE = /\b(cari(?:kan|in)?|kirim(?:kan|in)?|putar(?:kan)?|download|unduh|minta|mana|send|tolong|bikin(?:kan)?|ambil(?:kan)?|buat(?:kan|in)?|generate|gambarkan|lukis(?:kan)?|desain(?:kan)?)\b/i;
function looksLikeToolRequest(text) {
    const t = String(text || '');
    if (/\bpinterest\b/i.test(t) && !/^\s*(apa|siapa|kenapa|bagaimana|gimana|kapan|dimana)\b/i.test(t)) return true;
    return TOOL_INTENT_RE.test(t) && TOOL_VERB_RE.test(t);
}

const NO_TOOL_MODEL_RE = /safeguard/i;

function buildGroqSystemPrompt(profile, groups = []) {
    const now = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
    const persona = getVar('persona');
    const personaBlock = persona ? `\n\nGAYA / PERSONA KHUSUS dari pemilik bot ini (ikuti selama tidak melanggar aturan di atas):\n${persona}` : '';
    return buildSystemPrompt(profile) + composeToolRules(groups) + personaBlock + `\n\nWaktu sekarang: ${now} (WIB).`;
}

function stripSpeakerLabel(t) {
    return String(t || '').replace(/^\s*\[[^\]\n]{1,40}\]:\s*/, '');
}

function cleanModelText(t) {
    return stripSpeakerLabel(String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim());
}

async function ZackAiGroq(pushname, text, z, zack, extra = {}) {
    assertIntact();
    const jid = z.key.remoteJid;
    try {
        const apiKey = getGroqKey();
        if (!apiKey) throw new Error('GROQ_API_KEY belum diset');

        const userId = z.sender.split('@')[0];
        const profile = touchProfile(userId, pushname, text);
        profile.isGroup = jid.endsWith('@g.us');
        profile.isOwnerUser = await isOwner(zack, z.sender).catch(() => false);
        console.log(`[USER] ${profile.name || '(tanpa nama)'}${profile.isOwnerUser ? ' [owner]' : ''}${profile.nicknameChanged ? ' (nama baru disimpan)' : ''}`);
        const historyFile = chatHistoryFile(jid);
        let chatHistory = loadHistory(historyFile, (m) => !(m && typeof m.content === 'string' && hasToolMarkup(m.content)));
        const maxHist = Math.max(2, parseInt(process.env.AI_HISTORY) || 10);
        if (chatHistory.length > maxHist) chatHistory = chatHistory.slice(-maxHist);
        chatHistory = chatHistory.map((m, i) =>
            i < chatHistory.length - 2 && typeof m.content === 'string' && m.content.length > 500 ? { ...m, content: m.content.slice(0, 500) + '…' } : m
        );
        const speaker = (profile.name || pushname || userId).replace(/[\[\]\n]/g, ' ').trim().slice(0, 30);
        const label = (t) => (profile.isGroup ? `[${speaker}]: ${t}` : t);

        let imageUrl = null;
        if (extra.getImage) {
            const img = await extra.getImage();
            if (img && img.length) {
                if (img.length > 3 * 1024 * 1024) {
                    await zack.sendMessage(jid, { text: 'Gambarnya terlalu besar (maks ±3MB). Coba kirim yang lebih kecil ya 🙏' }, { quoted: null });
                    return;
                }
                imageUrl = `data:${extra.imageMime || 'image/jpeg'};base64,${img.toString('base64')}`;
            }
        }

        const userMessage = imageUrl
            ? { role: 'user', content: [{ type: 'text', text: label(text) }, { type: 'image_url', image_url: { url: imageUrl } }] }
            : { role: 'user', content: label(text) };

        const sel = selectTools({ text: imageUrl ? '' : text, history: chatHistory, tools: getTools() });
        const plainChat = !sel.groups.length;
        console.log(`[AI] tool: ${sel.tools.map((t) => t.function.name).join(', ')}${plainChat ? ' (obrolan biasa)' : ''}`);

        const makingImage = sel.groups.includes('imagemake');
        const histForCall = makingImage ? chatHistory.slice(-4) : chatHistory;
        const messages = [{ role: 'system', content: buildGroqSystemPrompt(profile, sel.groups) }, ...histForCall, userMessage];
        const models = imageUrl ? getVisionModels() : plainChat ? getChatModels() : makingImage ? getCodeModels() : getGroqModels();
        const ctx = { zack, z, jid };

        const wantsTool = !imageUrl && !plainChat && looksLikeToolRequest(text);
        const toolModels = models.filter((m) => !NO_TOOL_MODEL_RE.test(m));
        let reprompted = false;
        let usedTool = false;
        let sentOk = false;
        let sentQuiet = false;
        let lastError = '';
        let ytFails = 0;

        let finalText = '';
        for (let step = 0; step < MAX_TOOL_STEPS; step++) {
            const isLast = step === MAX_TOOL_STEPS - 1;
            const body = { messages, temperature: 0.4, max_tokens: makingImage ? 3000 : 1500 };
            if (!isLast) {
                body.tools = sel.tools;
                body.tool_choice = step === 0 && wantsTool ? 'required' : 'auto';
            }
            const useModels = !isLast && toolModels.length ? toolModels : models;

            let res;
            try {
                res = await groqChat({ apiKey, models: useModels, body, allowEmpty: sentQuiet || !!lastError });
            } catch (e) {
                if (body.tool_choice === 'required' && e instanceof AllModelsBusyError) {
                    console.log('[GROQ] tool_choice=required ditolak, ulang dengan auto');
                    body.tool_choice = 'auto';
                    res = await groqChat({ apiKey, models: useModels, body, allowEmpty: sentQuiet || !!lastError });
                } else if (e instanceof AllModelsBusyError && step === 0 && plainChat && !imageUrl && cfChatConfigured()) {
                    console.log('[AI] semua model Groq limit, pakai cadangan Cloudflare');
                    const cf = await cfChat({ messages });
                    console.log(`[AI] dijawab oleh cadangan ${cf.model}`);
                    finalText = cleanModelText(cf.text);
                    break;
                } else {
                    throw e;
                }
            }
            const { data, model } = res;
            const msg = data.choices[0].message;
            console.log(`[GROQ] step ${step + 1} dijawab oleh ${model}`);

            let calls = msg.tool_calls && msg.tool_calls.length ? msg.tool_calls : null;
            let content = msg.content || '';
            const parsed = extractTextToolCalls(content);
            if (!calls && parsed.calls.length) {
                calls = parsed.calls;
                console.log(`[TOOL] ${calls.length} tool call dipulihkan dari teks (${model})`);
            }
            content = parsed.hadMarkup ? parsed.text : content;

            if (calls && !isLast) {
                messages.push({ role: 'assistant', content: cleanModelText(content), tool_calls: calls });
                for (const call of calls) {
                    let args = {};
                    try {
                        args = JSON.parse(call.function.arguments || '{}');
                    } catch {}
                    args = coerceArgs(call.function.name, args, getTools());
                    console.log(`[TOOL] ${call.function.name}`, JSON.stringify(args));
                    await zack.sendPresenceUpdate('composing', jid).catch(() => {});
                    let output;
                    if (premium.isPremiumTool(call.function.name) && !(await premium.hasAccess(zack, z.sender || z.key.participant || jid))) {
                        output = JSON.stringify({ ok: false, error: 'Fitur ini khusus pengguna premium.', hint: 'Sampaikan ke user bahwa fitur ini khusus premium dan arahkan menghubungi owner bot.' });
                    } else if (/^send_youtube/.test(call.function.name) && ytFails >= 1) {
                        output = JSON.stringify({ ok: false, error: lastError || 'unduhan gagal', hint: 'Berhenti mencoba. Sampaikan kegagalan ke user.' });
                    } else {
                        output = await executeTool(call.function.name, args, ctx);
                    }
                    usedTool = true;
                    try {
                        const o = JSON.parse(output);
                        if (o.ok === false) {
                            lastError = o.error || lastError;
                            if (/^send_youtube/.test(call.function.name)) ytFails++;
                        } else if (o.sent) {
                            sentOk = true;
                            if (o.quiet) sentQuiet = true;
                        }
                    } catch {}
                    messages.push({ role: 'tool', tool_call_id: call.id, content: output });
                }
                continue;
            }

            if (parsed.hadMarkup && !cleanModelText(content) && !reprompted && !isLast) {
                reprompted = true;
                console.log('[TOOL] markup tidak terbaca, minta model mengulang');
                messages.push({
                    role: 'user',
                    content:
                        '(sistem) Panggilan tool tadi salah format dan tidak berjalan. Panggil tool lewat function calling resmi, ' +
                        'jangan menulis tag apa pun di teks. Lanjutkan permintaan user yang sama.',
                });
                continue;
            }

            finalText = cleanModelText(content);
            break;
        }

        if (!finalText && sentQuiet && !lastError) {
            chatHistory.push({ role: 'user', content: label(imageUrl ? `[mengirim gambar] ${text}` : text) });
            chatHistory.push({ role: 'assistant', content: '[mengirim pesan interaktif]' });
            saveHistory(historyFile, chatHistory);
            return '';
        }

        if (!finalText) {
            if (sentOk) finalText = 'Sudah selesai ✅';
            else if (lastError) finalText = `Maaf, gagal menjalankannya 😔\n_${lastError.slice(0, 200)}_`;
            else finalText = 'Maaf, aku belum berhasil menjalankan itu. Coba kirim lagi ya 🙏';
        }
        const result = formatCodeBlocks(finalText);

        chatHistory.push({ role: 'user', content: label(imageUrl ? `[mengirim gambar] ${text}` : text) });
        chatHistory.push({ role: 'assistant', content: result });
        saveHistory(historyFile, chatHistory);

        await sendAiMessage(result, z, zack);
        return result;
    } catch (e) {
        console.log('Groq AI Error:', e?.response?.data || e.message);
        let msg = 'Maaf AI sedang sibuk atau API limit.';
        if (e instanceof AllModelsBusyError) {
            const mins = Math.max(1, Math.ceil(e.waitMs / 60000));
            msg = `Semua model AI lagi kena limit. Coba lagi sekitar ${mins} menit ya 🙏`;
        }
        await zack.sendMessage(jid, { text: msg }, { quoted: null });
    }
}

async function ZackAi(pushname, text, z, zack, extra = {}) {
    if (!getGroqKey()) {
        console.log('GROQ_API_KEY belum diset (isi di .env)');
        await zack.sendMessage(
            z.key.remoteJid,
            { text: 'AI belum aktif: GROQ_API_KEY belum diisi di server bot 🙏' },
            { quoted: null }
        );
        return;
    }
    return ZackAiGroq(pushname, text, z, zack, extra);
}

module.exports = { ZackAi, sendAiMessage };

let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(chalk.redBright(`Update ${__filename}`));
    delete require.cache[file];
    require(file);
});