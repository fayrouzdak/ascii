import fs from "node:fs";
import zlib from "node:zlib";

function decodePng(path) {
  const buf = fs.readFileSync(path);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) throw new Error("not png");
  let o = 8;
  let w, h, bitDepth, colorType;
  const idatChunks = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    o += 4;
    const type = buf.toString("ascii", o, o + 4);
    o += 4;
    const data = buf.subarray(o, o + len);
    o += len;
    o += 4;
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    }
  }
  const compressed = Buffer.concat(idatChunks);
  const raw = zlib.inflateSync(compressed);
  const bpp =
    colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : (() => {
      throw new Error(`unsupported colorType ${colorType}`);
    })();
  const stride = w * bpp;
  const out = Buffer.alloc(stride * h);
  let prev = Buffer.alloc(stride);
  let ri = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[ri++];
    const row = raw.subarray(ri, ri + stride);
    ri += stride;
    const cur = Buffer.alloc(stride);
    if (filter === 0) row.copy(cur);
    else if (filter === 1) {
      for (let i = 0; i < stride; i++) {
        const left = i >= bpp ? cur[i - bpp] : 0;
        cur[i] = (row[i] + left) & 255;
      }
    } else if (filter === 2) {
      for (let i = 0; i < stride; i++) cur[i] = (row[i] + prev[i]) & 255;
    } else if (filter === 3) {
      for (let i = 0; i < stride; i++) {
        const left = i >= bpp ? cur[i - bpp] : 0;
        const up = prev[i];
        cur[i] = (row[i] + ((left + up) >> 1)) & 255;
      }
    } else if (filter === 4) {
      for (let i = 0; i < stride; i++) {
        const left = i >= bpp ? cur[i - bpp] : 0;
        const up = prev[i];
        const ul = i >= bpp ? prev[i - bpp] : 0;
        cur[i] = (row[i] + paeth(left, up, ul)) & 255;
      }
    } else throw new Error(`bad filter ${filter}`);
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, bpp, pixels: out };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

const path = process.argv[2];
const { w, h, bpp, pixels } = decodePng(path);
console.error("size", w, h, bpp);

function lum(i) {
  const o = i * bpp;
  if (bpp === 4) {
    const r = pixels[o],
      g = pixels[o + 1],
      b = pixels[o + 2];
    return (r * 299 + g * 587 + b * 114) / 1000;
  }
  return pixels[o];
}

// Find tight bbox of "ink" vs light background
let minX = w,
  minY = h,
  maxX = 0,
  maxY = 0;
const bgSamples = [];
for (let i = 0; i < Math.min(5000, w * h); i++) {
  const x = (i * 7919) % w;
  const y = (i * 6151) % h;
  bgSamples.push(lum(y * w + x));
}
bgSamples.sort((a, b) => a - b);
const bgLum = bgSamples[Math.floor(bgSamples.length * 0.5)];

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const L = lum(y * w + x);
    if (Math.abs(L - bgLum) > 25 || L < bgLum - 15) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
}
console.error("bbox", minX, minY, maxX, maxY);

const bw = maxX - minX + 1;
const bh = maxY - minY + 1;
// Downsample to pixel grid: assume icon is integer scale factor
let scale = 1;
for (let s = 1; s <= 40; s++) {
  if (bw % s === 0 && bh % s === 0 && bw / s <= 48 && bh / s <= 48) {
    scale = s;
  }
}
// pick largest reasonable scale
for (let s = 40; s >= 1; s--) {
  if (bw % s === 0 && bh % s === 0) {
    scale = s;
    break;
  }
}
const gw = Math.round(bw / scale);
const gh = Math.round(bh / scale);
console.error("guess scale", scale, "grid", gw, gh);

const grid = [];
for (let gy = 0; gy < gh; gy++) {
  let row = "";
  for (let gx = 0; gx < gw; gx++) {
    let sum = 0;
    let cnt = 0;
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const x = minX + gx * scale + dx;
        const y = minY + gy * scale + dy;
        if (x <= maxX && y <= maxY) {
          sum += lum(y * w + x);
          cnt++;
        }
      }
    }
    const avg = sum / cnt;
    row += avg < bgLum - 8 ? "#" : avg > bgLum + 35 ? "O" : ".";
  }
  grid.push(row);
}
for (const row of grid) console.log(row);
