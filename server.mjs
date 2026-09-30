import { createServer } from 'node:http';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLicensePlans } from './license-plans.mjs';
import { resolvePublicFile } from './public-files.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(root, 'dist');
const configPath = resolve(root, 'site.config.json');
const counterPath = process.env.LUM4_COUNTER_FILE || resolve(root, 'data/downloads.json');
const port = Number(process.env.PORT || 4178);
const host = process.env.HOST || '127.0.0.1';
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/vnd.microsoft.icon', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.avif': 'image/avif' };
let counterQueue = Promise.resolve();

function validUrl(value) {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
async function getConfig() {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const plans = getLicensePlans(config, process.env.LUM4_CHECKOUT_URL || config.checkoutUrl);
  return {
    price: plans[0].price,
    currency: /^[A-Z]{3}$/.test(config.currency) ? config.currency : 'BRL',
    downloadUrl: validUrl(config.downloadUrl),
    checkoutUrl: plans[0].checkoutUrl,
    plans
  };
}
async function getCount() {
  const data = JSON.parse(await readFile(counterPath, 'utf8'));
  if (!Number.isSafeInteger(data.total) || data.total < 0) throw new Error('Invalid counter');
  return data.total;
}
function incrementCount() {
  const next = counterQueue.then(async () => {
    const total = await getCount();
    const temp = `${counterPath}.tmp`;
    await writeFile(temp, JSON.stringify({ total: total + 1 }, null, 2) + '\n', 'utf8');
    await rename(temp, counterPath);
  });
  counterQueue = next.catch(() => {});
  return next;
}
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; img-src 'self' data:; style-src 'self'; style-src-attr 'none'; script-src 'self'; script-src-attr 'none'; connect-src 'self' https://lum-4-license-server.vercel.app https://api.github.com; frame-ancestors 'none'");
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return json(res, 405, { error: 'Método indisponível.' }); }
    const { pathname, searchParams } = new URL(req.url, 'http://localhost');
    if (pathname === '/api/product') {
      const config = await getConfig();
      await counterQueue;
      return json(res, 200, { price: config.price, currency: config.currency, downloads: await getCount(), downloadAvailable: Boolean(config.downloadUrl), checkoutAvailable: Boolean(config.checkoutUrl), plans: config.plans.map(({ devices, price, checkoutAvailable }) => ({ devices, price, checkoutAvailable })) });
    }
    if (pathname === '/api/download' || pathname === '/api/checkout') {
      const config = await getConfig();
      const download = pathname === '/api/download';
      const plan = config.plans.find(item => item.devices === Number(searchParams.get('devices') || 1));
      if (!download && !plan) return json(res, 400, { error: 'Licença inválida.' });
      const target = download ? config.downloadUrl : plan.checkoutUrl;
      if (!target) return json(res, 409, { error: download ? 'O link de download não está disponível nesta página.' : 'O link de pagamento desta licença não está disponível nesta página.' });
      if (download && req.method === 'GET') await incrementCount();
      res.writeHead(302, { Location: target, 'Cache-Control': 'no-store' });
      return res.end();
    }
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { return json(res, 400, { error: 'Endereço inválido.' }); }
    const file = await resolvePublicFile(publicRoot, decoded === '/' ? 'index.html' : decoded.slice(1));
    if (!file) return json(res, 404, { error: 'Página não encontrada.' });
    const { path, info } = file;
    res.writeHead(200, { 'Content-Type': contentTypes[extname(path).toLowerCase()] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': path.includes('/assets/') ? 'public, max-age=3600' : 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    res.end(await readFile(path));
  } catch {
    if (!res.headersSent) json(res, 503, { error: 'Serviço temporariamente indisponível.' });
    else res.end();
  }
});
server.on('error', error => { console.error(`Não foi possível abrir a prévia: ${error.message}`); process.exitCode = 1; });
server.listen(port, host, () => { console.log(`LUM4 — prévia local: http://${host}:${server.address().port}`); });
