import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { request } from 'node:http';
import { createInterface } from 'node:readline';
import { isAllowedPublicFile, listPublicFiles, resolvePublicFile } from '../public-files.mjs';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function fixture(t) {
  const directory = await mkdtemp(resolve(tmpdir(), 'lum4-security-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(resolve(directory, 'dist/assets'), { recursive: true });
  await mkdir(resolve(directory, 'scripts'));
  for (const name of ['server.mjs', 'license-plans.mjs', 'public-files.mjs', 'scripts/build-pages.mjs']) {
    await copyFile(resolve(root, name), resolve(directory, name));
  }
  await writeFile(resolve(directory, 'dist/index.html'), '<!doctype html><html><head><title>Fixture</title></head><body></body></html>');
  await writeFile(resolve(directory, 'dist/app.js'), 'export {};');
  await writeFile(resolve(directory, 'dist/locales.js'), 'export {};');
  await writeFile(resolve(directory, 'dist/styles.css'), 'body { color: black; }');
  await writeFile(resolve(directory, 'dist/assets/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  await writeFile(resolve(directory, 'site.config.json'), JSON.stringify({ price: 14.99, currency: 'BRL', downloadUrl: 'https://example.invalid/LUM4.dmg', checkoutUrl: null }));
  await writeFile(resolve(directory, 'counter.json'), '{"total":0}');
  return directory;
}

function http(port, method, path) {
  return new Promise((resolveRequest, reject) => {
    const req = request({ hostname: '127.0.0.1', port, method, path }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolveRequest({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('A prévia local não respondeu.')));
    req.end();
  });
}

async function startServer(t, directory) {
  const child = spawn(process.execPath, [resolve(directory, 'server.mjs')], {
    cwd: directory,
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', LUM4_COUNTER_FILE: resolve(directory, 'counter.json') },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => new Promise(resolveExit => {
    if (child.exitCode !== null || child.signalCode !== null) return resolveExit();
    child.once('exit', resolveExit);
    child.kill();
  }));
  const lines = createInterface({ input: child.stdout });
  const port = await new Promise((resolvePort, reject) => {
    const timer = setTimeout(() => reject(new Error('A prévia local não iniciou.')), 5000);
    child.once('error', reject);
    child.once('exit', () => reject(new Error('A prévia local encerrou antes de iniciar.')));
    lines.on('line', line => {
      const match = line.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) { clearTimeout(timer); resolvePort(Number(match[1])); }
    });
  });
  lines.close();
  return port;
}

test('public file policy accepts website resources and rejects private paths', () => {
  for (const path of ['index.html', 'app.js', 'locales.js', 'styles.css', 'favicon.ico', 'favicon-v4.ico', 'assets/logo.svg', 'assets/photos/sunrise.webp']) assert.equal(isAllowedPublicFile(path), true, path);
  for (const path of ['../site.config.json', '.env.local', 'site.config.json', 'assets/.env', 'assets/code.js', 'assets/image.png.bak', 'assets/image.backup.png', 'assets/image.png~', 'assets/../app.js', 'assets\\logo.svg', '/app.js']) assert.equal(isAllowedPublicFile(path), false, path);
});

test('static file lookup rejects symlinks to files and directories', async t => {
  const directory = await fixture(t);
  const source = resolve(directory, 'dist');
  await writeFile(resolve(directory, 'private-marker'), 'NON_SECRET_AUDIT_MARKER');
  await symlink(resolve(directory, 'private-marker'), resolve(source, 'assets/outside.png'));
  await symlink(resolve(source, 'assets/logo.svg'), resolve(source, 'assets/inside.svg'));
  await symlink(resolve(source, 'assets'), resolve(source, 'assets/linked'));
  for (const path of ['assets/outside.png', 'assets/inside.svg', 'assets/linked/logo.svg']) assert.equal(await resolvePublicFile(source, path), null, path);
  assert.ok(await resolvePublicFile(source, 'assets/logo.svg'));
  await assert.rejects(listPublicFiles(source), /rejeitado/);
});

test('static build aborts before publishing hidden, backup, unrelated or linked files', async t => {
  for (const kind of ['hidden', 'backup', 'unrelated', 'symlink']) {
    await t.test(kind, async subtest => {
      const directory = await fixture(subtest);
      const source = resolve(directory, 'dist');
      if (kind === 'hidden') await writeFile(resolve(source, '.env.local'), 'NON_SECRET_AUDIT_MARKER');
      if (kind === 'backup') await writeFile(resolve(source, 'assets/logo.backup.svg'), 'NON_SECRET_AUDIT_MARKER');
      if (kind === 'unrelated') await writeFile(resolve(source, 'private.txt'), 'NON_SECRET_AUDIT_MARKER');
      if (kind === 'symlink') {
        await writeFile(resolve(directory, 'private-marker'), 'NON_SECRET_AUDIT_MARKER');
        await symlink(resolve(directory, 'private-marker'), resolve(source, 'assets/outside.png'));
      }
      await assert.rejects(run(process.execPath, [resolve(directory, 'scripts/build-pages.mjs')]), /rejeitado/);
      await assert.rejects(readFile(resolve(directory, 'work/pages-site/index.html')), { code: 'ENOENT' });
    });
  }
});

test('valid static build publishes expected files and keeps unsafe URLs unavailable', async t => {
  const directory = await fixture(t);
  await writeFile(resolve(directory, 'site.config.json'), JSON.stringify({ price: 14.99, currency: 'BRL', downloadUrl: 'javascript:alert(1)', checkoutUrl: 'https://user:password@example.invalid/' }));
  await run(process.execPath, [resolve(directory, 'scripts/build-pages.mjs')]);
  const output = resolve(directory, 'work/pages-site');
  const html = await readFile(resolve(output, 'index.html'), 'utf8');
  const product = JSON.parse(await readFile(resolve(output, 'product.json'), 'utf8'));
  assert.match(html, /<html data-hosting="static">/);
  assert.equal(product.downloadUrl, null);
  assert.equal(product.checkoutUrl, null);
  assert.equal(product.downloads, null);
  assert.equal(await readFile(resolve(output, 'CNAME'), 'utf8'), 'lum4.app\n');
  assert.match(await readFile(resolve(output, 'assets/logo.svg'), 'utf8'), /<svg/);
});

test('local server confines files, redirects to configured URLs and preserves read-only HEAD', async t => {
  const directory = await fixture(t);
  await writeFile(resolve(directory, 'private-marker'), 'NON_SECRET_AUDIT_MARKER');
  await symlink(resolve(directory, 'private-marker'), resolve(directory, 'dist/assets/outside.png'));
  const port = await startServer(t, directory);
  const page = await http(port, 'GET', '/');
  assert.equal(page.status, 200);
  assert.equal(page.headers['x-content-type-options'], 'nosniff');
  assert.equal(page.headers['x-frame-options'], 'DENY');
  assert.equal(page.headers['referrer-policy'], 'no-referrer');
  assert.equal(page.headers['permissions-policy'], 'camera=(), microphone=(), geolocation=()');
  assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(page.headers['content-security-policy'], /style-src-attr 'none'/);
  assert.doesNotMatch(page.headers['content-security-policy'], /unsafe-inline|upgrade-insecure-requests/);
  for (const path of ['/%2e%2e%2fsite.config.json', '/%252e%252e%252fsite.config.json', '/site.config.json', '/.env', '/%00', '/assets/outside.png']) assert.equal((await http(port, 'GET', path)).status, 404, path);
  assert.equal((await http(port, 'GET', '/%')).status, 400);
  assert.equal((await http(port, 'POST', '/api/download')).status, 405);
  const head = await http(port, 'HEAD', '/api/download');
  assert.equal(head.status, 302);
  assert.equal(head.body, '');
  assert.equal(JSON.parse(await readFile(resolve(directory, 'counter.json'), 'utf8')).total, 0);
  const download = await http(port, 'GET', '/api/download?url=https://attacker.invalid');
  assert.equal(download.headers.location, 'https://example.invalid/LUM4.dmg');
  assert.equal(JSON.parse(await readFile(resolve(directory, 'counter.json'), 'utf8')).total, 1);
  assert.equal((await http(port, 'GET', '/api/checkout?devices=99')).status, 400);
});
