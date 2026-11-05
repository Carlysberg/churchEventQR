// Small QR encoder with no dependencies: byte mode, error correction level M, versions 1-10.
import { deflateSync } from 'node:zlib';

const TABLE = { 1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]], 6: [16, [[4, 27]]],
  7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]] };
const ALIGN = { 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
const REMAINDER = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0 };

const EXP = new Array(512).fill(0), LOG = new Array(256).fill(0);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function reedSolomon(data, n) {
  let gen = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(gen.length + 1).fill(0);
    gen.forEach((g, j) => { next[j] ^= g; next[j + 1] ^= mul(g, EXP[i]); });
    gen = next;
  }
  const res = new Array(n).fill(0);
  for (const d of data) {
    const f = d ^ res.shift();
    res.push(0);
    for (let i = 0; i < n; i++) res[i] ^= mul(gen[i + 1], f);
  }
  return res;
}

function codewords(text) {
  const raw = [...Buffer.from(text, 'utf8')];
  let v, ec, groups, cap, cc;
  for (v = 1; v <= 10; v++) {
    [ec, groups] = TABLE[v];
    cap = groups.reduce((s, [c, d]) => s + c * d, 0);
    cc = v < 10 ? 8 : 16;
    if (4 + cc + 8 * raw.length <= 8 * cap) break;
  }
  if (v > 10) throw new Error('Link is too long for a QR code at this level');
  const bits = [0, 1, 0, 0];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(raw.length, cc);
  raw.forEach((b) => push(b, 8));
  for (let i = Math.min(4, 8 * cap - bits.length); i > 0; i--) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; data.length < cap; pad = pad === 0xec ? 0x11 : 0xec) data.push(pad);
  const blocks = [], eccs = [];
  let p = 0;
  for (const [c, d] of groups) for (let i = 0; i < c; i++) { const b = data.slice(p, p + d); blocks.push(b); eccs.push(reedSolomon(b, ec)); p += d; }
  const out = [];
  const longest = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < longest; i++) blocks.forEach((b) => { if (i < b.length) out.push(b[i]); });
  for (let i = 0; i < ec; i++) eccs.forEach((e) => out.push(e[i]));
  return [v, out];
}

function bch(val, gen, top) {
  const length = (x) => (x === 0 ? 0 : Math.floor(Math.log2(x)) + 1);
  let d = val * 2 ** top;
  const glen = length(gen);
  while (length(d) >= glen) d ^= gen << (length(d) - glen);
  return val * 2 ** top + d;
}

const MASKS = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
  (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0, (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0];

function base(v) {
  const n = 17 + 4 * v;
  const m = Array.from({ length: n }, () => new Array(n).fill(null));
  const finder = (r0, c0) => {
    for (let r = -1; r < 8; r++) for (let c = -1; c < 8; c++) {
      if (r0 + r < 0 || r0 + r >= n || c0 + c < 0 || c0 + c >= n) continue;
      const on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      m[r0 + r][c0 + c] = on ? 1 : 0;
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) m[6][i] = m[i][6] = (i + 1) % 2;
  if (v >= 2) {
    const pos = ALIGN[v], last = pos[pos.length - 1];
    for (const r of pos) for (const c of pos) {
      if ((r === 6 && c === 6) || (r === 6 && c === last) || (r === last && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) m[r + dr][c + dc] = Math.max(Math.abs(dr), Math.abs(dc)) !== 1 ? 1 : 0;
    }
  }
  m[n - 8][8] = 1;
  for (let i = 0; i < 9; i++) { m[8][i] ??= 0; m[i][8] ??= 0; }
  for (let i = 0; i < 8; i++) { m[8][n - 1 - i] ??= 0; m[n - 1 - i][8] ??= 0; }
  if (v >= 7) {
    const info = bch(v, 0x1f25, 12);
    for (let i = 0; i < 18; i++) {
      const bit = Math.floor(info / 2 ** i) % 2;
      m[n - 11 + (i % 3)][Math.floor(i / 3)] = bit;
      m[Math.floor(i / 3)][n - 11 + (i % 3)] = bit;
    }
  }
  return m;
}

function writeFormat(m, mask) {
  const n = m.length;
  const info = bch(mask, 0x537, 10) ^ 0x5412;
  const bit = (i) => (info >> i) & 1;
  for (let i = 0; i < 6; i++) m[i][8] = bit(i);
  m[7][8] = bit(6); m[8][8] = bit(7); m[8][7] = bit(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) m[8][n - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) m[n - 15 + i][8] = bit(i);
  m[n - 8][8] = 1;
}

function penalty(m) {
  const n = m.length;
  let s = 0;
  const columns = m[0].map((_, c) => m.map((row) => row[c]));
  for (const line of [...m, ...columns]) {
    let run = 0, prev = null;
    for (const x of line) { if (x === prev) run++; else { if (run >= 5) s += run - 2; run = 1; prev = x; } }
    if (run >= 5) s += run - 2;
    const t = line.join('');
    s += 40 * ((t.match(/10111010000/g)?.length ?? 0) + (t.match(/00001011101/g)?.length ?? 0));
  }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) s += 3;
  const dark = (m.flat().reduce((a, b) => a + b, 0) * 100) / (n * n);
  return s + Math.floor(Math.abs(dark - 50) / 5) * 10;
}

export function encode(text) {
  const [v, cw] = codewords(text);
  const b = base(v), n = b.length;
  const bits = [];
  cw.forEach((x) => { for (let i = 7; i >= 0; i--) bits.push((x >> i) & 1); });
  for (let i = 0; i < REMAINDER[v]; i++) bits.push(0);
  const cells = [];
  let up = true;
  for (let c = n - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let k = 0; k < n; k++) {
      const r = up ? n - 1 - k : k;
      for (const cc of [c, c - 1]) if (b[r][cc] === null) cells.push([r, cc]);
    }
    up = !up;
  }
  if (cells.length !== bits.length) throw new Error('QR layout error');
  let best = null, bestScore = Infinity;
  MASKS.forEach((fn, k) => {
    const m = b.map((row) => [...row]);
    cells.forEach(([r, c], i) => { m[r][c] = bits[i] ^ (fn(r, c) ? 1 : 0); });
    writeFormat(m, k);
    const p = penalty(m);
    if (p < bestScore) { bestScore = p; best = m; }
  });
  return best;
}

export function toSvg(m, border = 4) {
  const s = m.length + 2 * border;
  let d = '';
  m.forEach((row, r) => row.forEach((x, c) => { if (x) d += `M${c + border} ${r + border}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#000"/></svg>\n`;
}

function crc32(buf) {
  let c, crc = ~0;
  for (const byte of buf) { c = (crc ^ byte) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
export function toPng(m, scale = 20, border = 4) {
  const size = (m.length + 2 * border) * scale;
  const raw = Buffer.alloc((size + 1) * size, 255);
  for (let y = 0; y < size; y++) {
    raw[y * (size + 1)] = 0;
    const r = Math.floor(y / scale) - border;
    for (let x = 0; x < size; x++) {
      const c = Math.floor(x / scale) - border;
      if (m[r]?.[c]) raw[y * (size + 1) + 1 + x] = 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
