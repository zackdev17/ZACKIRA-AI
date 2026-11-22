/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const GROUPS = {
    media: {
        re: /\b(lagu|mp3|audio|musik|lirik|video|youtube|yt|spotify|tiktok|instagram|reels?|mv|klip|putar(?:kan)?|download|unduh|podcast|soundtrack|ost|ngaji|murottal|sholawat|remix|cover|playlist)\b/i,
        tools: ['search_youtube', 'send_youtube_audio', 'send_youtube_video', 'send_youtube_carousel'],
    },
    imagefind: {
        re: /\b(pinterest|wallpaper|foto|gambar|pic|image|picture|meme|aesthetic|estetik)\b/i,
        tools: ['search_pinterest', 'send_pinterest', 'send_image'],
    },
    imagemake: {
        re: /\b(gambar(?:kan)?|foto|lukis(?:kan)?|desain(?:kan)?|generate|ilustrasi|poster|logo|infografis|infografik|diagram|bagan|ikon|icon|sketsa|anime|kartun|kartu ucapan|banner|thumbnail|wallpaper)\b/i,
        tools: ['draw_image', 'generate_image', 'send_list_image', 'send_table_image'],
    },
    interactive: {
        re: /\b(tombol|button|pilihan|opsi|menu|carousel|geser|lokasi|location|peta|maps?|alamat|salin|copy|hubungi|telepon|telpon|quick reply)\b/i,
        tools: ['send_buttons', 'send_list', 'send_carousel', 'send_location'],
    },
};

const BASE = ['search_links'];

const FIND_RE = /\b(cari(?:kan|in)?|pinterest|referensi|inspirasi|meme)\b/i;
const CREATE_RE = /\b(buat(?:kan|in)?|bikin(?:kan)?|gambarkan|lukis(?:kan)?|desain(?:kan)?|generate|ilustrasikan|rancang)\b/i;
const AS_IMAGE_RE = /\b(bentuk|jadi|sebagai|dalam|versi|format)\s+(gambar|image|foto|infografis)\b|\binfograf(?:is|ik)\b/i;

const LINK_RE = /\b(link|tautan|url|artikel|berita|situs|website|web|referensi|sumber|blog)\b/i;

const clip = (s, n) => String(s || '').slice(0, n);

function selectTools({ text, history = [], tools }) {
    const recent = history
        .slice(-2)
        .map((m) => (typeof m.content === 'string' ? clip(m.content, 400) : ''))
        .join('\n');
    const hay = `${text || ''}\n${recent}`;
    let groups = Object.keys(GROUPS).filter((g) => GROUPS[g].re.test(hay));
    if (groups.includes('imagefind') && groups.includes('imagemake')) {
        const t = String(text || '');
        if (AS_IMAGE_RE.test(t) || (CREATE_RE.test(t) && !FIND_RE.test(t))) groups = groups.filter((g) => g !== 'imagefind');
        else if (FIND_RE.test(t) && !CREATE_RE.test(t)) groups = groups.filter((g) => g !== 'imagemake');
    }

    const names = new Set(BASE);
    if ((groups.includes('imagefind') || groups.includes('imagemake')) && !LINK_RE.test(String(text || ''))) names.delete('search_links');
    for (const g of groups) GROUPS[g].tools.forEach((n) => names.add(n));
    return { tools: tools.filter((t) => names.has(t.function.name)), groups };
}

module.exports = { selectTools, GROUPS };
