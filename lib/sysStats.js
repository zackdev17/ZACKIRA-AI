/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const os = require('os');
const fs = require('fs');

const MAX_SAMPLES = 36;
const SAMPLE_EVERY_MS = 5000;
const history = [];

function readCpuTimes() {
    let idle = 0;
    let total = 0;
    for (const c of os.cpus()) {
        for (const v of Object.values(c.times)) total += v;
        idle += c.times.idle;
    }
    return { idle, total };
}

function readNet() {
    try {
        let rx = 0;
        let tx = 0;
        for (const line of fs.readFileSync('/proc/net/dev', 'utf8').split('\n')) {
            if (!line.includes(':')) continue;
            const [name, rest] = line.split(':');
            if (name.trim() === 'lo') continue;
            const p = rest.trim().split(/\s+/);
            rx += parseInt(p[0], 10) || 0;
            tx += parseInt(p[8], 10) || 0;
        }
        return { rx, tx };
    } catch {
        return { rx: 0, tx: 0 };
    }
}

function readDisk() {
    try {
        const s = fs.statfsSync(process.cwd());
        const total = s.blocks * s.bsize;
        const free = s.bavail * s.bsize;
        return { total, used: Math.max(0, total - free) };
    } catch {
        return { total: 0, used: 0 };
    }
}

function readMemory() {
    const total = os.totalmem();
    const free = os.freemem();
    return { total, used: Math.max(0, total - free) };
}

function cpuSpeed() {
    const speed = os.cpus()[0]?.speed;
    return speed && speed > 0 ? `${Math.round(speed)} MHz` : 'Virtual';
}

function pushSample(point) {
    history.push(point);
    while (history.length > MAX_SAMPLES) history.shift();
}

let lastCpu = readCpuTimes();
let timer = null;

function startSampler() {
    if (timer) return;
    timer = setInterval(() => {
        const now = readCpuTimes();
        const dt = now.total - lastCpu.total;
        const di = now.idle - lastCpu.idle;
        lastCpu = now;
        const mem = readMemory();
        pushSample({ t: Date.now(), cpu: dt > 0 ? (1 - di / dt) * 100 : 0, ram: mem.total ? (mem.used / mem.total) * 100 : 0 });
    }, SAMPLE_EVERY_MS);
    timer.unref();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sampleLive(windowMs = 500) {
    const c1 = readCpuTimes();
    const n1 = readNet();
    const t1 = Date.now();
    await sleep(windowMs);
    const c2 = readCpuTimes();
    const n2 = readNet();
    const secs = Math.max(0.05, (Date.now() - t1) / 1000);
    const dt = c2.total - c1.total;
    const di = c2.idle - c1.idle;
    const cpu = dt > 0 ? Math.min(100, Math.max(0, (1 - di / dt) * 100)) : 0;
    const mem = readMemory();
    const disk = readDisk();
    const cpus = os.cpus();
    const live = {
        cpu,
        cpuCores: cpus.length,
        cpuModel: (cpus[0]?.model || 'Virtual CPU').replace(/\(R\)|\(TM\)|CPU|@/g, '').replace(/\s+/g, ' ').trim(),
        cpuSpeed: cpuSpeed(),
        ramTotal: mem.total,
        ramUsed: mem.used,
        diskTotal: disk.total,
        diskUsed: disk.used,
        rxRate: Math.max(0, (n2.rx - n1.rx) / secs),
        txRate: Math.max(0, (n2.tx - n1.tx) / secs),
        rxTotal: n2.rx,
        txTotal: n2.tx,
        botMem: process.memoryUsage().rss,
        uptimeBot: process.uptime(),
        uptimeServer: os.uptime(),
        platform: os.type() === 'Darwin' ? 'macOS' : os.type() === 'Windows_NT' ? 'Windows' : os.type(),
        arch: os.arch(),
        nodeVersion: process.version,
        load: os.loadavg()[0],
    };
    pushSample({ t: Date.now(), cpu, ram: live.ramTotal ? (live.ramUsed / live.ramTotal) * 100 : 0 });
    live.history = history.slice();
    return live;
}

startSampler();

module.exports = { sampleLive, startSampler };
