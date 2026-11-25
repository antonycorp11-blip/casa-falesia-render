// node render_filme_ci.mjs <pastaFilme> <outDir> [workers=2] [maxFrames=0]
// Renderiza um filme 3D multi-capítulo 16:9 (1920x1080 @ 30fps) usando <pastaFilme>/filme.json
import http from 'http';
import fs from 'fs';
import path from 'path';

const pwPath = process.env.PW_MODULE || 'playwright';
const { chromium } = await import(pwPath);

const pasta = process.argv[2];
const outDir = path.resolve(process.argv[3] || 'frames');
const workers = Math.max(1, +(process.argv[4] || 2));
const maxFrames = +(process.argv[5] || 0);

if (!pasta) {
  console.error('Uso: node render_filme_ci.mjs <pastaFilme> <outDir> [workers] [maxFrames]');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname);
const manifestPath = path.join(root, pasta, 'filme.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const W = manifest.width || 1920;
const H = manifest.height || 1080;
const FPS = manifest.fps || 30;
const chapters = manifest.chapters;
const fullTotal = manifest.totalFrames;
const totalFrames = maxFrames > 0 ? Math.min(fullTotal, maxFrames) : fullTotal;

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
  const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '');
  const full = path.join(root, rel);
  if (!full.startsWith(root) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404);
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': mime(full) });
  fs.createReadStream(full).pipe(res);
}).listen(0, '127.0.0.1');

await new Promise((r) => srv.on('listening', r));
const port = srv.address().port;

function locateFrame(globalFrame) {
  for (const ch of chapters) {
    if (globalFrame >= ch.startFrame && globalFrame < ch.startFrame + ch.frames) {
      return { ch, localFrame: globalFrame - ch.startFrame };
    }
  }
  const last = chapters[chapters.length - 1];
  return { ch: last, localFrame: last.frames - 1 };
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
});

const errors = [];

try {
  const shardIdx = Math.max(0, +(process.env.SHARD || 0));
  const shardCount = Math.max(1, +(process.env.SHARDS || 1));
  const perShard = Math.ceil(totalFrames / shardCount);
  const shardStart = shardIdx * perShard;
  const shardEnd = Math.min(totalFrames - 1, shardStart + perShard - 1);
  const shardTotal = Math.max(0, shardEnd - shardStart + 1);
  const nWorkers = Math.min(workers, Math.max(1, shardTotal));
  const perWorker = Math.ceil(shardTotal / nWorkers);

  console.log(`Filme ${pasta}: ${W}x${H} @ ${FPS}fps, total=${totalFrames}, shard=${shardIdx}/${shardCount} [${shardStart}..${shardEnd}] (${shardTotal} quadros), ${nWorkers} workers`);
  const t0 = Date.now();

  await Promise.all(
    Array.from({ length: nWorkers }, async (_, wi) => {
      const a = shardStart + wi * perWorker;
      const z = Math.min(shardEnd, a + perWorker - 1);
      if (a > z) return;

      let pg = null;
      let loadedDir = null;

      async function ensureChapter(chDir) {
        if (loadedDir === chDir && pg) return;
        if (pg) { await pg.close(); pg = null; }
        pg = await browser.newPage({ viewport: { width: W, height: H } });
        pg.on('pageerror', (e) => {
          console.error(`W${wi} [${chDir}] PAGEERROR:`, e.message);
          errors.push(`${chDir}: ${e.message}`);
        });
        const url = `http://127.0.0.1:${port}/${pasta}/${chDir}/index.html?t=0&clean=1`;
        await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await pg.waitForFunction(() => window.ready && typeof window.renderFrame === 'function', null, { timeout: 60000 });
        loadedDir = chDir;
        console.log(`[W${wi}] Loaded ${chDir}`);
      }

      for (let f = a; f <= z; f++) {
        const { ch, localFrame } = locateFrame(f);
        await ensureChapter(ch.dir);
        const localT = localFrame / FPS;
        const b64 = await pg.evaluate((ts) => {
          window.renderFrame(ts);
          if (window.capturaFrame) return window.capturaFrame();
          const c = document.querySelector('canvas#c, canvas');
          return c.toDataURL('image/jpeg', 0.92).split(',')[1];
        }, localT);
        fs.writeFileSync(path.join(outDir, `f${String(f).padStart(6, '0')}.jpg`), Buffer.from(b64, 'base64'));
        if ((f - a) % 100 === 0 || f === z) {
          const done = f - a + 1;
          const spf = ((Date.now() - t0) / 1000 / done).toFixed(3);
          console.log(`[W${wi}] frame ${f}/${z} (${ch.dir} t=${localT.toFixed(2)}s, ${done}/${z - a + 1}, ${spf} s/q)`);
        }
      }
      if (pg) await pg.close();
    })
  );

  if (errors.length) throw new Error(`Page errors during render: ${errors.join('; ')}`);
  console.log(`Shard ${shardIdx} concluído (${shardTotal} quadros) em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} finally {
  await browser.close();
  srv.close();
}
