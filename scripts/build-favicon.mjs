import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// ICO stores the rendered PNG icons without changing their pixels.
const sizes = [16, 32, 64, 128, 256];
const images = await Promise.all(sizes.map(size => readFile(new URL(`../dist/assets/lum4-favicon-${size}-v4.png`, import.meta.url))));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  // ICO uses zero in the directory entry for a 256-pixel dimension.
  header[entry] = sizes[index] === 256 ? 0 : sizes[index];
  header[entry + 1] = sizes[index] === 256 ? 0 : sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
const output = new URL('../dist/favicon-v4.ico', import.meta.url);
const icon = Buffer.concat([header, ...images]);
await writeFile(output, icon);
// Preserve the conventional URL for browsers that request it automatically.
await writeFile(new URL('../dist/favicon.ico', import.meta.url), icon);
console.log(`Ícone criado em ${fileURLToPath(output)}`);
