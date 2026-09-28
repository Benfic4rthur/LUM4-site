import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// ICO stores the rendered PNG icons without changing their pixels.
const sizes = [32, 64];
const images = await Promise.all(sizes.map(size => readFile(new URL(`../dist/assets/lum4-favicon-${size}-v3.png`, import.meta.url))));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
const output = new URL('../dist/favicon.ico', import.meta.url);
await writeFile(output, Buffer.concat([header, ...images]));
console.log(`Ícone criado em ${fileURLToPath(output)}`);
