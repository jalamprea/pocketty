/**
 * Genera icon-192.png e icon-512.png (íconos de la PWA) a partir de un dibujo
 * simple: fondo oscuro con un prompt ">_" en color acento. Sin dependencias
 * externas: rasteriza a un buffer RGBA y lo codifica como PNG con zlib.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BG = [11, 14, 20, 255];
const FG = [92, 207, 230, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // resto en 0 (compresión/filtro/interlace por defecto)
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filtro None
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function setPx(px, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  px[i] = color[0];
  px[i + 1] = color[1];
  px[i + 2] = color[2];
  px[i + 3] = color[3];
}

function drawThickLine(px, size, x0, y0, x1, y1, w, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    const cx = Math.round(x0 + (x1 - x0) * t);
    const cy = Math.round(y0 + (y1 - y0) * t);
    const r = Math.floor(w / 2);
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) setPx(px, size, cx + dx, cy + dy, color);
  }
}

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = BG[0];
    px[i * 4 + 1] = BG[1];
    px[i * 4 + 2] = BG[2];
    px[i * 4 + 3] = BG[3];
  }
  const u = size / 64;
  const w = Math.max(2, Math.round(5 * u));
  // ">"
  drawThickLine(px, size, 14 * u, 22 * u, 26 * u, 32 * u, w, FG);
  drawThickLine(px, size, 26 * u, 32 * u, 14 * u, 42 * u, w, FG);
  // "_"
  drawThickLine(px, size, 30 * u, 44 * u, 48 * u, 44 * u, w, FG);
  return encodePng(size, px);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../public');
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(path.join(outDir, `icon-${size}.png`), makeIcon(size));
  console.log(`icon-${size}.png generado`);
}
