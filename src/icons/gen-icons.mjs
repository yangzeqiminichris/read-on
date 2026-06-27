// Generates ReadOn extension icons as PNG files using pure Node.js (no deps)
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Minimal PNG encoder ────────────────────────────────────────────────────

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
  // pixels: Uint8Array of RGBA values, row-major
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // bit depth 8, RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Build raw scanlines (filter byte 0 prepended to each row)
  const rowBytes = w * 4;
  const raw = Buffer.alloc(h * (rowBytes + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (rowBytes + 1)] = 0; // filter None
    pixels.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Canvas-like draw helpers ───────────────────────────────────────────────

function createCanvas(w, h) {
  const buf = Buffer.alloc(w * h * 4, 0);
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    // Alpha composite over existing pixel
    const sa = a / 255, da = buf[i+3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa === 0) return;
    buf[i+0] = Math.round((r * sa + buf[i+0] * da * (1 - sa)) / oa);
    buf[i+1] = Math.round((g * sa + buf[i+1] * da * (1 - sa)) / oa);
    buf[i+2] = Math.round((b * sa + buf[i+2] * da * (1 - sa)) / oa);
    buf[i+3] = Math.round(oa * 255);
  };

  // Filled circle (for anti-aliased corners)
  const fillCircle = (cx, cy, radius, r, g, b, a) => {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++)
        if (dx*dx + dy*dy <= r2) set(Math.round(cx+dx), Math.round(cy+dy), r, g, b, a);
  };

  // Filled rectangle
  const fillRect = (x1, y1, x2, y2, r, g, b, a) => {
    for (let y = Math.round(y1); y <= Math.round(y2); y++)
      for (let x = Math.round(x1); x <= Math.round(x2); x++)
        set(x, y, r, g, b, a);
  };

  // Rounded rectangle
  const fillRoundRect = (x1, y1, x2, y2, radius, r, g, b, a) => {
    fillRect(x1 + radius, y1, x2 - radius, y2, r, g, b, a);
    fillRect(x1, y1 + radius, x1 + radius - 1, y2 - radius, r, g, b, a);
    fillRect(x2 - radius + 1, y1 + radius, x2, y2 - radius, r, g, b, a);
    fillCircle(x1 + radius, y1 + radius, radius, r, g, b, a);
    fillCircle(x2 - radius, y1 + radius, radius, r, g, b, a);
    fillCircle(x1 + radius, y2 - radius, radius, r, g, b, a);
    fillCircle(x2 - radius, y2 - radius, radius, r, g, b, a);
  };

  // Filled polygon (scan-line fill)
  const fillPolygon = (pts, r, g, b, a) => {
    let minY = Infinity, maxY = -Infinity;
    pts.forEach(([,y]) => { if (y < minY) minY = y; if (y > maxY) maxY = y; });
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i+1) % pts.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + (y - ay) / (by - ay) * (bx - ax));
        }
      }
      xs.sort((a, b) => a - b);
      for (let j = 0; j < xs.length; j += 2)
        fillRect(Math.round(xs[j]), y, Math.round(xs[j+1]), y, r, g, b, a);
    }
  };

  return { buf, fillRect, fillRoundRect, fillCircle, fillPolygon, w, h };
}

// ── Icon renderer ──────────────────────────────────────────────────────────

function renderIcon(size) {
  const s = size;
  const c = createCanvas(s, s);

  // Theme colors (from theme.css)
  const BG  = [250, 246, 239]; // #FAF6EF rice paper
  const ACC = [194, 104,  60]; // #C2683C terracotta
  const WHT = [255, 255, 255]; // white (for position line)

  // 1. Background — rounded square
  const rBg = Math.max(2, Math.round(s * 0.20));
  c.fillRoundRect(0, 0, s-1, s-1, rBg, ...BG, 255);

  // 2. Bookmark body
  const bw  = Math.round(s * 0.44);
  const bh  = Math.round(s * 0.70);
  const bx  = Math.round((s - bw) / 2);
  const by  = Math.round(s * 0.13);
  const bx2 = bx + bw;
  const by2 = by + bh;
  const notch = Math.round(bh * 0.18);
  const midX  = bx + Math.round(bw / 2);
  const rBm   = Math.max(1, Math.round(bw * 0.18));

  const bookmarkPts = [
    [bx + rBm,    by],
    [bx2 - rBm,   by],
    [bx2,         by + rBm],
    [bx2,         by2 - notch],
    [midX,        by2],
    [bx,          by2 - notch],
    [bx,          by + rBm],
  ];
  c.fillPolygon(bookmarkPts, ...ACC, 255);
  // Smooth top corners
  c.fillCircle(bx + rBm,  by + rBm, rBm, ...ACC, 255);
  c.fillCircle(bx2 - rBm, by + rBm, rBm, ...ACC, 255);

  // 3. Position line — white, at ~42% height of bookmark (reading position)
  const lineY  = by + Math.round(bh * 0.42);
  const lhalf  = Math.max(1, Math.round(s * 0.026));
  const lpad   = Math.round(bw * 0.18);
  c.fillRect(bx + lpad, lineY - lhalf, bx2 - lpad, lineY + lhalf, ...WHT, 220);

  return makePNG(c.buf, s, s);
}

// ── Write files ────────────────────────────────────────────────────────────

mkdirSync(__dir, { recursive: true });
for (const sz of [16, 32, 48, 128]) {
  const png  = renderIcon(sz);
  const path = join(__dir, `icon${sz}.png`);
  writeFileSync(path, png);
  console.log(`✓ ${path}`);
}
