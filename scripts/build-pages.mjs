import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLicensePlans } from '../license-plans.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'dist');
const output = resolve(root, 'work/pages-site');
const config = JSON.parse(await readFile(resolve(root, 'site.config.json'), 'utf8'));
const sourceHtml = await readFile(resolve(source, 'index.html'), 'utf8');

function publicHttpsUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

if (!/<html(?:\s|>)/i.test(sourceHtml)) throw new Error('A página precisa de um elemento html.');
const html = sourceHtml.replace(/<html(\s|>)/i, '<html data-hosting="static"$1');
const downloadUrl = publicHttpsUrl(config.downloadUrl);
const plans = getLicensePlans(config);
const product = {
  price: plans[0].price,
  currency: /^[A-Z]{3}$/.test(config.currency) ? config.currency : 'BRL',
  downloads: null,
  downloadAvailable: Boolean(downloadUrl),
  checkoutAvailable: plans[0].checkoutAvailable,
  downloadUrl,
  checkoutUrl: plans[0].checkoutUrl,
  plans
};

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
await writeFile(resolve(output, 'index.html'), html, 'utf8');
await writeFile(resolve(output, 'product.json'), JSON.stringify(product, null, 2) + '\n', 'utf8');
await writeFile(resolve(output, '.nojekyll'), '', 'utf8');
await writeFile(resolve(output, 'CNAME'), 'lum4.app\n', 'utf8');

console.log('Site estático do LUM4 preparado em work/pages-site.');
