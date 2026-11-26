// node render_evoce_ci.mjs <pastaSite> <outDir> [workers=2]
// Renderiza uma página estática 1920x1080 a 30 fps em JPEGs compostos pelo site.
import http from 'http';
import fs from 'fs';
import path from 'path';

const pastaSite = process.argv[2];
const outDir = path.resolve(process.argv[3] || 'frames');
const workers = Math.max(1, Number(process.argv[4] || 2));

if (!pastaSite || !Number.isInteger(workers)) {
  console.error('Uso: node render_evoce_ci.mjs <pastaSite> <outDir> [workers=2]');
  process.exit(1);
}

const root = path.resolve(pastaSite);
if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error(`index.html não encontrado em ${root}`);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const mime = (p) => {
  if (p.endsWith('.js') || p.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (p.endsWith('.json')) return 'application/json; charset=utf-8';
  if (p.endsWith('.css')) return 'text/css; charset=utf-8';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
  if (p.endsWith('.webp')) return 'image/webp';
  if (p.endsWith('.m4a')) return 'audio/mp4';
  if (p.endsWith('.mp3')) return 'audio/mpeg';
  return 'text/html; charset=utf-8';
};

const srv = http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '');
  } catch {
    res.writeHead(400);
    return res.end('Bad request');
  }
  const full = path.resolve(root, rel);
  const relative = path.relative(root, full);
  const withinRoot = relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  if (!withinRoot || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    res.writeHead(404);
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': mime(full) });
  fs.createReadStream(full).pipe(res);
});

await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${srv.address().port}/index.html`;
let browser;

try {
  const pwPath = process.env.PW_MODULE || 'playwright';
  const { chromium } = await import(pwPath);
  browser = await chromium.launch({
    executablePath: process.env.CHROME || undefined,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  async function openPage() {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(
        () => window.ready && typeof window.renderFrame === 'function' && typeof window.capturaFrame === 'function',
        null,
        { timeout: 60000 },
      );
      await page.evaluate(() => document.body.classList.add('frame'));
      return page;
    } catch (err) {
      await page.close();
      throw err;
    }
  }

  const probe = await openPage();
  const duration = await probe.evaluate(() => window.DURACAO);
  await probe.close();
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`window.DURACAO inválida: ${duration}`);
  }

  const totalFrames = Math.ceil(duration * 30);
  const shardIdx = Math.max(0, Number(process.env.SHARD || 0));
  const shardCount = Math.max(1, Number(process.env.SHARDS || 1));
  const perShard = Math.ceil(totalFrames / shardCount);
  const shardStart = shardIdx * perShard;
  const shardEnd = Math.min(totalFrames - 1, shardStart + perShard - 1);
  const shardTotal = Math.max(0, shardEnd - shardStart + 1);
  const nWorkers = Math.min(workers, shardTotal);
  const perWorker = Math.ceil(shardTotal / Math.max(1, nWorkers));

  console.log(`${pastaSite}: ${duration}s, ${totalFrames} frames, shard ${shardIdx}/${shardCount} [${shardStart}..${shardEnd}], ${nWorkers} workers`);
  await Promise.all(Array.from({ length: nWorkers }, async (_, wi) => {
    const start = shardStart + wi * perWorker;
    const end = Math.min(shardEnd, start + perWorker - 1);
    if (start > end) return;
    const page = await openPage();
    try {
      for (let f = start; f <= end; f++) {
        await page.evaluate((t) => window.renderFrame(t), f / 30);
        const b64 = await page.evaluate(() => window.capturaFrame());
        fs.writeFileSync(path.join(outDir, `f_${String(f).padStart(6, '0')}.jpg`), Buffer.from(b64, 'base64'));
        if ((f - start) % 100 === 0 || f === end) console.log(`[W${wi}] frame ${f}/${end}`);
      }
    } finally {
      await page.close();
    }
  }));
} finally {
  if (browser) await browser.close();
  srv.close();
}
