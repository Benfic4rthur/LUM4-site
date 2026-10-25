const repository = 'https://github.com/Benfic4rthur/LUM4-Releases';
const latestReleaseUrl = 'https://api.github.com/repos/Benfic4rthur/LUM4-Releases/releases/latest';
const assetName = 'LUM4-macOS-arm64.dmg';
const fallbackDownload = `${repository}/releases/latest/download/${assetName}`;

export function parseLum4Release(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || data.draft !== false || data.prerelease !== false
    || typeof data.tag_name !== 'string' || !/^v?\d+\.\d+\.\d+$/.test(data.tag_name)
    || !Array.isArray(data.assets)) return null;

  const downloadUrl = `${repository}/releases/download/${data.tag_name}/${assetName}`;
  const asset = data.assets.find(entry => entry && typeof entry === 'object'
    && entry.name === assetName && entry.state === 'uploaded'
    && entry.browser_download_url === downloadUrl);
  return asset ? { version: data.tag_name.replace(/^v/, ''), downloadUrl } : null;
}

export async function fetchLatestLum4Release({ fetchImpl = globalThis.fetch, signal } = {}) {
  const response = await fetchImpl(latestReleaseUrl, {
    method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer',
    cache: 'no-store', headers: { Accept: 'application/vnd.github+json' }, signal
  });
  return response.ok ? parseLum4Release(await response.json()) : null;
}

function mountVersion(badge) {
  let release = null;
  let request = null;
  const downloads = [...document.querySelectorAll('[data-download]')];

  function render() {
    const lang = document.documentElement.lang.split('-')[0];
    const label = ({ pt: 'Versão', en: 'Version', es: 'Versión' })[lang] || 'Version';
    badge.textContent = release ? `v${release.version}` : '';
    badge.hidden = !release;
    if (release) badge.setAttribute('aria-label', `${label} ${release.version}`);
    else badge.removeAttribute('aria-label');
    for (const link of downloads) link.href = release?.downloadUrl || fallbackDownload;
  }

  async function refresh() {
    if (request) return;
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      release = await fetchLatestLum4Release({ signal: controller.signal });
    } catch {
      // A failed lookup keeps the public latest/download URL, without a guessed version.
      release = null;
    } finally {
      clearTimeout(timeout);
      request = null;
      render();
    }
  }

  function refreshWhenVisible() { if (!document.hidden) void refresh(); }
  document.addEventListener('visibilitychange', refreshWhenVisible);
  window.addEventListener('pagehide', () => request?.abort());
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  setInterval(refreshWhenVisible, 5 * 60 * 1000);
  void refresh();
}

if (typeof document !== 'undefined') {
  const badge = document.querySelector('[data-release-version]');
  if (badge) mountVersion(badge);
}
