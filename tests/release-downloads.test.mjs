import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchReleaseDownloadTotal } from '../dist/release-downloads.js';

const asset = (id, download_count, name = `LUM4-${id}.dmg`) => ({ id, name, download_count });
const release = (assets = [], extra = {}) => ({ draft: false, prerelease: false, assets, ...extra });

function mockPages(pages) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const page = Number(new URL(url).searchParams.get('page'));
    assert.ok(page <= pages.length, `Página inesperada: ${page}`);
    const payload = pages[page - 1];
    if (payload instanceof Error) throw payload;
    if (payload?.httpError) return { ok: false, status: payload.httpError, json: async () => { throw new Error('Erro HTTP não deve ser interpretado como releases.'); } };
    return { ok: true, status: 200, json: async () => payload };
  };
  return { fetchImpl, calls };
}

test('totals every public DMG release, includes prereleases, and excludes checksum/source/draft downloads', async () => {
  const { fetchImpl, calls } = mockPages([[
    release([asset(1, 5), asset(4, 100, 'LUM4.dmg.sha256'), asset(5, 200, 'Source.zip')]),
    release([asset(2, 6, 'LUM4-MACOS.DMG')], { prerelease: true }),
    release([asset(3, 7)]),
    release([asset(6, 300)], { draft: true })
  ]]);
  assert.equal(await fetchReleaseDownloadTotal({ fetchImpl }), 18);
  assert.equal(calls.length, 1);
});

test('traverses full pages and deduplicates assets when releases move across pages', async () => {
  const first = [release([asset(1, 5)]), ...Array.from({ length: 99 }, () => release())];
  const second = [release([asset(1, 5), asset(2, 6)]), ...Array.from({ length: 99 }, () => release())];
  const third = [release([asset(3, 7)])];
  const { fetchImpl, calls } = mockPages([first, second, third]);
  assert.equal(await fetchReleaseDownloadTotal({ fetchImpl }), 18);
  assert.deepEqual(calls.map(call => new URL(call.url).searchParams.get('page')), ['1', '2', '3']);
});

test('requests the next empty page when the last populated page has exactly 100 releases', async () => {
  const { fetchImpl, calls } = mockPages([[release([asset(1, 5)]), ...Array.from({ length: 99 }, () => release())], []]);
  assert.equal(await fetchReleaseDownloadTotal({ fetchImpl }), 5);
  assert.equal(calls.length, 2);
});

test('a failure on page 2 rejects the total instead of returning a partial count', async () => {
  const first = [release([asset(1, 5)]), ...Array.from({ length: 99 }, () => release())];
  for (const failure of [{ httpError: 403 }, { httpError: 500 }, new Error('Connection interrupted')]) {
    const { fetchImpl, calls } = mockPages([first, failure]);
    await assert.rejects(fetchReleaseDownloadTotal({ fetchImpl }));
    assert.equal(calls.length, 2);
  }
});

test('rejects malformed releases/assets/counts and a total overflow', async t => {
  const invalid = [
    ['object instead of releases', {}],
    ['null instead of releases', null],
    ['null release', [null]],
    ['missing assets', [{}]],
    ['object instead of assets', [release({})]],
    ['null asset', [release([null])]],
    ['missing asset id', [release([{ name: 'LUM4.dmg', download_count: 5 }])]],
    ['unsafe asset id', [release([asset(Number.MAX_SAFE_INTEGER + 1, 5)])]],
    ['invalid asset name', [release([asset(1, 5, null)])]],
    ['negative count', [release([asset(1, -1)])]],
    ['fractional count', [release([asset(1, 0.5)])]],
    ['string count', [release([asset(1, '5')])]],
    ['unsafe count', [release([asset(1, Number.MAX_SAFE_INTEGER + 1)])]],
    ['overflow total', [release([asset(1, Number.MAX_SAFE_INTEGER), asset(2, 1)])]],
    ['invalid checksum count', [release([asset(1, -1, 'LUM4.dmg.sha256')])]],
    ['oversized page', Array.from({ length: 101 }, () => release())]
  ];
  for (const [name, payload] of invalid) {
    await t.test(name, async () => {
      const { fetchImpl } = mockPages([payload]);
      await assert.rejects(fetchReleaseDownloadTotal({ fetchImpl }));
    });
  }
});

test('invalid payload on a later page also rejects the total', async () => {
  const { fetchImpl } = mockPages([[release([asset(1, 5)]), ...Array.from({ length: 99 }, () => release())], [release([asset(2, -1)])]]);
  await assert.rejects(fetchReleaseDownloadTotal({ fetchImpl }));
});

test('sends anonymous GETs without a referrer and passes the supplied AbortSignal on every page', async () => {
  const controller = new AbortController();
  const { fetchImpl, calls } = mockPages([Array.from({ length: 100 }, () => release()), []]);
  assert.equal(await fetchReleaseDownloadTotal({ fetchImpl, signal: controller.signal }), 0);
  for (const { url, options } of calls) {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.github.com');
    assert.equal(parsed.pathname, '/repos/Benfic4rthur/LUM4-Releases/releases');
    assert.equal(parsed.searchParams.get('per_page'), '100');
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'no-referrer');
    assert.equal(options.cache, 'no-cache');
    assert.deepEqual(options.headers, { Accept: 'application/vnd.github+json' });
    assert.equal(options.signal, controller.signal);
  }
});

test('propagates cancellation without returning an unfinished total', async () => {
  const controller = new AbortController();
  let calls = 0;
  const fetchImpl = async (_url, { signal }) => {
    assert.equal(signal, controller.signal);
    calls++;
    if (calls === 1) return { ok: true, json: async () => [release([asset(1, 5)]), ...Array.from({ length: 99 }, () => release())] };
    controller.abort();
    signal.throwIfAborted();
  };
  await assert.rejects(fetchReleaseDownloadTotal({ fetchImpl, signal: controller.signal }), error => error.name === 'AbortError');
  assert.equal(calls, 2);
});

test('returns zero for a successfully fetched empty repository and propagates invalid JSON', async () => {
  assert.equal(await fetchReleaseDownloadTotal({ fetchImpl: mockPages([[]]).fetchImpl }), 0);
  await assert.rejects(fetchReleaseDownloadTotal({ fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } }) }), SyntaxError);
});
