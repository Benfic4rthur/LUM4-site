const releasesUrl = 'https://api.github.com/repos/Benfic4rthur/LUM4-Releases/releases';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function fetchReleaseDownloadTotal({ fetchImpl = globalThis.fetch, signal } = {}) {
  const assetIds = new Set();
  let total = 0;

  for (let page = 1; ; page++) {
    const response = await fetchImpl(`${releasesUrl}?per_page=100&page=${page}`, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-cache',
      headers: { Accept: 'application/vnd.github+json' },
      signal
    });
    if (!response?.ok) throw new Error('Não foi possível consultar os downloads das releases.');

    const releases = await response.json();
    if (!Array.isArray(releases) || releases.length > 100) throw new Error('Resposta de releases inválida.');

    for (const release of releases) {
      if (!isRecord(release) || !Array.isArray(release.assets)) throw new Error('Release inválida.');
      for (const asset of release.assets) {
        if (!isRecord(asset)
          || !Number.isSafeInteger(asset.id) || asset.id < 0
          || typeof asset.name !== 'string' || asset.name.length === 0
          || !Number.isSafeInteger(asset.download_count) || asset.download_count < 0) {
          throw new Error('Asset de release inválido.');
        }
        if (release.draft === true || !/\.dmg$/i.test(asset.name) || assetIds.has(asset.id)) continue;

        const nextTotal = total + asset.download_count;
        if (!Number.isSafeInteger(nextTotal)) throw new Error('Total de downloads fora do limite válido.');
        total = nextTotal;
        assetIds.add(asset.id);
      }
    }

    if (releases.length < 100) return total;
  }
}
