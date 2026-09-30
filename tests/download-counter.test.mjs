import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const start = app.indexOf('// GitHub download totals have their own state');
const end = app.indexOf('function translateStatic()', start);
assert.ok(start >= 0 && end > start, 'Download counter integration block must exist.');
const block = app.slice(start, end);
const ttl = 60 * 1000;
const initialTime = 1_800_000_000_000;

function harness({ cache = null, readBlocked = false, writeBlocked = false, locale = 'pt-BR' } = {}) {
  const clock = { now: initialTime };
  const storage = new Map(cache ? [['lum4-release-downloads-v1', JSON.stringify(cache)]] : []);
  const elements = Object.fromEntries(['total', 'divider', 'count', 'unit', 'release-status'].map(name => [
    name === 'release-status' ? '[data-release-status]' : `[data-download-${name}]`,
    { hidden: true, textContent: '' }
  ]));
  const context = vm.createContext({
    Date: { now: () => clock.now },
    Intl,
    AbortSignal,
    document: { querySelector: selector => {
      assert.ok(Object.hasOwn(elements, selector), `Unexpected selector: ${selector}`);
      return elements[selector];
    } },
    localStorage: {
      getItem: key => { if (readBlocked) throw new Error('Storage blocked'); return storage.get(key) ?? null; },
      setItem: (key, value) => { if (writeBlocked) throw new Error('Storage blocked'); storage.set(key, value); }
    },
    copy: () => ({ locale }),
    message: key => ({ downloadOne: 'download', downloadOther: 'downloads', downloadTotal: 'Total verified', downloadReady: 'Ready to download' })[key],
    product: { downloads: 999, downloadAvailable: false },
    productUnavailable: true
  });
  vm.runInContext(`${block}\nglobalThis.counter = { refreshDownloadCount, renderDownloadSummary };`, context);
  context.counter.renderDownloadSummary();
  return {
    ...context.counter,
    clock,
    storage,
    context,
    element: name => elements[name === 'release-status' ? '[data-release-status]' : `[data-download-${name}]`],
    setLocale: value => { locale = value; }
  };
}

test('a fresh verified cache displays the total without fetching', async () => {
  const h = harness({ cache: { total: 18, fetchedAt: initialTime - 1000 } });
  let calls = 0;
  await h.refreshDownloadCount(async () => { calls++; return 99; });
  assert.equal(calls, 0);
  assert.equal(h.element('count').textContent, '18');
  assert.equal(h.element('total').hidden, false);
});

test('a stale cache survives failed refreshes and failures are throttled', async () => {
  const h = harness({ cache: { total: 18, fetchedAt: initialTime - ttl - 1 } });
  let calls = 0;
  const fail = async () => { calls++; throw new Error('Unavailable'); };
  await h.refreshDownloadCount(fail);
  await h.refreshDownloadCount(fail);
  assert.equal(calls, 1);
  assert.equal(h.element('count').textContent, '18');
  assert.equal(h.element('total').hidden, false);
  assert.equal(h.element('release-status').textContent, 'Total verified');
});

test('a failed refresh without a verified cache never displays an invented zero', async () => {
  const h = harness();
  await h.refreshDownloadCount(async () => { throw new Error('Unavailable'); });
  assert.equal(h.element('count').textContent, '—');
  assert.equal(h.element('total').hidden, true);
  assert.equal(h.element('divider').hidden, true);
  assert.equal(h.element('release-status').textContent, 'Ready to download');
});

test('a successful total renders even when browser storage is blocked', async () => {
  const h = harness({ readBlocked: true, writeBlocked: true });
  await h.refreshDownloadCount(async () => 18);
  assert.equal(h.element('count').textContent, '18');
  assert.equal(h.element('total').hidden, false);
  assert.equal(h.element('divider').hidden, false);
});

test('simultaneous refreshes share the same request', async () => {
  const h = harness();
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  let calls = 0;
  const fetchTotal = () => { calls++; return pending; };
  const first = h.refreshDownloadCount(fetchTotal);
  const second = h.refreshDownloadCount(fetchTotal);
  assert.equal(first, second);
  assert.equal(calls, 1);
  finish(18);
  await Promise.all([first, second]);
  assert.equal(h.element('count').textContent, '18');
});

test('an older persistent cache cannot overwrite a newer total after saving fails', async () => {
  const cached = { total: 5, fetchedAt: initialTime - ttl - 1 };
  const h = harness({ cache: cached, writeBlocked: true });
  await h.refreshDownloadCount(async () => 18);
  assert.deepEqual(JSON.parse(h.storage.get('lum4-release-downloads-v1')), cached);
  h.clock.now++;
  let calls = 0;
  const fail = async () => { calls++; throw new Error('Unavailable'); };
  await h.refreshDownloadCount(fail);
  assert.equal(calls, 0);
  assert.equal(h.element('count').textContent, '18');
  h.clock.now += ttl;
  await h.refreshDownloadCount(fail);
  assert.equal(calls, 1);
  assert.equal(h.element('count').textContent, '18');
});

test('number formatting and singular labels remain independent of checkout/product data', async () => {
  const h = harness({ locale: 'en-US' });
  await h.refreshDownloadCount(async () => 12345);
  assert.equal(h.element('count').textContent, '12,345');
  assert.equal(h.element('unit').textContent, 'downloads');
  h.setLocale('pt-BR');
  h.context.product.downloads = 0;
  h.renderDownloadSummary();
  assert.equal(h.element('count').textContent, '12.345');
  assert.equal(h.element('total').hidden, false);
  const single = harness();
  await single.refreshDownloadCount(async () => 1);
  assert.equal(single.element('count').textContent, '1');
  assert.equal(single.element('unit').textContent, 'download');
  assert.equal(single.element('release-status').textContent, 'Total verified');
});
