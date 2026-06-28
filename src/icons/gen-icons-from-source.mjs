// Generates ReadOn extension icons by downscaling a source PNG.
// Pure Node.js, no deps: decode PNG (8-bit, color type 2/6, non-interlaced)
// → box-average downscale → re-encode RGBA PNG at 16/32/48/128.
//
//   node src/icons/gen-icons-from-source.mjs [sourcePath]
//
import { deflateSync, inflateSync } from 'zlib';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] || join(__dir, 'source.png');

// ── PNG encode (RGBA) ──────────────────────────────────────────────────────

function crc32(buf) {
  const table = crc32.table ??= (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body    = Buffer.concat([typeBuf, data]);
  const len     = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc     = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function makePNG(pixels, w, h) {
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // bit depth 8, RGBA
  const rowBytes = w * 4;
  const raw = Buffer.alloc(h * (rowBytes + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (rowBytes + 1)] = 0; // filter None
    pixels.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── PNG decode (8-bit, color type 2 RGB or 6 RGBA, non-interlaced) ──────────

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const bitDepth = buf[24], colorType = buf[25], interlace = buf[28];
  if (bitDepth !== 8) throw new Error('only 8-bit supported, got ' + bitDepth);
  if (interlace !== 0) throw new Error('interlaced PNG not supported');
  if (colorType !== 2 && colorType !== 6) throw new Error('only RGB/RGBA, got colorType ' + colorType);
  const channels = colorType === 6 ? 4 : 3;

  // gather IDAT
  const idat = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat.push(buf.slice(off + 8, off + 8 + len));
    if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));

  const bpp = channels;
  const rowBytes = w * bpp;
  const out = Buffer.alloc(h * rowBytes);
  let prev = Buffer.alloc(rowBytes, 0);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const cur = Buffer.alloc(rowBytes);
    for (let i = 0; i < rowBytes; i++) {
      const x = raw[p++];
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: v = x + paeth(a, b, c); break;
        default: throw new Error('bad filter ' + filter);
      }
      cur[i] = v & 0xff;
    }
    cur.copy(out, y * rowBytes);
    prev = cur;
  }
  return { w, h, channels, data: out };
}

// ── Box-average downscale → RGBA ───────────────────────────────────────────

function downscaleRGBA(src, size) {
  const { w, h, channels, data } = src;
  const out = Buffer.alloc(size * size * 4);
  for (let ty = 0; ty < size; ty++) {
    const sy0 = Math.floor(ty * h / size), sy1 = Math.max(sy0 + 1, Math.floor((ty + 1) * h / size));
    for (let tx = 0; tx < size; tx++) {
      const sx0 = Math.floor(tx * w / size), sx1 = Math.max(sx0 + 1, Math.floor((tx + 1) * w / size));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * w + sx) * channels;
          r += data[i]; g += data[i + 1]; b += data[i + 2];
          a += channels === 4 ? data[i + 3] : 255;
          n++;
        }
      }
      const o = (ty * size + tx) * 4;
      out[o]     = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

// ── Run ────────────────────────────────────────────────────────────────────

const src = decodePNG(readFileSync(SRC));
const corner = (x, y) => {
  const i = (y * src.w + x) * src.channels;
  return [src.data[i], src.data[i + 1], src.data[i + 2], src.channels === 4 ? src.data[i + 3] : 255];
};
console.log('source', src.w + 'x' + src.h, 'channels', src.channels);
console.log('corners TL/TR/BL/BR:',
  corner(0, 0), corner(src.w - 1, 0), corner(0, src.h - 1), corner(src.w - 1, src.h - 1));

for (const sz of [16, 32, 48, 128]) {
  const px = downscaleRGBA(src, sz);
  const path = join(__dir, `icon${sz}.png`);
  writeFileSync(path, makePNG(px, sz, sz));
  console.log(`✓ ${path}`);
}
