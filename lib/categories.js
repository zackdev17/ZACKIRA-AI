/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const CATEGORIES = [
    { id: 'umum', title: 'Menu Umum', icon: '📌', desc: 'Menu, info, dan status bot' },
    { id: 'grup', title: 'Menu Grup', icon: '👥', desc: 'Admin grup dan proteksi' },
    { id: 'owner', title: 'Menu Owner', icon: '👑', desc: 'Pengaturan khusus pemilik bot' },
    { id: 'jadibot', title: 'Menu Jadibot', icon: '🤖', desc: 'Sewa bot dan premium' },
];

const byId = (id) => CATEGORIES.find((c) => c.id === id) || null;
const categoryOf = (cmd) => cmd.category || 'umum';

module.exports = { CATEGORIES, byId, categoryOf };
