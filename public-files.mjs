import { lstat, readdir, realpath } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const rootFiles = new Set(['index.html', 'app.js', 'locales.js', 'release-downloads.js', 'styles.css', 'favicon.ico']);
const imageExtensions = new Set(['.png', '.webp', '.svg', '.ico', '.jpg', '.jpeg', '.gif', '.avif']);
const safeName = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const backupName = /(?:^|[._-])(?:bak|backup|old|orig|save|tmp|temp)(?:[._-]|$)/i;

function safeSegments(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.includes('\\')) return null;
  const segments = relativePath.split('/');
  return segments.every(segment => safeName.test(segment) && !backupName.test(segment)) ? segments : null;
}

export function isAllowedPublicFile(relativePath) {
  const segments = safeSegments(relativePath);
  if (!segments) return false;
  if (segments.length === 1) return rootFiles.has(relativePath) || /^favicon-v\d+\.ico$/.test(relativePath);
  return segments[0] === 'assets' && imageExtensions.has(extname(segments.at(-1)).toLowerCase());
}

async function publicRootPath(root) {
  const path = resolve(root);
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('A pasta pública precisa ser um diretório sem link simbólico.');
  return realpath(path);
}

export async function resolvePublicFile(root, relativePath) {
  if (!isAllowedPublicFile(relativePath)) return null;
  try {
    const rootPath = await publicRootPath(root);
    let path = rootPath;
    const segments = relativePath.split('/');
    let info;
    for (let index = 0; index < segments.length; index++) {
      path = resolve(path, segments[index]);
      info = await lstat(path);
      if (info.isSymbolicLink() || (index < segments.length - 1 && !info.isDirectory())) return null;
    }
    if (!info.isFile()) return null;
    const actualPath = await realpath(path);
    if (!actualPath.startsWith(rootPath + sep)) return null;
    return { path: actualPath, info };
  } catch {
    return null;
  }
}

export async function listPublicFiles(root) {
  const rootPath = await publicRootPath(root);
  const files = [];
  async function visit(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const segments = safeSegments(relativePath);
      if (!segments || entry.isSymbolicLink()) throw new Error(`Arquivo público rejeitado: ${relativePath}`);
      if (entry.isDirectory()) {
        if (segments[0] !== 'assets') throw new Error(`Pasta pública rejeitada: ${relativePath}`);
        await visit(resolve(directory, entry.name), relativePath);
      } else if (entry.isFile()) {
        const file = await resolvePublicFile(rootPath, relativePath);
        if (!file) throw new Error(`Arquivo público rejeitado: ${relativePath}`);
        files.push(relativePath);
      } else {
        throw new Error(`Arquivo público rejeitado: ${relativePath}`);
      }
    }
  }
  await visit(rootPath);
  for (const required of ['index.html', 'app.js', 'locales.js', 'styles.css']) {
    if (!files.includes(required)) throw new Error(`Arquivo público obrigatório ausente: ${required}`);
  }
  return files.sort();
}
