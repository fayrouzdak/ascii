import fs from "node:fs";
import zlib from "node:zlib";

function decodePng(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) throw new Error("not png");
  let o = 8;
  let w, h;
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
    } else if (type === "IDAT") idatChunks.push(data);
  }
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = 4;
  const stride = w * bpp;
  const out = Buffer.alloc(stride * h);
  let prev = Buffer.alloc(stride);
  let ri = 0;
  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }
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
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, pixels: out, bpp };
}

function lum(pixels, bpp, i) {
  const o = i * bpp;
  return (pixels[o] * 299 + pixels[o + 1] * 587 + pixels[o + 2] * 114) / 1000;
}

const buf = fs.readFileSync(process.argv[2]);
const { w, h, pixels, bpp } = decodePng(buf);

const win = 96;
const xMin = 80,
  yMin = 60;
let best = -1,
  bx = 0,
  by = 0;
for (let y0 = yMin; y0 + win <= h - 40; y0 += 4) {
  for (let x0 = xMin; x0 + win <= w - 40; x0 += 4) {
    let sum = 0,
      sum2 = 0,
      n = 0;
    for (let dy = 0; dy < win; dy++) {
      for (let dx = 0; dx < win; dx++) {
        const L = lum(pixels, bpp, (y0 + dy) * w + (x0 + dx));
        sum += L;
        sum2 += L * L;
        n++;
      }
    }
    const mean = sum / n;
    const varL = sum2 / n - mean * mean;
    if (varL > best) {
      best = varL;
      bx = x0;
      by = y0;
    }
  }
}
console.error("best window", bx, by, win, "var", best);

const minX = bx,
  minY = by,
  maxX = bx + win - 1,
  maxY = by + win - 1;
const bw = maxX - minX + 1;
const bh = maxY - minY + 1;
const scale = 3; // 90/30 = 3
const gw = Math.floor(bw / scale);
const gh = Math.floor(bh / scale);

for (let gy = 0; gy < gh; gy++) {
  let row = "";
  for (let gx = 0; gx < gw; gx++) {
    let b = 0,
      wht = 0,
      tot = 0;
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const x = minX + gx * scale + dx;
        const y = minY + gy * scale + dy;
        const L = lum(pixels, bpp, y * w + x);
        tot++;
        if (L < 95) b++;
        else if (L > 205) wht++;
      }
    }
    if (b > wht && b > tot * 0.3) row += "#";
    else if (wht > b && wht > tot * 0.3) row += "O";
    else row += ".";
  }
  console.log(row);
}
