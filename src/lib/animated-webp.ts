/**
 * Detect animated WebP from the RIFF header (VP8X animation bit or ANIM chunk).
 * @see https://developers.google.com/speed/webp/docs/riff_container
 */
export function isAnimatedWebP(buffer: ArrayBuffer): boolean {
  const b = buffer.byteLength;
  if (b < 12) return false;
  const v = new DataView(buffer);
  const u8 = new Uint8Array(buffer);
  if (v.getUint32(0, true) !== 0x46464952) return false; // RIFF
  if (u8[8] !== 0x57 || u8[9] !== 0x45 || u8[10] !== 0x42 || u8[11] !== 0x50) return false; // WEBP

  let o = 12;
  while (o + 8 <= b) {
    const id = String.fromCharCode(u8[o]!, u8[o + 1]!, u8[o + 2]!, u8[o + 3]!);
    const size = v.getUint32(o + 4, true);
    const padded = size + (size & 1);
    if (o + 8 + padded > b) break;
    const dataStart = o + 8;
    if (id === 'VP8X') {
      const flags = u8[dataStart]!;
      if (flags & 0x10) return true;
    }
    if (id === 'ANIM') return true;
    o += 8 + padded;
  }
  return false;
}
