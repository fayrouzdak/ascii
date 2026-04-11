import fs from "node:fs";
import zlib from "node:zlib";

function decodePng(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) throw new Error("not png");
  let o = 8;
  let w, h, ctype;
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
      ctype = data[9];
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
  const r = pixels[o],
    g = pixels[o + 1],
    b = pixels[o + 2];
  return (r * 299 + g * 587 + b * 114) / 1000;
}

const buf = fs.readFileSync(process.argv[2]);
const { w, h, pixels, bpp } = decodePng(buf);
console.error("size", w, h);

// Focus on central canvas (drops window chrome / side panels)
const cx = Math.floor(w * 0.52);
const cy = Math.floor(h * 0.42);
const cw = Math.min(220, w - 20);
const ch = Math.min(220, h - 20);
const x0 = Math.max(10, cx - Math.floor(cw / 2));
const y0 = Math.max(10, cy - Math.floor(ch / 2));
const x1 = Math.min(w - 10, x0 + cw);
const y1 = Math.min(h - 10, y0 + ch);
console.error("focus rect", x0, y0, x1, y1);

const fg = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) {
  const L = lum(pixels, bpp, i);
  const x = i % w;
  const y = (i / w) | 0;
  const inside = x >= x0 && x < x1 && y >= y0 && y < y1;
  fg[i] = inside && L < 95 ? 1 : 0;
}

// connected components on fg
const labels = new Int32Array(w * h);
let curLabel = 0;
const areas = [];
function flood(start, label) {
  const q = [start];
  let count = 0;
  labels[start] = label;
  while (q.length) {
    const idx = q.pop();
    count++;
    const x = idx % w;
    const y = (idx / w) | 0;
    const nbs = [idx - 1, idx + 1, idx - w, idx + w];
    if (x > 0 && fg[idx - 1] && !labels[idx - 1]) {
      labels[idx - 1] = label;
      q.push(idx - 1);
    }
    if (x < w - 1 && fg[idx + 1] && !labels[idx + 1]) {
      labels[idx + 1] = label;
      q.push(idx + 1);
    }
    if (y > 0 && fg[idx - w] && !labels[idx - w]) {
      labels[idx - w] = label;
      q.push(idx - w);
    }
    if (y < h - 1 && fg[idx + w] && !labels[idx + w]) {
      labels[idx + w] = label;
      q.push(idx + w);
    }
  }
  return count;
}

for (let i = 0; i < fg.length; i++) {
  if (fg[i] && !labels[i]) {
    curLabel++;
    areas[curLabel] = flood(i, curLabel);
  }
}

const byArea = [];
for (let lab = 1; lab <= curLabel; lab++) {
  byArea.push({ lab, a: areas[lab] });
}
byArea.sort((x, y) => y.a - x.a);
console.error("largest components", byArea.slice(0, 5).map((c) => `${c.lab}:${c.a}`).join(", "));
console.error(
  "components (lab:area)",
  byArea
    .filter((x) => x.a >= 30 && x.a <= 20000)
    .slice(0, 25)
    .map((c) => `${c.lab}:${c.a}`)
    .join(", "),
);

const candidates = [];
for (let lab = 1; lab <= curLabel; lab++) {
  const a = areas[lab];
  if (a >= 200 && a <= 35000) candidates.push({ lab, a });
}
candidates.sort((x, y) => y.a - x.a);
console.error(
  "top candidates",
  candidates.slice(0, 8).map((c) => `${c.lab}:${c.a}`).join(", "),
);

let best = 0;
let bestScore = -1;
for (const { lab, a } of candidates) {
  let bx0 = w,
    by0 = h,
    bx1 = 0,
    by1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (labels[i] !== lab) continue;
      bx0 = Math.min(bx0, x);
      by0 = Math.min(by0, y);
      bx1 = Math.max(bx1, x);
      by1 = Math.max(by1, y);
    }
  }
  const bw0 = bx1 - bx0 + 1;
  const bh0 = by1 - by0 + 1;
  const fill = a / (bw0 * bh0);
  // prefer compact, icon-ish (~24–120px in screenshot coords)
  const inRange =
    bw0 >= 24 && bw0 <= 120 && bh0 >= 24 && bh0 <= 120 ? 1 : 0;
  const score = inRange * 1e9 + fill * 5000 + Math.min(a, 25000);
  if (lab <= 5 || inRange) {
    console.error(
      `  lab ${lab} a=${a} bbox=${bw0}x${bh0} fill=${fill.toFixed(3)} inRange=${inRange} score=${score}`,
    );
  }
  if (score > bestScore) {
    bestScore = score;
    best = lab;
  }
}
const bestArea = areas[best];
console.error("best label", best, "area", bestArea);

let minX = w,
  minY = h,
  maxX = 0,
  maxY = 0;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (labels[i] === best) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
}
console.error("icon bbox", minX, minY, maxX, maxY, "wh", maxX - minX + 1, maxY - minY + 1);

const bw = maxX - minX + 1;
const bh = maxY - minY + 1;

// integer scale down to pixel art grid
let scale = 1;
for (let s = 1; s <= 64; s++) {
  if (bw % s === 0 && bh % s === 0) scale = s;
}
const gw = bw / scale;
const gh = bh / scale;
console.error("scale", scale, "grid", gw, gh);

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
        if (x > maxX || y > maxY) continue;
        const L = lum(pixels, bpp, y * w + x);
        tot++;
        if (L < 90) b++;
        else if (L > 200) wht++;
      }
    }
    if (b > wht && b > tot * 0.35) row += "#";
    else if (wht > b && wht > tot * 0.35) row += "O";
    else row += ".";
  }
  console.log(row);
}
