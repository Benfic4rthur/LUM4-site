import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLum4Release, fetchLatestLum4Release } from '../dist/release-version.js';

const release = (version = '0.1.9') => ({
  draft: false, prerelease: false, tag_name: `v${version}`,
  assets: [{ name: 'LUM4-macOS-arm64.dmg', state: 'uploaded',
    browser_download_url: `https://github.com/Benfic4rthur/LUM4-Releases/releases/download/v${version}/LUM4-macOS-arm64.dmg` }]
});

test('a versão e o download são obtidos da mesma release estável', () => {
  for (const version of ['0.1.9', '0.2.0', '1.0.0']) {
    const result = parseLum4Release(release(version));
    assert.equal(result.version, version);
    assert.ok(result.downloadUrl.includes(`/v${version}/`));
  }
});

test('releases ausentes, instáveis ou sem instalador publicado não mostram uma versão', () => {
  for (const value of [null, undefined, {}, [], 'erro', { ...release(), draft: true },
    { ...release(), prerelease: true }, { ...release(), tag_name: 'latest' },
    { ...release(), assets: [] }, { ...release(), assets: [null] },
    { ...release(), assets: release('0.1.8').assets }]) {
    assert.equal(parseLum4Release(value), null);
  }
  const pending = release();
  pending.assets[0].state = 'starter';
  assert.equal(parseLum4Release(pending), null);
});

test('links fora do asset oficial são rejeitados', () => {
  for (const url of ['https://example.org/LUM4.dmg',
    'http://github.com/Benfic4rthur/LUM4-Releases/releases/download/v0.1.9/LUM4-macOS-arm64.dmg',
    'https://github.com/Benfic4rthur/LUM4-Releases/releases/download/v0.1.9/LUM4-macOS-arm64.dmg?redirect=1']) {
    const value = release();
    value.assets[0].browser_download_url = url;
    assert.equal(parseLum4Release(value), null);
  }
});

test('consulta a última release sem credenciais e sem usar uma versão em cache', async () => {
  const controller = new AbortController();
  const result = await fetchLatestLum4Release({ signal: controller.signal, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.github.com/repos/Benfic4rthur/LUM4-Releases/releases/latest');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, controller.signal);
    return { ok: true, json: async () => release('0.2.0') };
  } });
  assert.equal(result.version, '0.2.0');
  assert.equal(await fetchLatestLum4Release({ fetchImpl: async () => ({ ok: false }) }), null);
});
